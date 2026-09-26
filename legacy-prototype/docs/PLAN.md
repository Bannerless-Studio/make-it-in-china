## Documentation map
- Use `CLAUDE.md` for architecture and repository directives, and module READMEs for area maps.
- Use `README.md` for end-user setup, usage, and configuration.
# Make It in China — build plan

Source of truth for scope: `docs/design-doc.txt` (PDF in `docs/design-doc.pdf`). This file adds
what the doc leaves to the implementer: layout, contracts, assumptions, tonight's split.

## Assumptions (owner can overturn any — each is a one-line change)
- Open questions from the doc answered with defaults: adult self-learners; English-only glosses;
  blank featureless head is acceptable; fictional generic city; fixed protagonist; private test
  release; animals left out of Phase 1.
- One repo, static Vite site, no backend, no accounts. Node 20, npm.
- Stage 6 speech uses checked-in Opus clips and native Web Audio; it adds no runtime dependency.
- Playwright is a devDependency to add for `npm run e2e:mobile` (Pixel 7 touch script against a preview server). It is not a runtime dependency. This sandbox could not run `npm install`; add `"playwright": "^1.55.0"` under devDependencies and refresh the lockfile.
- Grey boxes first. Toon + outline exists as a toggle from day one because it is cheap in three.js,
  but no time is spent on art until M4 feedback.

## Smallest thing that proves the loop (tonight → M1)
Noodle shop, one job (dishwasher), 3 scenes, pick-a-reply, wallet changes, word states change,
notebook fills. Check: a tester can play 3 scenes in the browser and the notebook shows ~15 words
with states. Stop signal: if scripted pick-a-reply in a 3D box feels no better than a flashcard,
rethink before M3.

## Layout
```
docs/          design doc, PLAN.md, CREDITS.md
content/phase1/words.json scenes.json world.json scene-list.md
scripts/check-level.mjs     level checker (node, zero deps) — runs in `npm run check:content`
src/main.ts                 boot: load content, build world, start dialogue runner
src/content/types.ts        THE CONTRACT (below). All workers import from here.
src/engine/                 pure TS, no DOM/three: dialogue.ts learner.ts economy.ts store.ts save.ts slots.ts
src/audio/                  browser-only manifest resolution, playback, cache, and volume settings
src/render/                 three.js: scene.ts camera.ts toon.ts character.ts world.ts input.ts
src/ui/                     DOM over canvas: bubble.ts hud.ts notebook.ts
tests/                      vitest, engine + checker only
briefs/                     delegate briefs (history)
```

