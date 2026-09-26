export type StrictSeverity = 'FAIL' | 'WARN';

export interface StrictIssue {
  rule: number;
  severity: StrictSeverity;
  siteId: string;
  message: string;
}

export interface ContentSite {
  id: string;
  sceneId: string;
  exchangeId: string;
  kind: 'line' | 'reply' | 'hint' | 'slot' | 'sign' | 'ambient';
  value: {
    hanzi?: string;
    pinyin?: string;
    en?: string;
    audio?: string;
    words?: string[];
  };
}

export interface StrictResult {
  issues: StrictIssue[];
  failed: boolean;
  sites: ContentSite[];
  coverage: {
    rows: { word: string; sceneCount: number; scenes: string[] }[];
    targetWords: number;
    placementsTotal: number;
    bonusWords: number;
  };
  exchangeNovelty: Map<string, string[]>;
  familiarity: { numerator: number; denominator: number; ratio: number; newTypes: string[] };
}

export function legacyCoverageScenes(scenes: unknown[]): unknown[];

export function ambientRows(ambient: unknown): Array<Record<string, unknown>>;

export function listContentSites(
  scenes: unknown[],
  world: unknown,
  ambient?: unknown,
): ContentSite[];

export function checkStrictContent(
  words: unknown[],
  scenes: unknown[],
  world: unknown,
  wordAudioMap?: Record<string, string> | null,
  ambient?: unknown,
): StrictResult;

export const strictRuleNumbers: number[];
