# Blender asset build, part 1: shared library + final characters, hats, held props

## Goal
Replace the grey-box placeholders with the real low-poly stylized character set for the game, built procedurally in Blender 4.2 from primitives and bmesh. Also create a small shared Python library that parts 2–5 (buildings, street dressing, job props/food, interiors) will import, so every set shares one palette, one material system, one export path and one contact-sheet renderer. Quality bar: what you would ship in a Kenney/KayKit-style low-poly game, not a grey box. Faceless is a hard rule.

## Context
- Repo/dir: /home/fiazul/Desktop/make-it-in-china (plain folder, no git, no node)
- Blender 4.2.3 on PATH, headless only: `blender -b --python script.py -- args`
- Read first: docs/asset-list.md (whole file; character table + distinguishing rules + style), tools/blender/make_placeholders.py (existing primitive helpers — reuse ideas, then supersede), tools/blender/render_sheet.py (existing sheet renderer — generalize into the lib).
- Look/feel target: Kenney / KayKit / Quaternius characters. Chunky proportions, big smooth head (~1/4 of height), short legs, mitten hands, slightly tapered torso, subtle bevels so toon outlines catch edges. Flat solid colours only, no textures, no UVs needed. 800–2500 tris per character.
- Fixed high three-quarter camera in game; characters ~1/8 screen height. Silhouette + colour is everything.

## Deliverables
1. `tools/blender/lib/__init__.py`, `tools/blender/lib/palette.py`, `tools/blender/lib/build.py`, `tools/blender/lib/export.py`, `tools/blender/lib/sheet.py`:
   - palette.py: one named palette (warm, calm, limited: ~24 colours covering skin tones, clothing, wood, metal, paper, food reds/greens/yellows, building plaster, brick, roof tile, awning red, lantern red, glass, concrete, asphalt). Linear RGB. Document each.
   - build.py: helpers — `clear_scene()`, `mat(name)`, primitives with material + bevel option (box, cylinder, cone, sphere, capsule, rounded_box, lathe from profile, extrude_profile for signs/awnings), `join(parts, name)`, `set_origin_feet(obj)`, `apply_all(obj)`, `tri_count(obj)`, `flat_shade(obj)`, optional `bevel(obj, width, segments)`.
   - export.py: `export_glb(obj_or_objs, path)` — apply modifiers, +Y up, no animation/lights/cameras, prints `EXPORT name tris=N bbox=x,y,z`.
   - sheet.py: `render_sheet(glb_dir, out_png, cell_size_m=None, cols=6)` — imports every GLB in a dir, grid layout, fixed high three-quarter camera, Workbench flat shading with outline + cavity, name label under each. Add `--true-scale` mode that does NOT normalise per cell, so relative sizes are visible; default true-scale for props sets, per-cell fit for characters. Reuse code from render_sheet.py then make render_sheet.py a thin wrapper that calls the lib.
2. `tools/blender/sets/characters.py` → `assets/characters/*.glb` (and `assets/characters/sheet.png`):
   - Humans (12): player, cook, old_wang, landlord, warehouse_boss, courier, fruit_seller, clerk, customer_a, customer_b, kid, bus_driver. Per docs/asset-list.md table: build (thin/average/stocky/broad/plump), height (adult 1.7, elderly 1.6 with stoop, kid 1.1), torso/leg/shoe colours, outfit geometry (apron front panel, hi-vis vest with stripes, cardigan open front, courier jacket trim, polo collar block, padded jacket bulk, raincoat hood down, sleeve guards), headwear as part of the character mesh (tall chef hat, flat cap, hard hat, courier cap with brim, straw hat wide brim, sun visor, hoodie hood down on player, school cap on kid). T-pose, arms straight out, feet on origin, one joined mesh per character, one material per colour.
   - Faceless: head is a smooth sphere/rounded shape with NO eyes, nose, mouth, ears, hair strands. Hair as a simple cap shape is allowed (customer_b permed shape, old_wang side tufts under cap) since it is silhouette, not a face.
   - Pets (3): cat sitting (ears, tail curled around), dog standing (floppy ears, curled tail), pigeon (round body, small head, tail wedge). Faceless. Heights 0.35 / 0.4 / 0.25.
   - Held props as separate GLBs (8): chef_hat (spare), ladle, clipboard, delivery_bag, hanging_scale, key_ring, shopping_trolley, smartphone. Origin at the grip point for hand props.
   - Also export `assets/characters/customer_a_{red,green,blue}.glb` recolours (same mesh, different torso colour).
3. Update tools/blender/README.md: lib overview, how to write a new set script (template), commands for characters set.

## Scope
- In: tools/blender/lib/, tools/blender/sets/characters.py, tools/blender/render_sheet.py (wrapper), tools/blender/README.md, assets/characters/.
- Out: don't touch assets/placeholders/, docs/, briefs/, cleanup.py. No rigging/armatures. No pip installs. No git.

## Constraints
- bpy/bmesh/mathutils/stdlib only. Headless-safe (data API or context-override ops).
- Idempotent: re-running regenerates everything.
- Every character: exactly one mesh object, feet at z=0 in Blender (y=0 in GLB), centred x/y, T-pose, height matches spec ±2%.
- Tri budget 800–2500 per human, ≤1200 per pet, ≤400 per prop. Print counts.
- Distinguishability: no two humans share the same (headwear shape, torso colour) pair. Assert this in the script from the character spec table.
- Category fix: hats, outfits, builds must be parametrised functions reused across characters, not 12 copy-pasted bodies. Other sets will reuse build.py, so keep helpers generic and documented with docstrings.

## Acceptance criteria
- [ ] `blender -b --python tools/blender/sets/characters.py` exits 0; produces 12 humans + 3 recolours + 3 pets + 8 props = 26 GLBs in assets/characters/; paste tri counts and heights per file.
- [ ] `assets/characters/sheet.png` rendered, 1920x1080, and you LOOK at it (open with Blender image load or describe by reading pixels is not enough — use `blender -b` to render then confirm file); describe in 3 lines how the 12 humans differ at a glance.
- [ ] Faceless assertion: script checks head parts have no child features; paste the assertion line.
- [ ] Distinguishability assertion passes; paste it.
- [ ] `blender -b --python tools/blender/render_sheet.py` (wrapper) still works on assets/placeholders/.
- [ ] README updated with lib usage + set-script template.

## Report format
DONE / ACCEPTANCE (each criterion pass|fail) / VERIFICATION (commands + summarized output) / FILES TOUCHED (with line ranges) / LIB API (list of public functions with one-line signatures — parts 2–5 will be briefed from this) / OPEN QUESTIONS.
Ambiguity or blocker: stop and ask under OPEN QUESTIONS. Never guess a decision that belongs to the orchestrator.
