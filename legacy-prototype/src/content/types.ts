export type WordId = string;
export interface Word { hanzi: WordId; pinyin: string; en: string; hsk: 1|2|3|4; bonus?: boolean; pos?: string }
export type WordState = 'unseen'|'met'|'shaky'|'known';
export interface Line { hanzi: string; pinyin: string; en: string; audio: string; words: WordId[] }
export interface Reply { hanzi: string; pinyin?: string; en?: string; words?: WordId[]; audio?: string;
  id?: string; action: string; check?: string; correct?: boolean; next?: string }
export interface Exchange { id: string; line: Line; slots?: Record<string,string>; replies: Reply[]; onWrong?: string;
  introduces?: WordId[]; tests?: WordId[]; hint?: Line;
  taskAfterCorrect?: { taskId: string; targetTriggerId: string; propId: string };
  guidedConsequence?: string }
export interface Scene { id: string; phase: 1|2|3|4; location: string; npc: string; kind: 'story'|'job'|'errand'|'mentor'|'consequence';
  requires: WordId[]; introduces: WordId[]; reward?: number; cost?: number; exchanges: Exchange[];
  curriculumIndex?: number; minDay?: number; afterScenes?: string[];
  allowedSlots?: ('M'|'A1'|'A2'|'A3'|'A4'|'E')[]; repeatable?: boolean;
  purchase?: { itemId: string; price: number; mode: 'optional-entry'|'withhold-first-reward' } }
export interface SlotPoolValue { id: string; hanzi: string; pinyin: string; en: string; words: WordId[] }
export interface SlotPool { id: string; values: SlotPoolValue[] }
export type TimeSlot = 'M'|'A1'|'A2'|'A3'|'A4'|'E';
export type DoorSide = 'north'|'south'|'east'|'west';
export type TriggerAction = 'talk'|'bed'|'gate'|'delivery';
export interface LocationDoor { position: [number, number, number]; yaw: number }
export interface LocationFootprint { center: [number, number]; size: [number, number] }
export interface Location {
  id: string;
  name: string;
  position: [number, number];
  signs: string[];
  door?: LocationDoor;
  footprint?: LocationFootprint;
}
export interface Npc {
  id: string;
  name: string;
  label: string;
  location: string;
  color: string;
  headwear?: string;
  prop?: string;
  asset?: string;
}
export interface WorldAsset { glb: string; lod1?: string }
export interface WorldMesh {
  id: string;
  asset?: string;
  position: [number, number, number];
  yaw: number;
  scale: [number, number, number];
  palette?: string;
  kind?: 'building'|'prop'|'ground';
  location?: string;
}
export interface WorldCollider {
  id: string;
  shape: 'box'|'boundary'|'roomWalls';
  center?: [number, number, number];
  half?: [number, number, number];
  min?: [number, number];
  max?: [number, number];
  size?: [number, number];
  doorSide?: DoorSide;
  doorWidth?: number;
  thickness?: number;
  height?: number;
  disabledWhen?: string;
}
export interface WorldSpawn { id: string; position: [number, number, number]; yaw: number }
export interface WorldWaypoint { id: string; position: [number, number]; neighbors: string[] }
export interface WorldTrigger {
  id: string;
  action: TriggerAction;
  position: [number, number, number];
  radius?: number;
  half?: [number, number, number];
  npc?: string;
  scene?: string;
}
export interface WorldSign {
  id: string;
  location: string;
  text: string;
  position: [number, number, number];
  yaw: number;
  fontRole: 'shop'|'label';
}
export interface World {
  phase: number;
  locations: Location[];
  npcs: Npc[];
  slotPools: SlotPool[];
  schemaVersion?: number;
  bounds?: { min: [number, number, number]; max: [number, number, number] };
  assets?: Record<string, WorldAsset>;
  meshes?: WorldMesh[];
  colliders?: WorldCollider[];
  spawns?: WorldSpawn[];
  waypoints?: WorldWaypoint[];
  schedules?: Record<string, Partial<Record<TimeSlot, string>>>;
  triggers?: WorldTrigger[];
  signs?: WorldSign[];
}
