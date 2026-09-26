# world3d: play skeletal clips instead of the procedural bob

Repo: /home/fiazul/Desktop/make-it-in-china/silver-tongue, branch world3d (uncommitted work; do not commit/push). Node: `export PATH="$HOME/.local/node22/bin:$PATH"`. Read packages/world3d/README.md, src/player.ts, src/world.ts, src/game.ts first. A Blender worker is concurrently re-exporting assets/characters/*.glb with rigs; the contract below is fixed. Until the new GLBs land, develop against the contract and keep the procedural bob as the fallback when a GLB has no clips.

## Contract (from the rig brief)
- Human GLBs contain one skinned mesh + armature; clips named `idle`, `walk`, `talk`, `carry_idle`, `carry_walk`; pets `idle`. 24 fps, loops seamless, walk in place, stride_m in `assets/characters/manifest.json` under `rig.stride_m`.
- Bones `HeadTop`, `RightHandGrip`, `LeftHandGrip` for bubble anchor and held props.
- Rest pose relaxed arms-down.

## Tasks
1. One `CharacterActor` class: loads GLB (SkeletonUtils.clone for instances so skins clone correctly), AnimationMixer, crossfade between states: idle ↔ walk (driven by movement speed), talk (while a scene is active and this NPC's line is being shown; the player uses idle during scenes), carry_* when a held-prop flag is set. Fallback: if no clips, use the existing bob.
2. Walk speed = stride_m / walk clip duration × playback rate; scale clip timeScale so feet don't slide at the chosen move speed.
3. Speech bubble anchors to `HeadTop` bone world position (replace the manifest head_top usage). Held props: attach to grip bones (cook: ladle; foreman: clipboard; landlord: key_ring; wang: folding_fan) — take the mapping from layout.json, add a `heldProp` field.
4. NPCs idle by default; when the player is within 3 m they turn to face the player (smooth yaw), during a scene the NPC faces the player and the player faces the NPC.
5. Pets: play `idle`.
6. Update the smoke test only if needed (actor logic is DOM/WebGL-bound; keep it out of tests or test the state machine in isolation).
7. README: animation section.

## Acceptance
- [ ] `npm run typecheck`, `npm test` green (paste tails). `npm run build -w @silver-tongue/world3d` ok.
- [ ] A headless script or test proves the state machine transitions (idle→walk→idle, talk on/off, carry on/off) and the timeScale math.
- [ ] Report DONE / ACCEPTANCE / VERIFICATION / FILES TOUCHED / OPEN QUESTIONS, ending with "ready for browser verification" and the dev command (server may already be running on 8173; if the watcher rebuilds automatically say so).
- You are the SOLE executor; no delegation, no browser. Ambiguity → OPEN QUESTIONS.
