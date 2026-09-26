# Blender pipeline: Rodin cleanup script + faceless grey-box placeholders + silhouette sheet

## Goal
Headless Blender 4.2 tooling for a low-poly toon three.js game. When done: (1) any Rodin export (GLB/FBX/OBJ) can be turned into a clean flat-colour GLB with one command; (2) a set of faceless grey-box placeholder characters and pets exists as GLBs so the game can start with them before Rodin assets arrive; (3) one PNG contact sheet renders all placeholders from the game's fixed high three-quarter camera so silhouettes can be judged.

## Context
- Repo/dir: /home/fiazul/Desktop/make-it-in-china (no git, no package.json; plain folder)
- Blender: `blender` on PATH, 4.2.3 LTS. Run everything headless: `blender -b --python script.py -- args`.
- Read first: docs/asset-list.md section "Character set — 15 Rodin generations" (character table + "After Rodin, per character" steps) and "Rodin rules". Also docs/design-doc.txt lines 200–260 (no-face rule) and 300–420 (visual direction, asset rules).
- Style: low poly, flat solid colours, faceless characters (no eyes/nose/mouth/ears geometry or texture), characters ~1.7 m adult, 1.1 m kid, 0.35 m cat, 0.4 m dog, 0.25 m pigeon. Feet on origin. glTF export Y-up (Blender exporter default).
- No Rodin outputs exist yet. Test the cleanup script by round-tripping a placeholder GLB and, if available, any FBX/GLB the script can produce itself (e.g. export Suzanne with a procedural image texture to exercise the texture→flat-colour path).

## Scope
- In: create `tools/blender/cleanup.py`, `tools/blender/make_placeholders.py`, `tools/blender/render_sheet.py`, `tools/blender/README.md`, output dir `assets/placeholders/` (GLBs + sheet PNG).
- Out: don't touch docs/ or briefs/. No pip installs inside Blender's python. No git operations. Don't attempt rigging/armatures (Mixamo handles that later).

## Deliverables
1. `cleanup.py` — usage: `blender -b --python tools/blender/cleanup.py -- --in FILE --out FILE.glb [--height 1.7] [--tris 5000] [--keep-textures]`
   - Import glb/gltf/fbx/obj by extension.
   - Join all meshes into one object, remove doubles (merge distance 0.0005), recalc normals.
   - Decimate (collapse) to ≤ --tris triangles (skip if already below).
   - Flat colours: for every material with an image texture, compute the mean RGB of the image pixels (sample every Nth pixel for speed), set Principled Base Color to it, delete image nodes, set roughness 1, specular/metallic 0. Materials without images: keep base colour. `--keep-textures` skips this.
   - Transform: apply rotation/scale, move so lowest point is at z=0 and x/y centred on bounding box, uniformly scale so height == --height when given.
   - Export GLB (apply modifiers, no animation, no cameras/lights, +Y up).
   - Print a one-line summary: input, tri count before/after, materials, bbox size.
2. `make_placeholders.py` — generates faceless grey-box characters from primitives, exports one GLB per character to `assets/placeholders/`:
   - Human base: sphere head (NO features), capsule/cylinder torso, cylinder arms in T-pose, cylinder legs, low-poly (≤ ~1.5k tris). Parametrise build (thin/average/stocky/broad/plump), height, torso colour, leg colour, and optional headwear primitive (tall_hat cylinder, flat_cap squashed cylinder, hard_hat dome, cap dome+brim, straw_hat wide cone, visor brim only, hood).
   - Generate all 12 humans from the doc table with distinguishing colour + build + headwear: player, cook, old_wang, landlord, warehouse_boss, courier, fruit_seller, clerk, customer_a, customer_b, kid, bus_driver.
   - Pets: cat (sitting, ears, tail), dog (standing, floppy ears, curled tail), pigeon (round body). Faceless.
   - Held props as separate GLBs: chef_hat, ladle, clipboard, delivery_bag, hanging_scale, key_ring, trolley (crude primitives are fine).
   - Each character one mesh object, materials flat colour, feet on origin.
3. `render_sheet.py` — imports every GLB in assets/placeholders/, lays them in a grid, fixed camera high three-quarter (~50° down, orthographic or long lens), 3-step toon-ish look via Workbench engine flat/matcap with outline enabled (Workbench "Outline" option) — Workbench is fine and fast; no Cycles. Renders `assets/placeholders/sheet.png` 1920x1080 with each character's name as a text label under it.
4. `README.md` — the three commands, args, and the post-Rodin per-character checklist copied from docs/asset-list.md.

## Constraints
- Python only via Blender's bundled interpreter; only bpy/bmesh/mathutils/stdlib.
- Scripts must be idempotent and headless-safe (no GUI ops that need a window; use `bpy.ops` with context overrides or direct data API).
- Faceless is a hard rule: verify in make_placeholders that no head has extra geometry.
- Fix the category, not the instance: cleanup.py must work for any of the importers, not just GLB.

## Acceptance criteria
- [ ] `blender -b --python tools/blender/make_placeholders.py` exits 0 and produces 15 character GLBs + 7 prop GLBs in assets/placeholders/; paste `ls -la` and per-file tri counts.
- [ ] `blender -b --python tools/blender/cleanup.py -- --in assets/placeholders/cook.glb --out /tmp/cook_clean.glb --height 1.7 --tris 800` exits 0, output height ≈1.7, tri count ≤ 800, feet at z≈0; paste summary line.
- [ ] Texture path exercised: script/test creates an object with a generated image texture, runs cleanup, resulting GLB has no images and a solid base colour; paste evidence.
- [ ] FBX import path exercised at least once (export a placeholder to FBX from Blender, then cleanup it).
- [ ] `blender -b --python tools/blender/render_sheet.py` produces assets/placeholders/sheet.png; paste file size and confirm it opened (e.g. `file sheet.png`).
- [ ] README documents all three commands.

## Report format
DONE / ACCEPTANCE (each criterion pass|fail) / VERIFICATION (commands + summarized output) / FILES TOUCHED (with line ranges) / OPEN QUESTIONS.
Ambiguity or blocker: stop and ask under OPEN QUESTIONS. Never guess a decision that belongs to the orchestrator.
