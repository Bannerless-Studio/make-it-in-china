import { Vector2 } from 'three';
import {
  GAMEPAD_DEADZONE,
  GAMEPAD_LOOK_RATE,
  GAMEPAD_RUN_TRIGGER,
  JOYSTICK_BASE,
  JOYSTICK_BOTTOM,
  JOYSTICK_DEAD,
  JOYSTICK_LEFT,
  JOYSTICK_MAX,
  JOYSTICK_THUMB,
  ORBIT_DEG_PER_PX,
  TOUCH_RUN,
  TOUCH_TALK,
  isPhoneViewport,
} from './constants';

export interface Intent {
  move: Vector2;
  run: boolean;
  talk: boolean;
  menu: boolean;
  orbitYawDelta: number;
  orbitPitchDelta: number;
  source: 'keyboard' | 'gamepad' | 'touch';
}

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.isContentEditable
  );
}

function radial(x: number, y: number, dead: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (length <= dead) return { x: 0, y: 0 };
  const remapped = Math.min(1, (length - dead) / (1 - dead));
  return { x: (x / length) * remapped, y: (y / length) * remapped };
}

const ORBIT_RAD_PER_PX = (ORBIT_DEG_PER_PX * Math.PI) / 180;

export function createInput(root: HTMLElement, canvas: HTMLCanvasElement, isLocked: () => boolean): {
  sample(dt: number): Intent;
  isControl(target: EventTarget | null): boolean;
  dispose(): void;
} {
  const keys = new Set<string>();
  const move = new Vector2();
  const touchMove = new Vector2();
  let source: Intent['source'] = 'keyboard';
  let talkEdge = false;
  let menuEdge = false;
  let orbitYaw = 0;
  let orbitPitch = 0;
  let joystickId: number | null = null;
  let orbitId: number | null = null;
  let wasLocked = isLocked();
  const runPointers = new Set<number>();
  const pointers = new Map<number, { target: HTMLElement; x: number; y: number }>();
  const listeners = new AbortController();

  if (isPhoneViewport()) document.documentElement.dataset.touch = 'true';

  const controls = document.createElement('div');
  controls.id = 'touch-controls';
  controls.innerHTML = `
    <div id="joystick-base" aria-hidden="true"><div id="joystick-thumb"></div></div>
    <button id="touch-run" type="button" aria-pressed="false">Run</button>
    <button id="touch-talk" type="button">Talk</button>`;
  root.append(controls);
  const base = controls.querySelector<HTMLDivElement>('#joystick-base')!;
  const thumb = controls.querySelector<HTMLDivElement>('#joystick-thumb')!;
  const runButton = controls.querySelector<HTMLButtonElement>('#touch-run')!;
  const talkButton = controls.querySelector<HTMLButtonElement>('#touch-talk')!;

  function placeJoystick(px: number, py: number): void {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = px - cx;
    const dy = py - cy;
    const length = Math.hypot(dx, dy);
    const limited = Math.min(length, JOYSTICK_MAX);
    const nx = length > 0 ? (dx / length) * limited : 0;
    const ny = length > 0 ? (dy / length) * limited : 0;
    thumb.style.transform = `translate(${nx}px, ${ny}px)`;
    const analog = radial(nx / JOYSTICK_MAX, -ny / JOYSTICK_MAX, JOYSTICK_DEAD / JOYSTICK_MAX);
    touchMove.set(analog.x, analog.y);
    if (touchMove.lengthSq() > 0) source = 'touch';
  }

  function resetJoystick(): void {
    joystickId = null;
    touchMove.set(0, 0);
    thumb.style.transform = 'translate(0px, 0px)';
  }

  function releaseHeld(): void {
    keys.clear();
    for (const id of pointers.keys()) releasePointer(id);
    talkEdge = false;
    menuEdge = false;
    orbitYaw = 0;
    orbitPitch = 0;
  }

  function onKey(event: KeyboardEvent, down: boolean): void {
    if (!down) {
      keys.delete(event.code);
      return;
    }
    if (event.defaultPrevented || event.repeat || typingTarget(event.target)) return;
    if (event.target instanceof Element && event.target.closest('#ui-overlay, #notebook-panel, select')) return;
    if (event.code === 'Tab') {
      event.preventDefault();
      menuEdge = true;
      return;
    }
    if (isLocked()) return;
    keys.add(event.code);
    if (event.code === 'KeyE') {
      event.preventDefault();
      talkEdge = true;
    }
    source = 'keyboard';
  }

  function controlEl(target: EventTarget | null): boolean {
    return target instanceof Node && controls.contains(target);
  }

  function onPointerDown(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (event.cancelable) event.preventDefault();
    if (isLocked()) return;
    if (target === canvas) {
      if (event.pointerType === 'mouse' && event.button !== 2) return;
      if (orbitId !== null) return;
      orbitId = event.pointerId;
    } else {
      if (event.button !== 0) return;
      if (target === base && joystickId !== null) return;
    }
    pointers.set(event.pointerId, { target, x: event.clientX, y: event.clientY });
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* Chrome Android can throw if capture is requested during pointercancel. */
    }
    if (target === base) {
      joystickId = event.pointerId;
      placeJoystick(event.clientX, event.clientY);
    } else if (target === runButton) {
      runPointers.add(event.pointerId);
      runButton.setAttribute('aria-pressed', 'true');
    }
    if (event.pointerType !== 'mouse' || target !== canvas) source = 'touch';
  }

  function onPointerMove(event: PointerEvent): void {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    if (event.cancelable) event.preventDefault();
    if (isLocked()) {
      releaseHeld();
      return;
    }
    if (event.pointerId === joystickId) {
      placeJoystick(event.clientX, event.clientY);
    } else if (event.pointerId === orbitId) {
      orbitYaw -= (event.clientX - pointer.x) * ORBIT_RAD_PER_PX;
      orbitPitch -= (event.clientY - pointer.y) * ORBIT_RAD_PER_PX;
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }

  function releasePointer(id: number): void {
    const pointer = pointers.get(id);
    if (!pointer) return;
    pointers.delete(id);
    if (id === joystickId) resetJoystick();
    if (id === orbitId) orbitId = null;
    runPointers.delete(id);
    runButton.setAttribute('aria-pressed', String(runPointers.size > 0));
    if (pointer.target.hasPointerCapture(id)) pointer.target.releasePointerCapture(id);
  }

  function onPointerUp(event: PointerEvent): void {
    releasePointer(event.pointerId);
  }

  function readGamepad(dt: number): { move: Vector2; run: boolean; lookYaw: number; lookPitch: number; talk: boolean; menu: boolean } | null {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find(item => item && item.connected);
    if (!pad) return null;
    const stick = radial(pad.axes[0] ?? 0, -(pad.axes[1] ?? 0), GAMEPAD_DEADZONE);
    const look = radial(pad.axes[2] ?? 0, pad.axes[3] ?? 0, GAMEPAD_DEADZONE);
    const buttons = pad.buttons;
    const run = (buttons[6]?.value ?? 0) >= GAMEPAD_RUN_TRIGGER;
    const talk = !!buttons[0]?.pressed;
    const menu = !!buttons[2]?.pressed || !!buttons[9]?.pressed;
    if (stick.x === 0 && stick.y === 0 && look.x === 0 && look.y === 0 && !run && !talk && !menu) return null;
    return {
      move: new Vector2(stick.x, stick.y),
      run,
      lookYaw: -look.x * GAMEPAD_LOOK_RATE * dt,
      lookPitch: -look.y * GAMEPAD_LOOK_RATE * dt,
      talk,
      menu,
    };
  }

  let gamepadTalk = false;
  let gamepadMenu = false;

  const onContext = (event: Event) => {
    if (event.target === canvas || controlEl(event.target)) event.preventDefault();
  };
  const listenerOptions = { signal: listeners.signal };
  const pointerOptions = { signal: listeners.signal, passive: false };
  addEventListener('keydown', event => onKey(event, true), listenerOptions);
  addEventListener('keyup', event => onKey(event, false), listenerOptions);
  addEventListener('blur', releaseHeld, listenerOptions);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseHeld(); }, listenerOptions);
  for (const target of [base, runButton, canvas] as HTMLElement[]) {
    target.addEventListener('pointerdown', onPointerDown, pointerOptions);
    target.addEventListener('touchstart', event => {
      if (event.cancelable) event.preventDefault();
    }, pointerOptions);
    target.addEventListener('touchmove', event => {
      if (event.cancelable) event.preventDefault();
    }, pointerOptions);
  }
  talkButton.addEventListener('click', () => {
    if (isLocked()) return;
    source = 'touch';
    talkEdge = true;
  }, listenerOptions);
  addEventListener('pointermove', onPointerMove, pointerOptions);
  addEventListener('pointerup', onPointerUp, listenerOptions);
  addEventListener('pointercancel', onPointerUp, listenerOptions);
  addEventListener('lostpointercapture', onPointerUp, listenerOptions);
  addEventListener('contextmenu', onContext, listenerOptions);
  addEventListener('gamepaddisconnected', releaseHeld, listenerOptions);

  return {
    sample(dt: number): Intent {
      const locked = isLocked();
      if (locked && !wasLocked) releaseHeld();
      wasLocked = locked;
      runButton.disabled = locked;
      talkButton.disabled = locked;
      const keyboard = new Vector2(
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
      );
      if (keyboard.lengthSq() > 1) keyboard.normalize();
      const pad = readGamepad(dt);
      if (keyboard.lengthSq() > 0) source = 'keyboard';
      else if (touchMove.lengthSq() > 0) source = 'touch';
      else if (pad && pad.move.lengthSq() > 0) source = 'gamepad';

      if (source === 'touch') move.copy(touchMove);
      else if (source === 'gamepad' && pad) move.copy(pad.move);
      else move.copy(keyboard);
      if (move.lengthSq() > 1) move.normalize();

      let talk = talkEdge;
      let menu = menuEdge;
      talkEdge = false;
      menuEdge = false;
      if (pad) {
        if (pad.talk && !gamepadTalk) talk = true;
        if (pad.menu && !gamepadMenu) menu = true;
        gamepadTalk = pad.talk;
        gamepadMenu = pad.menu;
        orbitYaw += pad.lookYaw;
        orbitPitch += pad.lookPitch;
      } else {
        gamepadTalk = false;
        gamepadMenu = false;
      }

      const intent: Intent = {
        move: move.clone(),
        run: runPointers.size > 0 || !!pad?.run || keys.has('ShiftLeft') || keys.has('ShiftRight'),
        talk,
        menu,
        orbitYawDelta: orbitYaw,
        orbitPitchDelta: orbitPitch,
        source,
      };
      orbitYaw = 0;
      orbitPitch = 0;
      return intent;
    },
    isControl: controlEl,
    dispose() {
      releaseHeld();
      listeners.abort();
      controls.remove();
    },
  };
}

export const TOUCH_LAYOUT = {
  base: JOYSTICK_BASE,
  thumb: JOYSTICK_THUMB,
  left: JOYSTICK_LEFT,
  bottom: JOYSTICK_BOTTOM,
  run: TOUCH_RUN,
  talk: TOUCH_TALK,
};
