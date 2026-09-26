export const WALK_SPEED = 2.4;
export const RUN_SPEED = 4.0;
export const CARRY_SPEED = 1.8;
export const NPC_WALK_SPEED = 1.2;
export const ACCEL = 12;
export const BRAKE = 18;
export const TURN_RATE = (540 * Math.PI) / 180;
export const CAPSULE_HEIGHT = 1.7;
export const CAPSULE_RADIUS = 0.28;
export const WALL_SKIN = 0.03;
export const NPC_SOFT_RADIUS = 0.32;
export const COLLISION_ITERATIONS = 3;
export const SIM_DT = 1 / 60;
export const MAX_ACCUM = 0.1;
export const MAX_SUBSTEPS = 6;
export const IDLE_SPEED = 0.08;
export const RUN_ENTER_SPEED = 2.8;
export const RUN_EXIT_SPEED = 2.5;
export const WALK_RATE_REF = 2.4;
export const WALK_RATE_MIN = 0.5;
export const WALK_RATE_MAX = 1.25;

export const BLEND_LOCO = 0.18;
export const BLEND_TALK = 0.12;
export const BLEND_CARRY = 0.2;
export const BLEND_EMOTE = 0.1;
export const BLEND_SIT = 0.25;

export const TALK_RANGE = 1.8;
export const TALK_EXIT_RANGE = 2.1;
export const TALK_FACING_DOT = 0.5;
export const TALK_HALF_ANGLE = Math.PI / 3;

export const CAMERA_FOV = 45;
export const CAMERA_FOV_RUN = 48;
export const CAMERA_LOOKAHEAD = 0.6;
export const LAMBDA_LOOKAHEAD = 3.5;
export const LAMBDA_FOV = 4;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 100;
export const CAMERA_DISTANCE = 9;
export const CAMERA_PITCH = (35 * Math.PI) / 180;
export const CAMERA_PITCH_DEFAULT = (22 * Math.PI) / 180;
export const CAMERA_PITCH_INTERIOR = (34 * Math.PI) / 180;
export const CAMERA_PITCH_MIN = (20 * Math.PI) / 180;
export const CAMERA_PITCH_MAX = (55 * Math.PI) / 180;
export const CAMERA_TARGET_Y = 1;
export const CAMERA_FOOT_SCREEN = 0.64;
export const LAMBDA_POSITION = 8;
export const LAMBDA_AIM = 12;
export const LAMBDA_YAW = 5;
export const LAMBDA_OCCLUDE_EXTEND = 5;
export const OCCLUDE_RADIUS = 0.25;
export const OCCLUDE_SKIN = 0.15;
export const OCCLUDE_MIN = 1.2;
export const OCCLUDE_MAX = 9;
export const ORBIT_DEG_PER_PX = 0.18;
export const GAMEPAD_LOOK_RATE = (90 * Math.PI) / 180;
export const RECENTER_IDLE = 1.5;
export const ROOF_FADE = 0.15;

export const GAMEPAD_DEADZONE = 0.18;
export const GAMEPAD_RUN_TRIGGER = 0.5;
export const JOYSTICK_BASE = 112;
export const JOYSTICK_THUMB = 48;
export const JOYSTICK_MAX = 40;
export const JOYSTICK_DEAD = 8;
export const JOYSTICK_LEFT = 80;
export const JOYSTICK_BOTTOM = 96;
export const TOUCH_RUN = 48;
export const TOUCH_TALK = 56;

export const LOD0_DISTANCE = 12;
export const LOD1_DISTANCE = 14;
export const LOD_HYSTERESIS = 2;
export const FAR_ANIM_HZ = 15;
export const DESKTOP_FPS = 60;
export const PHONE_FPS = 30;
export const DESKTOP_DPR = 1.5;
export const PHONE_DPR = 1;
export const SIGN_MAX_DISTANCE = 14;
export const SIGN_MAX_VISIBLE = 16;
export const SIGN_NEAR_DISTANCE = 8;

export const WALL_HEIGHT = 3.2;
export const ROOF_LIP = 0.6;
export const DOOR_WIDTH = 2.4;
export const DOOR_HEIGHT = 2.6;
export const HEAD_HEIGHT = 0.2833;
export const OUTLINE_EXPANSION = 0.025;
export const OUTLINE_COLOR = 0x171717;
export const SMALL_PROP_HULL = 0.15;
export const DEGENERATE_THICKNESS = 0.02;
export const BLOB_RADIUS = 0.4;
export const BLOB_ALPHA = 0.18;
export const LIGHT_DIR: [number, number, number] = [-12, 18, -8];
export const LIGHT_INTENSITY = 2;
export const HEMI_INTENSITY = 1.2;
export const DAY_TRANSITION = 1.5;
export const DAY_TRANSITION_REDUCED = 0.15;
export const SHADOW_MAP = 1024;
export const SHADOW_SPAN = 24;
export const SHADOW_NORMAL_BIAS = 0.02;
export const SHADOW_GRAZE_BIAS = 0.05;

export const CROWD_SPEED = 1.2;
export const CROWD_YIELD_RADIUS = 1.5;
export const CROWD_YIELD_PUSH = 1.1;
export const CROWD_ANIM_CUTOFF = 25;
export const CYCLIST_SPEED = 3.2;

export const DECAL_WEAR = 0.1;
export const DECAL_DOORWAY = 0.13;
export const DECAL_CONTACT = 0.26;
export const DECAL_SHADE = 0.16;
export const DECAL_IRON = 0.55;
export const SKYLINE_NEAR = 0x8b949c;
export const SKYLINE_FAR = 0xa3acb3;
export const SKYLINE_TINT = 0.55;
export const SKYLINE_SATURATION = 0.45;
export const ARRIVAL_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [0.7, 0],
  [-0.7, 0],
  [0, 0.7],
  [0, -0.7],
];

export const CLIP_MAP = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Jog_Fwd_Loop',
  talk: 'Idle_Talking_Loop',
  sit: 'Sitting_Idle_Loop',
  sitEnter: 'Sitting_Enter',
  sitExit: 'Sitting_Exit',
  pickup: 'PickUp_Table',
  interact: 'Interact',
  carry: 'Idle_Loop',
  wave: 'Interact',
  nod: 'Idle_Loop',
  shake: 'Idle_Loop',
} as const;

export type ClipRole = keyof typeof CLIP_MAP;

export const PALETTE = {
  ink: 0x171717,
  paper: 0xfff7e7,
  plaster: 0xe7d6ba,
  paving: 0xcbbca6,
  wood: 0x936c4c,
  terracotta: 0xc65d3b,
  sage: 0x6d8963,
  slate: 0x526d82,
  ochre: 0xd7ad55,
  teal: 0x455a64,
  plum: 0x7e57c2,
  umber: 0x8d6e63,
  olive: 0x5b7c4d,
  clay: 0xb56a3d,
  periwinkle: 0x5c6bc0,
  skinA: 0xcfa77d,
  skinB: 0x98755c,
  focus: 0x245d72,
} as const;

export type PaletteRole = keyof typeof PALETTE;

export const MORNING = {
  sky: 0xdce9e7,
  fogNear: 28,
  fogFar: 82,
  fogDensity: 0.01,
  sun: 0xfff0cf,
  hemiSky: 0xe8f1ea,
  hemiGround: 0xb6a489,
  shadowTint: 0x7d939b,
} as const;

export function expSmooth(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}

export function isPhoneViewport(): boolean {
  const touches = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0;
  if (touches > 1) return true;
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches;
}
