# TODO after v0.0.1

Known gaps found in the 2026-09-18 release checks. Fix in v0.0.2 unless noted.
- `#hud-objective` says the same "洗碗 shift at 面馆" for scenes 1–3; show "shift 2 of 3" or the scene's own title.
- Speech clips are stale after the 2026-09-18 line-length pass: `node scripts/tts.mjs --validate` reports 151 clips whose text changed and 113 clips with no manifest entry (22 new review exchanges plus the 20 ambient lines). Run `npm run tts` before shipping audio.
- No audio yet (design doc: pre-generated TTS, one clip per line). Replay button is disabled. Needs a TTS provider decision from the owner.
- Rodin (hyper3d.ai) props not generated: the Playwright browser is not logged in. Log in once, then rerun the asset brief (briefs/ — Part 1) to spend the 16 credits on lantern/steamer/signboard props.
- Only 3 of 25 scenes exist; scene-list.md has the rest. Content writing is the bottleneck from here (design doc: pipeline matters from day one).
- Level checker rule 4 (every word in ≥3 scenes) is WARN until scenes.json has ≥20 scenes; flip to FAIL then.
- Mentor scenes, rent-due landlord bubble, and hidden-repetition slot filling are implemented in the engine but not exercised by content yet.
- Character LOD1 GLB and Blender carry/wave/nod/shake clips are still planned; runtime falls back to Idle_Loop/Interact.
- Stage 8a parametric district (toon shells, street furniture, four day-slot palettes, outfit attachments) is in; optional Blender GLBs from `scripts/blender/` are still ungenerated. UI skin is a separate ticket.
- Cursor workers run without a shell (auto-mode blocks `--yolo`); the orchestrator runs tsc/tests for them. Allowing `agent-delegates run` in Bash permissions removes that hop.

## Engine → UI wiring (stage 7 engine landed 2026-09-18; no UI/render caller yet)
The engine commands below exist, are tested, and are unreachable from the browser until `src/main.ts`,
`src/ui/*` and `src/render/*` call them. See docs/PLAN.md "Engine decisions (stage-7 progression)".
- `completeWorldTask(taskId)` — the renderer must fire it when the player reaches the delivery trigger
  (`state().pendingWorldTask.targetTriggerId`); until then S08/S09/S21 stop after their delivery exchange.
  `SceneEvents` has no arrival callback yet (ticket 7.4).
- `abandon()` — "leave conversation" in the pause/dialogue UI; keeps the spent slot, pays nothing.
- `markAssisted(words, reason)` — call on pinyin-default render, hint reveal and gloss tap (once per attempt,
  not per redraw) so assisted answers stop promoting words.
- `recordExposure(words, source)` — explicit sign/ambient taps only.
- `queryGate()` / `claimGate()` — gate panel at `phase2_gate`; claim only after the reward/rent settlement.
- `start(id, { purchase: 'look' })` — catch the `Not enough money…` CommandError from `start` and offer the
  look-only variant (S10 bus, S12 fruit, S22 top-up).
- Completions must read `state().progress.completedOn/completedCount`; drop the parallel `uiState.completedOn`
  map in `src/main.ts` and the `make-it-in-china.ui.v1` key once the HUD reads engine progress.
- Remove the `starterWords` shortcut in `src/main.ts` that pre-seeds S01 requirements; S00 teaches them and
  `afterScenes` now gates S01 (TDD 1.1).
- Save recovery: `importString` migrates v1 saves through `migrateV1`, but `src/main.ts` still writes the
  legacy `make-it-in-china.save.v1` key and deletes rejected saves; move to the v2 envelope key and keep the
  original string for "Export original / Cancel" recovery (TDD 8, ticket 6.7a/6.7b).
- HUD/notebook can show `state().activity` (frozen slot label, penalty total, pending purchase) and
  `state().progress.inventory` (bus ticket, fruit, top-up, carry strap).
- Deferred engine work, not started: evidence for hint/pinyin assistance beyond `markAssisted` (ticket 6.4),
  telemetry aggregates and export (7.7), and the audio-manifest variant IDs per slot tuple (6.3).
- Content wart found while wiring slots: `number_1_10` value `n02` is 二十 ("twenty", words 二+十), so the
  TDD 6.1 pair rule (1↔2) locks 一 out of every count slot until 十 is met. Fix the pool value to 二.

## Handoff 2026-09-18 evening (v0.1 build, uncommitted at time of writing)
Snapshot served with `npx vite preview --port 4173`. All gates green: tsc, 271 tests, both content checkers, 881 speech clips validated.

### Render / controls (from browser smoke v3, docs/screenshots/v3-*.png)
- Morning (M) and midday (A2) lighting still indistinguishable in practice; evening sky reads saturated orange, spec says muted grey-blue fog tint.
- Background pedestrians/cyclist (src/render/crowd.ts) not observed moving or yielding; check the crowd tick is called from the scene loop and that `__debug.draws()` (36 at spawn) matches the 163 estimate: the crowd may not be spawning at all.
- Player back attachments (satchel/parcel) not visible from behind; run FOV widen and camera look-ahead not detectable.
- Camera clips inside geometry when running straight into a wall (occlusion pull-in overshoot).
- `__debug.teleport` does not reset facing; End-day sleep confirm sheet was skipped in one run (regression check).
- S back-pedals facing away but plays the forward walk clip; needs a backward-walk clip (Blender or UAL).
- Blender-generated GLBs in public/models/generated/ are built but not loaded by the renderer.

### Engine → UI / render wiring (see section above written by the engine worker)
- `completeWorldTask` must be called by the renderer on delivery trigger arrival (S08/S09/S21 dead-end otherwise); parcel carry visual (ticket 7.4).
- Gate card "Later" dismissal is session-only.

### Content
- Native Mandarin review of the 881 clips still pending (OD2). Review sheet: docs/design/review-sheet.tsv.
- 12 consequence scenes still use short stock lines.

### Vendors
- Cursor API-billed models and Grok CLI exhausted until 2026-10-16 / top-up; Claude Sonnet/Opus subagents used as fallback. Codex weekly ~4%.
