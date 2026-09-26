# Repository directives

Make It in China: art + deploy repo. The game code lives in silver-tongue (`packages/world3d`, branch `world3d` on Fiazul/silver-tongue); this repo holds design docs, the procedural Blender asset pipeline, generated assets, briefs, and the Pages deploy.

## Layout
- `docs/`: design doc, `asset-list.md` (list + build status), `asset-conventions.md`, `silver-tongue-integration.md`.
- `tools/blender/`: headless asset pipeline. Read `tools/blender/README.md` before changing it.
- `assets/`: generated output of `tools/blender/build_all.py`.
- `briefs/`: worker briefs (project log). `briefs/assets-common.md` holds the shared asset rules.
- `legacy-prototype/`: superseded Vite prototype. Reference only; do not build, deploy, or extend.
- `.github/workflows/deploy-game.yml`: builds silver-tongue world3d and publishes it to `gh-pages`.

## Commands
- Build all assets: `blender -b --python tools/blender/build_all.py` (Blender 4.2+; exits 1 on failed assertion).
- Street mock-up only: `blender -b --python-exit-code 1 --python tools/blender/mockup.py`.

## Rules
- Treat `assets/**` as generated; never hand-edit. Change the generator and rebuild.
- Keep the character rig contract stable (clip names `idle`, `walk`, `talk`, `carry_idle`, `carry_walk`; bones `HeadTop`, `RightHandGrip`, `LeftHandGrip`); world3d codes against it.
- Never add faces to any character mesh.
- Never add loans, interest, gambling, alcohol, romance, or supernatural content.
- Never write pinyin with tone numbers.
- Never test touch controls with mouse events; dispatch real touch (or CDP touch) only.
- Keep code comments near zero and explain only why.
- Keep user-facing info in `README.md`, agent constraints in this file.
- Never commit changes as a worker; let the orchestrator commit.
