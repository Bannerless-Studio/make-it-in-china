import {
  Clock,
  Color,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { TimeSlot, World } from '../content/types';
import { loadAll, type LoadedScenes } from './assets';
import { createFollowCamera, type FollowCamera } from './camera';
import { makeCharacter, type Character } from './character';
import {
  ARRIVAL_OFFSETS,
  BLOB_ALPHA,
  CAPSULE_RADIUS,
  DESKTOP_DPR,
  DESKTOP_FPS,
  isPhoneViewport,
  MAX_ACCUM,
  MAX_SUBSTEPS,
  PHONE_DPR,
  PHONE_FPS,
  SIM_DT,
  TALK_EXIT_RANGE,
  TALK_FACING_DOT,
  TALK_RANGE,
} from './constants';
import { spawnCrowd, type Crowd } from './crowd';
import { createInput } from './input';
import { collidersFromWorld, isStreetPose, isWalkable, stepMotion, type MotionState } from './motion';
import { npcAnchor, spawnNpcs, type NpcActor } from './npc';
import { shadowStretch, type DayPalette } from './daylight';
import { blobShadow, buildDistrict, createDaylight, type Daylight } from './world';

export interface SceneEvents {
  isLocked(): boolean;
  onTalk(): void;
  onMenu(): void;
  onNpcPosition(id: string, x: number, y: number, visible: boolean): void;
  onNearNpc(id: string | null, label: string | null): void;
  onSafePose?(x: number, z: number, yaw: number): void;
}

export interface SceneHandle {
  setSpeakingNpc(id: string | null): void;
  setTimeSlot(slot: TimeSlot): void;
  getTimeSlot(): TimeSlot;
  fps(): number;
  draws(): number;
  getPose(): { x: number; z: number; yaw: number };
  getYaw(): number;
  setPose(x: number, z: number, yaw: number): void;
  snapToNpc(id: string): boolean;
}

export interface SceneStartOptions {
  pose?: [number, number, number];
  snapNpc?: string;
  timeSlot?: TimeSlot;
}

function spawnOf(world: World) {
  return world.spawns?.find(item => item.id === 'player_start')
    ?? { position: [-24, 0, -5] as [number, number, number], yaw: Math.PI };
}

export async function startScene(
  root: HTMLElement,
  world: World,
  events: SceneEvents,
  options: SceneStartOptions = {},
): Promise<SceneHandle> {
  const mobile = isPhoneViewport();
  const assets: LoadedScenes = new Map();
  const scene = new Scene();
  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.textContent = '加载中… loading models';
  root.append(loading);

  const prompt = document.createElement('div');
  prompt.id = 'talk-prompt';
  prompt.hidden = true;
  root.append(prompt);

  const collision = collidersFromWorld(world);
  const spawn = spawnOf(world);
  const startX = options.pose?.[0] ?? spawn.position[0];
  const startZ = options.pose?.[1] ?? spawn.position[2];
  const startYaw = options.pose?.[2] ?? spawn.yaw;
  const motion: MotionState = { velocity: new Vector2(), yaw: startYaw };
  let speakingNpc: string | null = null;
  let timeSlot: TimeSlot = options.timeSlot ?? 'M';
  let nearId: string | null = null;
  let character: Character | undefined;
  let npcs: NpcActor[] = [];
  let follow: FollowCamera | undefined;
  let lights: Daylight | undefined;
  let crowd: Crowd | undefined;
  const blobs: Mesh[] = [];
  let measuredFps = 0;
  let measuredDraws = 0;
  const headScratch = new Vector3();
  const playerPos = new Vector3(startX, 0, startZ);
  const zeroMove = new Vector2();

  function applyPose(x: number, z: number, yaw: number): void {
    playerPos.set(x, 0, z);
    motion.yaw = yaw;
    motion.velocity.set(0, 0);
    if (character) {
      character.group.position.copy(playerPos);
      character.group.rotation.y = yaw;
    }
    if (follow) {
      follow.yaw = yaw;
      follow.snap();
    }
  }

  function snapToNpc(id: string): boolean {
    const index = world.npcs.findIndex(item => item.id === id);
    if (index < 0) return false;
    const stand = npcAnchor(world, id, timeSlot, index);
    const actor = npcs.find(item => item.id === id);
    const nx = actor?.group.position.x ?? stand?.x;
    const nz = actor?.group.position.z ?? stand?.z;
    if (nx === undefined || nz === undefined) return false;
    for (const [dx, dz] of ARRIVAL_OFFSETS) {
      if (dx === 0 && dz === 0) continue;
      const x = nx + dx;
      const z = nz + dz;
      if (!isWalkable(x, z, CAPSULE_RADIUS, collision)) continue;
      applyPose(x, z, Math.atan2(nx - x, nz - z));
      return true;
    }
    const fallbackZ = nz + 1.2;
    if (isWalkable(nx, fallbackZ, CAPSULE_RADIUS, collision)) {
      applyPose(nx, fallbackZ, Math.atan2(0, nz - fallbackZ));
      return true;
    }
    return false;
  }

  try {
    const renderer = new WebGLRenderer({ antialias: !mobile, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? PHONE_DPR : DESKTOP_DPR));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(new Color(0xdce9e7), 1);
    if (!mobile) renderer.shadowMap.enabled = true;
    if (!mobile) renderer.shadowMap.type = PCFSoftShadowMap;
    root.append(renderer.domElement);

    lights = createDaylight(scene, renderer, mobile, timeSlot);
    const cam = createFollowCamera();
    follow = cam;
    cam.yaw = startYaw;
    const district = buildDistrict(scene, world, assets, root);
    const input = createInput(root, renderer.domElement, events.isLocked);

    function trackedBlob(name: string): Mesh {
      const shadow = blobShadow();
      shadow.name = name;
      blobs.push(shadow);
      return shadow;
    }

    function placeCharacter(next: Character): void {
      if (character) scene.remove(character.group);
      character = next;
      character.group.position.copy(playerPos);
      character.group.rotation.y = motion.yaw;
      scene.add(character.group);
      character.group.add(trackedBlob('player-blob'));
    }

    function placeNpcs(next: NpcActor[]): void {
      for (const npc of npcs) scene.remove(npc.group);
      npcs = next;
      for (const npc of npcs) {
        npc.group.add(trackedBlob(`${npc.id}-blob`));
        scene.add(npc.group);
        npc.update(0, playerPos, speakingNpc, timeSlot, world, 0);
      }
    }

    function placeCrowd(next: Crowd): void {
      if (crowd) scene.remove(crowd.group);
      crowd = next;
      scene.add(crowd.group);
      crowd.update(0, playerPos, cam.camera.position);
    }

    function setBlobTone(palette: DayPalette): void {
      const stretch = shadowStretch(palette);
      const spread = Math.min(1.7, 1 + (stretch - 1) * 0.22);
      for (const blob of blobs) {
        blob.scale.set(spread, spread, 1);
        const material = blob.material;
        if (material instanceof MeshBasicMaterial) {
          material.opacity = BLOB_ALPHA / Math.max(1, spread * 0.85);
        }
      }
    }

    placeCharacter(makeCharacter(true, assets, 0xe7d6ba, { bag: true }, 'player'));
    placeNpcs(spawnNpcs(world, true, assets));
    placeCrowd(spawnCrowd(true, assets, mobile));
    lights.attach({ setDayTone(palette) {
      district.setDayTone(palette);
      setBlobTone(palette);
    } });
    if (options.snapNpc) snapToNpc(options.snapNpc);
    else if (options.pose && !isWalkable(startX, startZ, CAPSULE_RADIUS, collision)) {
      applyPose(spawn.position[0], spawn.position[2], spawn.yaw);
    }

    let viewW = innerWidth;
    let viewH = innerHeight;
    function resize(): void {
      const port = visualViewport;
      viewW = Math.max(1, Math.round(port?.width ?? innerWidth));
      viewH = Math.max(1, Math.round(port?.height ?? innerHeight));
      renderer.setPixelRatio(Math.min(devicePixelRatio, isPhoneViewport() ? PHONE_DPR : DESKTOP_DPR));
      renderer.setSize(viewW, viewH);
      cam.camera.aspect = viewW / viewH;
      cam.camera.updateProjectionMatrix();
    }
    addEventListener('resize', resize);
    visualViewport?.addEventListener('resize', resize);
    visualViewport?.addEventListener('scroll', resize);
    resize();

    function facingNpc(npc: NpcActor): boolean {
      const dx = npc.group.position.x - playerPos.x;
      const dz = npc.group.position.z - playerPos.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-4) return true;
      const fx = Math.sin(motion.yaw);
      const fz = Math.cos(motion.yaw);
      return (fx * dx + fz * dz) / length >= TALK_FACING_DOT;
    }

    function nearestTalk(): NpcActor | null {
      const candidates = npcs
        .map(npc => ({ npc, dist: Math.hypot(npc.group.position.x - playerPos.x, npc.group.position.z - playerPos.z) }))
        .filter(item => item.dist <= (nearId === item.npc.id ? TALK_EXIT_RANGE : TALK_RANGE) && facingNpc(item.npc))
        .sort((a, b) => a.dist - b.dist || a.npc.id.localeCompare(b.npc.id));
      return candidates[0]?.npc ?? null;
    }

    const clock = new Clock();
    let frameAcc = 0;
    let frameCount = 0;
    let accum = 0;
    let renderBank = 0;
    let safeAcc = 0;
    let lastLocked = events.isLocked();
    const fps = mobile ? PHONE_FPS : DESKTOP_FPS;

    renderer.setAnimationLoop(() => {
      if (!character) return;
      const raw = clock.getDelta();
      frameAcc += raw;
      frameCount += 1;
      if (frameAcc >= 0.5) {
        measuredFps = frameCount / frameAcc;
        frameAcc = 0;
        frameCount = 0;
      }
      if (document.hidden) {
        accum = 0;
        return;
      }
      accum = Math.min(MAX_ACCUM, accum + raw);
      const intent = input.sample(raw);
      const locked = events.isLocked();
      if (lastLocked && !locked) events.onSafePose?.(playerPos.x, playerPos.z, motion.yaw);
      lastLocked = locked;
      let steps = 0;
      let walkSpeed = 0;
      while (accum >= SIM_DT && steps < MAX_SUBSTEPS) {
        const speed = stepMotion(
          playerPos,
          motion,
          locked ? zeroMove : intent.move,
          locked ? false : intent.run,
          cam.yaw,
          SIM_DT,
          collision,
          locked,
        );
        walkSpeed = locked ? 0 : speed;
        character.group.position.copy(playerPos);
        character.group.rotation.y = motion.yaw;
        character.update(SIM_DT, walkSpeed, false, 0);
        for (const npc of npcs) {
          const view = cam.camera.position.distanceTo(npc.group.position);
          npc.update(SIM_DT, playerPos, speakingNpc, timeSlot, world, view);
        }
        district.setInterior(playerPos, SIM_DT);
        crowd?.update(SIM_DT, playerPos, cam.camera.position);
        if (!locked && speed > 0.04 && isStreetPose(playerPos.x, playerPos.z, CAPSULE_RADIUS, collision)) {
          safeAcc += SIM_DT;
          if (safeAcc >= 2) {
            safeAcc = 0;
            events.onSafePose?.(playerPos.x, playerPos.z, motion.yaw);
          }
        } else {
          safeAcc = 0;
        }
        accum -= SIM_DT;
        steps += 1;
      }
      cam.update(
        raw,
        playerPos,
        motion.yaw,
        intent.orbitYawDelta,
        intent.orbitPitchDelta,
        collision,
        viewW,
        viewH,
        walkSpeed,
      );
      lights?.update(raw, playerPos, district.lamps);
      district.update(raw);
      const talkNpc = nearestTalk();
      const nextNear = talkNpc?.id ?? null;
      if (nextNear !== nearId) {
        nearId = nextNear;
        events.onNearNpc(nearId, talkNpc ? `${talkNpc.name} · ${talkNpc.label}` : null);
      }
      prompt.hidden = !talkNpc || locked;
      prompt.textContent = talkNpc ? `[E] Talk · ${talkNpc.name}` : '';
      if (intent.menu) events.onMenu();
      if (!locked && intent.talk && talkNpc) events.onTalk();

      renderBank += raw;
      if (renderBank < 1 / fps) return;
      renderBank %= 1 / fps;
      for (const npc of npcs) {
        npc.character.headWorld(headScratch).project(cam.camera);
        events.onNpcPosition(
          npc.id,
          (headScratch.x * 0.5 + 0.5) * viewW,
          (-headScratch.y * 0.5 + 0.5) * viewH,
          headScratch.z >= -1 && headScratch.z <= 1,
        );
      }
      district.projectSigns(cam.camera, viewW, viewH);
      renderer.render(scene, cam.camera);
      measuredDraws = renderer.info.render.calls;
    });

    await loadAll((id, loaded) => {
      if (!loaded) return;
      assets.set(id, loaded);
      if (id === 'mannequin') {
        blobs.length = 0;
        placeCharacter(makeCharacter(true, assets, 0xe7d6ba, { bag: true }, 'player'));
        placeNpcs(spawnNpcs(world, true, assets));
        placeCrowd(spawnCrowd(true, assets, mobile));
        lights?.update(0, playerPos, district.lamps);
      }
      district.refreshProps();
    });
  } finally {
    loading.remove();
  }

  return {
    setSpeakingNpc(id) { speakingNpc = id; },
    setTimeSlot(slot) {
      timeSlot = slot;
      lights?.setSlot(slot);
    },
    getTimeSlot() { return timeSlot; },
    fps() { return Math.round(measuredFps); },
    draws() { return measuredDraws; },
    getPose() { return { x: playerPos.x, z: playerPos.z, yaw: motion.yaw }; },
    getYaw() { return follow?.yaw ?? 0; },
    setPose(x, z, yaw) { applyPose(x, z, yaw); },
    snapToNpc,
  };
}
