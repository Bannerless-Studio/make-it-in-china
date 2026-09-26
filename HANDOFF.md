# Handoff: Make It in China × silver-tongue

Last updated 2026-09-26. Read this first; everything else is detail.

## Who did what
- **Ishmum bhai:** the idea (earn a living in China, in Mandarin) and the org Bannerless-Studio.
- **Jamil (`silver-tongue`, now `Bannerless-Studio/silver-tongue`):** the whole game engine and content. `packages/core` (rules, dialogue, economy, learner model, saves), `packages/tui` + `tui-node` + `tui-web` (terminal and browser text UI), `content/` (HSK 1 words, scenes, Fluent lines, edge-tts audio), `tools/` (course build, checker, bots). Latest: **0.12.2**.
- **Fiazul (this repo + `packages/world3d`):** the 3D game on top of Jamil's core. Design doc, the procedural Blender asset pipeline and all 140 models, the three.js world, phone controls, Pages deploy. Zero changes inside `core`, `tui*`, `content/`.

## Where things are
- **Play:** https://bannerless-studio.github.io/make-it-in-china/ (built from the `world3d` branch by `.github/workflows/deploy-game.yml`, on push + daily).
- **3D game source:** `packages/world3d` on branch `world3d` of `Fiazul/silver-tongue` (fork). Needs to land in `Bannerless-Studio/silver-tongue` via PR; the earlier PR (`jamil314/silver-tongue#1`) was lost in the repo transfer.
- **Assets source of truth:** this repo `assets/` (GLB + `index.json` + manifests). Regenerate: `blender -b --python tools/blender/build_all.py` (Blender 4.2, ~30 s). world3d vendors the GLBs it uses (`npm run assets:sync -w @silver-tongue/world3d`).
- **Docs:** `docs/design-doc.txt` (the spec), `docs/asset-conventions.md` (axes, anchors, manifests), `docs/silver-tongue-integration.md` (the core↔world seam), `docs/asset-list.md` (build status). `briefs/` is the worker log.
- **Old prototype:** `legacy-prototype/` (standalone Vite game, superseded, keep for reference only).

## Rebase state (what matches what)
- `world3d` is rebased on silver-tongue **0.11.1** (`4b31e4d`) with no conflicts: covers all 13 places/NPCs of 0.11 (Station Road, shop, tea house, stairs), errands, shop prices.
- Rebase onto **0.12.2** (`02704f7`, adds edge-tts audio clips, `setSound` input, `soundSet` event, `audio: string[]` on lines/words, `reactionAudio`) is **in progress**. Until it lands: 3D has no spoken audio and the parity test fails on `setSound`/`soundSet` by design.
- A parity test (`packages/world3d/test/parity.test.ts`) reads the `Input`/`GameEvent` unions from `core/src/types.ts`; any new variant on Jamil's side fails world3d's typecheck/tests until handled. That is the contract.

## Done (verified in browser, desktop + phone emulation)
- Walk the street, enter every place, talk to every NPC, pick/tile replies, tap a word for pinyin+gloss, mentor, notebook, sleep + day card, rent timer, objective line, travel list, save export/import, saved games.
- Errands (carry parcel, deliver), shop purchases with cost shown.
- Faceless characters with a shared rig: idle / walk / talk / carry clips; NPCs face you; held props.
- Phone: joystick, tap-to-walk, action button, portrait + landscape, no zoom/scroll, ~200 draw calls.
- 374 tests (263 upstream + 111 world3d), typecheck clean, build ≈ 10 MB.

## Not done / known gaps
- Audio in 3D (pending the 0.12.2 rebase).
- Walk/idle clips are procedural sine motion. Next quality step: retarget a CC0 mocap library (Quaternius UAL) onto the skeleton; bone names are Mixamo-compatible for this.
- No sit clip: a customer stands on a stool in the noodle shop.
- Cook's `npc_stand` is behind the counter; the street camera can't see him. One number in `assets/buildings/manifest.json`.
- Debug hook `world3d.enter()` doesn't reposition into zone sub-places (school/hospital/station); walking does.
- Doors send `goTo` hop by hop because core has no "enter building" input. Fine, but worth a core input later.
- Tea house interior exists; content has no scene inside it yet.
- No tests run the WebGL path; browser checks are manual (playbook in `silver-tongue/.claude/playbooks/localhost-8173.md`).

## How to work on it
```sh
git clone git@github.com:Fiazul/silver-tongue.git -b world3d && cd silver-tongue   # Node >= 22
npm ci && npm run build:course && npm run dev -w @silver-tongue/world3d           # http://localhost:8173
npm test && npm run typecheck && npm run build -w @silver-tongue/world3d
```
Debug hooks in the browser console: `world3d.state()`, `.talk("wang")`, `.enter("shop")`, `.teleport(x,z)`, `.anim()`, `.errand()`, `.info()`.

## Next steps, in order
1. Land the 0.12.2 rebase; push `world3d`; open the PR to `Bannerless-Studio/silver-tongue` (needs a fork of the org repo or write access).
2. Point `deploy-game.yml` at the org repo once merged.
3. Mocap retarget for walk/idle; sit clip.
4. Move the cook's stand point; add a tea house scene on the content side.
