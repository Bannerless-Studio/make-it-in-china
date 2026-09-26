# Common rules for asset set briefs (parts 2–5)

- Repo: /home/fiazul/Desktop/make-it-in-china. Blender 4.2.3 at /home/fiazul/.local/bin/blender, headless only: `blender -b --python tools/blender/sets/<set>.py`.
- Read first: tools/blender/README.md (lib API + set-script template, lines 36–115), tools/blender/lib/build.py docstrings (targeted reads), tools/blender/sets/characters.py lines 1–140 for style of a set script. docs/asset-list.md for the item list and style. Look at assets/characters/sheet.png with the Read tool so your set matches the character style and scale (adult = 1.7 m).
- Style: Kenney / KayKit low-poly. Flat palette colours, subtle bevels on hard edges so toon outlines catch, no textures, no UVs. Chunky, slightly oversized details (handles, rims, brackets) because the camera is a fixed high three-quarter view and objects are small on screen.
- Conventions: metres, Z up in Blender, front = -Y. Base at z=0, centred in X/Y (buildings: front face on y=0 plane, footprint centred in X, base z=0). One joined mesh per asset, one material slot per colour. Palette names only.
- DO NOT edit anything under tools/blender/lib/ or tools/blender/sets/characters.py — other workers run concurrently. If a colour is missing, add it at the top of YOUR set script inside an `EXTRA_COLOURS = {name: (hex, desc)}` block that registers into palette.COLOURS/SPEC at import time. The orchestrator merges later.
- Idempotent: delete old GLBs in your output dir first, regenerate everything.
- Sidecar: write `assets/<set>/manifest.json` — list of {name, file, tris, size_m:[x,y,z], anchors:{...}} where anchors are named points in metres (sign centres, door positions, stand/seat points) that the game will use to place text and NPCs. Even an empty anchors dict is fine for simple props.
- Assert tri budgets and base-at-zero per asset; print `EXPORT` lines; render `assets/<set>/sheet.png` in true-scale mode and LOOK at it with the Read tool. Do at least two render-and-look passes and fix what reads wrong (floating parts, collapsed parts, illegible silhouettes, wrong relative size).
- No pip, no git, no files outside tools/blender/sets/<set>.py, assets/<set>/ and a short section appended to tools/blender/README.md describing your set's command and manifest.
- Context budget: targeted reads (offset/limit), summarize bulk output, never paste it. If scope blows past the brief, stop and return a handoff (done / remaining / decisions / files touched).
- You are the SOLE executor. You cannot spawn agents or delegate — any "I handed this to another agent / it's executing in the background" belief is false. Do the work yourself, in your own turn, to completion.
- Ambiguity or blocker: end your turn with the question under OPEN QUESTIONS instead of guessing.
- Report format: DONE / ACCEPTANCE (each criterion pass|fail) / VERIFICATION (commands + summarized output + per-asset tris and size) / FILES TOUCHED / EXTRA_COLOURS added / OPEN QUESTIONS.
