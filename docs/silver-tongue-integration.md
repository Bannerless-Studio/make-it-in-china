# Integrating these assets with silver-tongue (Jamil's engine)

Scouted 2026-09-26 from https://github.com/jamil314/silver-tongue (shallow clone).

## The seam

`packages/core` is a pure engine: no DOM, no Node, no rendering.

```ts
// packages/core/src/core.ts
export interface Core { readonly state: GameState; send(input: Input): GameEvent[]; }
createCore(course, state, { now, rng })
```

Drive it with `send(input)`, read the returned `GameEvent[]`, re-read `core.state`. `Input` and `GameEvent` (packages/core/src/types.ts:209-253) are declared a stable contract for the 3D front end (docs/superpowers/plans/2026-09-25-milestone-a-terminal-demo.md:13). Do NOT build on the TUI's `Terminal` interface; that is text-only.

His own spec (docs/superpowers/specs/2026-09-25-silver-tongue-design.md) already plans `packages/world3d` (three.js), `packages/ui` (Preact overlay: speech bubble, reply panel, HUD, notebook, mentor) and `packages/view` (screen-free shared logic). None exist yet. The spec matches our design doc: faceless characters, toon + outline, grey boxes first, fixed content, no LLM.

## Events the world must render

| Event | What the 3D world does |
|---|---|
| sceneStarted | lock movement, ease camera to npc_stand / player_stand anchors |
| lineSpoken {npc, line: RenderedLine{text, tokens[], audio?}} | speech bubble on NPC; play clip id; tokens give per-word spans for tap-to-gloss |
| replyOptions {options | tiles} | reply panel (pick mode for Phase 1) |
| actionPerformed {action, matched, diff} | prop animation (bowl set down, box handed over) |
| npcReacted / lineRephrased | gesture anim, bubble update |
| walletChanged, trustChanged, wordStateChanged, rankChanged | HUD |
| sceneEnded, dayEnded | unlock movement, day transition |

Inputs the world sends: `goTo(place)` when the player walks into a place trigger zone, `talkTo`/`startScene` on E/tap near an NPC, `reply({choice})`, `sleep`.

## Content vs our assets

- `content/settings/china-city/world.json`: places are a graph of named nodes with `links`, NPCs are `{place}`. No coordinates. Spatial layout is entirely ours: map each place name to a building GLB + trigger zone, each NPC name to a character GLB + the building's `npc_stand` anchor from `assets/<set>/manifest.json`.
- Scenes: `content/settings/china-city/scenes/*.json` skeletons + Fluent `.ftl` lines per language. Lines get per-word `tokens` at build time via an NLP tagger, so the design doc's level checker / learner model already exists in his pipeline.
- Save: one JSON `GameState`, `serialize`/`parseSave`, versioned. Same save works in TUI and 3D.

## First slice to build (packages/world3d)

1. New workspace package depending only on `@silver-tongue/core`; esbuild entry mirroring `packages/tui-web/build.mjs`; localStorage adapter mirroring `web-storage.ts`.
2. Load `assets/index.json`; place `road_*` tiles and buildings from a small `layout.json` we own (place name → building, position, rotation).
3. Player walk (click/tap to point on navgrid), place trigger zones → `goTo`.
4. NPC at `npc_stand`; E/tap → `startScene`; render `lineSpoken` as HTML bubble; `replyOptions` pick panel; `actionPerformed` → nothing fancy yet.
5. Toon material + outline pass on the GLBs; verify on a phone.

Node ≥ 22. `npm run build:course` must pass before anything loads.
