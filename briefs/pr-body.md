## Silver Tongue 3D: a three.js front end for the core

Assalamu alaikum bhai. This is the world module we talked about: a 3D street built on top of `@silver-tongue/core`, as a sibling of `tui-web`. Nothing in `core`, `tui`, or `content/` changed.

**Play it:** once merged, Pages serves it at `/world3d/` next to the TUI. Until then: https://fiazul.github.io/silver-tongue/world3d/

### What it is
- `packages/world3d`: three.js + plain DOM, driven only by `core.send(input) → GameEvent[]`. Same save format and localStorage keys as `tui-web`, so a save moves between terminal, TUI-web and 3D.
- Every `Input` and `GameEvent` variant is handled; a parity test reads the unions from `core/src/types.ts` so a new input fails our typecheck rather than silently going unhandled. Parity table in the package README.
- Places from `world.json` are walkable spaces: Main Street, and interiors for the noodle shop, room and warehouse. NPCs stand at anchor points from the asset manifests. Doors, a bed you sleep in, a notebook on the desk, an objective line, a rent timer, day card, ambient walkers and pets, daylight shift.
- Pick replies, tile replies (tap tiles / undo / say it), word tap → pinyin + gloss, mentor visits, travel list, save export/import, saved games.
- Phone: floating joystick, tap-to-walk, big action button, portrait/landscape layouts, safe-area aware, add-to-home-screen manifest.

### Assets
All 140 models (faceless characters with a shared rig and idle/walk/talk/carry clips, buildings, street dressing, props, interiors) are generated procedurally by Blender scripts in a separate repo (make-it-in-china, `tools/blender/build_all.py`). The 82 GLBs this package references are vendored under `packages/world3d/assets` (8.3 MB) so CI builds standalone; `npm run assets:sync -w @silver-tongue/world3d` refreshes them. Faceless rule from the design doc is asserted at build time.

### Repo changes outside the package
- `.github/workflows/pages.yml`: also builds world3d and deploys it under `/world3d/`; the TUI at `/` is unchanged.
- `package.json`: typecheck adds `tsc -p packages/world3d`. `tsconfig.json`: excludes the package (needs the DOM lib, same as tui-web).
- `package-lock.json`: `three`, `@types/three`.

### Checks
- `npm test`: 31 files, 311 tests (217 existing + 94 new). `npm run typecheck` clean. Build 9.1 MB.
- Browser-verified on desktop and in phone emulation (390×844 and 844×390): full day loop, interiors, sleep, export/import, joystick, no console errors.

### Open for discussion
- No "enter building" input exists in core; doors send `goTo` hop by hop along `links`. Fine for now?
- Cook's `npc_stand` sits behind the counter; the fixed camera sees him inside the shop but not from the street.
- Characters' walk/idle clips are procedural. Retargeting a CC0 mocap library onto the same (Mixamo-named) skeleton is the next quality step.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