## Contract: content types (src/content/types.ts)
```ts
export type WordId = string;               // the hanzi itself, e.g. "杯子"
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
export interface SlotPool { id: string; values: { hanzi: string; pinyin: string; en: string; words: WordId[] }[] }
export interface Location { id: string; name: string; position: [number,number]; signs: string[] }
export interface Npc { id: string; name: string; label: string; location: string; color: string; headwear?: string; prop?: string }
export interface World { phase: number; locations: Location[]; npcs: Npc[]; slotPools: SlotPool[] }
```
Slots: `{n}` in `line.hanzi` is filled from `slotPools[slots.n]`; the filled value's `words` are
appended to the line's word tags at runtime. `Reply.correct` marks the intended answer for
pick-a-reply and is authoritative in Phase 1. `check` is an opaque analytics tag (e.g. `count_and_table`);
the runner records it in the event log and does not evaluate it. Slot bindings are SCENE-scoped: a
slot filled in exchange 2 (`{cup_count}`) stays bound for the rest of the scene, and `{name}` in any
later line or reply (hanzi/pinyin/en each substituted from the pool value's matching field) reuses
it. A placeholder with no binding in scope is a content error: checker rule 6 fails the build, and
the runner throws `ContentError`.

## Level checker rules (scripts/check-level.mjs) — fail the build if
1. a line uses a word above the scene's phase not in `introduces` and not `bonus`;
2. an exchange introduces >2 new words;
3. `line.words` ≠ longest-match segmentation of `line.hanzi` against words.json (+slot placeholders, punctuation ignored);
4. any phase-list word appears in <3 scenes; 5. a line lacks pinyin/en/audio id;
6. a `{placeholder}` in a line or reply has no slot binding in scope (see contract).

## Tonight (2026-09-18) — delegate split
| # | Worker | Owns | Depends on |
|---|--------|------|-----------|
| A | Cursor | scaffold: Vite+TS+three, types.ts, grey-box noodle shop, faceless capsule char, click-to-walk grid, fixed camera, toon toggle | — |
| B | Cursor | content: words.json (HSK1 150), scene-list.md (M0, ~25 scenes), 3 vertical-slice scenes, world.json, check-level.mjs | types contract only |
| C | Codex astra | engine: dialogue runner, learner model, economy, store, save/load + vitest | A (package.json) |
| D | Cursor | ui: bubble/hud/notebook wiring engine→DOM; playable M1 | A, B, C |
Video-reference notes (Astra three.js demos) land in `docs/reference-videos.md` and feed D/A's polish.

## Rules for workers
No commits (orchestrator commits). Zero new runtime deps beyond three, zustand (optional). Content
must pass `npm run check:content`. Faceless rule applies to every mesh. No loans/gambling/alcohol
content. Pinyin with tone marks only.

## Engine decisions (2026-09-18, after review R1)
- `availableScenes()` excludes `kind: 'consequence'`; consequences are only entered via `onWrong`.
- Reply-origin words record `firstSeen` from the reply (sentence = reply hanzi, audio = `Reply.audio`
  if present, else undefined). `Reply.audio` is optional in the contract.
- Rent: one outstanding week at a time. A missed week stays due; each new rent day re-arms grace and
  the due amount stays one week (older weeks forgiven). Emits `rentDue` event. No debt, no interest.
- `DialogueFrame.newWords: WordId[]` is part of state so the UI can underline first appearances after reload.
- `tapWord` on any word present in the current exchange (line or replies) is legal: meet-then-down.
- Engine must never softlock: `sleep()` abandons an active dialogue (no reward), and the scene pre-scan
  checks slot-pool eligibility and cross-scene `next` availability for every reachable exchange.

## Engine decisions (2026-09-18, stage-7 progression: TDD 1.1, tickets 7.1/7.2/7.5/7.6)
- Save envelope is `v: 2`. `loadJSON`/`decodeSave` accept v2 only; v1 enters through the named
  `migrateV1` adapter, which `importString` calls after an `UnsupportedSaveVersionError` for v1.
  Migration preserves wallet, day, slots, rules, RNG, word states and any open dialogue/return stack,
  adds empty durable maps, pays nothing, and is idempotent on re-import.
- `state().progress` (completedOn, completedCount, inventory, mentorTopics, gateReachedDay,
  onboardingWaived) is durable and authoritative; completion is never reconstructed from the event ring.
- The day's slot label derives from spent action slots: `M` before the first action, `A1…A4` for the
  action about to be spent, `E` once all slots are gone. An activity freezes its label on entry.
- `Scene.repeatable === false` blocks a second successful run; repeatable scenes may repeat within the
  same day while slots remain (GDD 5.4 "three S01 shifts"). Undeclared metadata leaves v1 content free.
- Wrong-reply penalties charge the first miss of each exchange only, capped at ¥5 per parent activity
  (`state().activity.penaltyTotal`); further misses only replay the reaction.
- `Scene.purchase`: `optional-entry` charges atomically at `start`, rejecting an unaffordable buy so the
  UI can re-enter with `{ purchase: 'look' }`; `withhold-first-reward` withholds the price from the first
  successful reward once and grants the item then. Abandoning charges nothing and grants nothing.
- `Exchange.guidedConsequence` enters its scene once per activity with no penalty and no extra slot, then
  resumes the parent's next exchange through `DialogueFrame.returnMode = 'advance'`.
- `Exchange.taskAfterCorrect` parks a durable `pendingWorldTask`; `reply()` is rejected until
  `completeWorldTask(taskId)` presents the next exchange. Wrong or duplicate task IDs are rejected.
- Events keep the nine original names and add `transaction`, `assisted`, `gate`, `activityEnd`; every
  event carries `day` and the monotonic `commandSeq` of its command.
- Gate: `queryGate()` is pure (`met`/150 non-bonus HSK1 words, wallet/150); `claimGate()` records
  `gateReachedDay` once after rent settlement and never debits savings.
