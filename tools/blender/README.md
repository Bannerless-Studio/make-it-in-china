# Headless Blender asset tools

Run these commands from the repository root with Blender 4.2 or newer. They use
only Blender's bundled Python modules and are safe to run without a display.

```sh
# EVERYTHING: all five sets -> assets/index.json -> street mock-up; prints a
# (set, count, total tris) table; exits 1 on any failed assertion.
blender -b --python tools/blender/build_all.py

# Street mock-up only (needs the sets built): assets/street_mockup.png,
# street_mockup_wide.png, street_mockup.glb
blender -b --python-exit-code 1 --python tools/blender/mockup.py

# Final characters set: 12 humans + 3 recolours + 3 pets + 11 held props
# -> assets/characters/*.glb, manifest.json and sheet.png (idempotent).
blender -b --python tools/blender/sets/characters.py

# Contact sheet for any GLB dir (thin wrapper over lib/sheet.py).
blender -b --python tools/blender/render_sheet.py                    # assets/placeholders, fit mode
blender -b --python tools/blender/render_sheet.py -- --dir assets/characters --fit --cols 7
blender -b --python tools/blender/render_sheet.py -- --dir assets/props --true-scale --out /tmp/props.png

# Make the 15 faceless character/pet grey boxes and seven detached props (superseded by sets/characters.py).
blender -b --python tools/blender/make_placeholders.py

# Clean a Rodin GLB, glTF, FBX, or OBJ into a single flat-colour GLB.
blender -b --python tools/blender/cleanup.py -- \
  --in incoming/rodin-character.fbx --out assets/characters/character.glb \
  --height 1.7 --tris 5000

# --keep-textures skips texture flattening. It is omitted for game assets.
blender -b --python tools/blender/cleanup.py -- \
  --in incoming/rodin-character.glb --out /tmp/preview.glb --keep-textures
```

`cleanup.py` defaults to `--height 1.7` and `--tris 5000`. It imports `.glb`,
`.gltf`, `.fbx`, and `.obj`; joins meshes; welds close vertices; recalculates
normals; centres/scales the result; and exports GLB with animation, cameras, and
lights omitted. Image-textured materials are converted to their sampled mean base
colour unless `--keep-textures` is used.


## Shared library: `tools/blender/lib/`

Every set script (characters, buildings, street dressing, job props/food,
interiors) imports one library so all sets share one palette, one material
system, one export path and one contact-sheet renderer.

Conventions: metres, Blender Z up, **front of every asset = -Y** (exports as
glTF +Z forward, +Y up). Manifests are always glTF axes. Full rules (axes,
origins, anchor schema, budgets, palette, adding a set):
`docs/asset-conventions.md`. Characters: feet at z=0, centred, relaxed arms-down rest pose (rigged, see below).
Hand props: origin at the grip point. Everything is bpy data API + bmesh, no
operators except glTF import/export and render, so it is headless-safe.

| Module | What it gives you |
|---|---|
| `palette.py` | `SPEC` (name -> sRGB hex + description), `COLOURS` (name -> linear RGBA), `colour(name)`. ~50 warm, calm flat colours: skin, hair, cloth, hi-vis, food/signal reds/greens/yellows, animals, wood/metal/paper/straw, plaster/brick/roof tile/glass/concrete/asphalt/paving/tile, plus the colours merged from the set scripts (wood_dark, gold, clay, cardboard, broth...). Add new colours here only; set scripts have no colour blocks. |
| `build.py` | `clear_scene`, `mat`, primitives (`box`, `rounded_box`, `cylinder`, `cone`, `sphere`, `capsule`, `loft`, `lathe`, `torus`, `tube`, `extrude_profile`), helpers (`catmull`, `aim`, `cut`), object ops (`join`, `bake`, `duplicate`, `mirror_x`, `rotate_about`, `deform`, `translate_mesh`, `scale_mesh`, `set_origin_feet`, `set_origin`, `apply_all`, `bbox`, `tri_count`, `flat_shade`, `smooth_shade`, `bevel`). |
| `export.py` | `export_glb(obj_or_objs, path, armature=None)`: applies modifiers/transforms, +Y up, normals + materials only, no anim/skins/lights/cameras, prints `EXPORT name tris=N bbox=x,y,z` (glTF axes). With `armature=` it exports the skin + every NLA action as a named glTF animation (sampled 24 fps, all bones). |
| `rig.py` | Procedural rigging: `build_armature`, `bind_rigid` (1 bone per vertex), `Skeleton` (FK) + `ik2` (two-bone IK), `bake_clip` (one action per clip, NLA track), `HumanMotion` / `bake_human` (idle, walk, talk, carry_idle, carry_walk), `bake_pet` (idle), `measure_stride`. Skeleton/clip name constants. |
| `manifest.py` | `write(out_dir, entries, origin_default, blender_frame)`: the one manifest writer (glTF axes, `frame: "gltf"`, anchor shape normalisation + validation); `build_index(assets_dir)` -> `assets/index.json`. |
| `mounts.py` | Cross-set mount spans (`LANTERN_STRING_SPAN` 3.0, `LAUNDRY_POLE_SPAN` 2.2) + `check_pair`; shared by the hanging asset and the building anchor. |
| `sheet.py` | `render_sheet(glb_dir, out_png, cell_size_m=None, cols=6, true_scale=True, fit_height=1.8, resolution=(1920, 1080), files=None, pose=None)` (`pose=(clip, frame)` freezes rigged GLBs at an animation frame) and a CLI `main()`. Fixed high three-quarter ortho camera from the front-right, Workbench flat colour + outline + cavity, name label under each. `true_scale=True` (default, use for prop sets) keeps real sizes; `False` fits each asset to its cell (characters). |

Every primitive takes the common kwargs `material` (palette name), `name`,
`loc`, `rot` (Euler radians), `scale`, `smooth`, `smooth_angle`, `bevel`,
`bevel_segments`, and (for open `loft(arc=...)` surfaces) `thickness`.
Primitives return a part object; keep parts in a list and `join()` them into
ONE mesh object at the end (one material slot per palette colour).

`loft(rings, segments, exponent, arc, closed, modulate)` is the workhorse:
rings are `(z, rx, ry[, ox, oy])` cross-sections along +Z; `exponent` > 2
gives rounded-box sections; `arc` makes open panels (aprons, awnings, vests);
`modulate(theta, t)` adds pleats, quilting or waves. Rotate it with
`rot=aim(direction)` to point along any axis.

### Writing a new set script (template)

```python
#!/usr/bin/env python3
"""<Set name>: what it makes.  blender -b --python tools/blender/sets/<set>.py"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from lib import build as B  # noqa: E402
from lib import export, sheet  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "assets", "<set>")
TRI_BUDGET = 400


def make_stool(colour="red"):
    """Red plastic stool, 0.45 m. Parametrise colours/sizes; reuse helpers."""
    B.clear_scene()
    seat = B.rounded_box((.3, .3, .04), radius=.012, segments=2, material=colour, loc=(0, 0, .43))
    legs = [B.cylinder(.018, .42, verts=8, radius_top=.014, material=colour, loc=(x, y, .21))
            for x in (-.11, .11) for y in (-.11, .11)]
    obj = B.join([seat] + legs, "stool")
    return B.set_origin_feet(obj)          # base at z=0, centred


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):              # idempotent: regenerate everything
        if f.endswith(".glb"):
            os.remove(os.path.join(OUT, f))
    for fn in (make_stool,):
        obj = fn()
        assert B.tri_count(obj) <= TRI_BUDGET, obj.name
        export.export_glb(obj, os.path.join(OUT, obj.name + ".glb"))
    sheet.render_sheet(OUT, os.path.join(OUT, "sheet.png"), cols=6, true_scale=True)


if __name__ == "__main__":
    main()
```

Rules for set scripts: palette names only (no raw RGB), one joined mesh per
asset, parametrise shared shapes as functions (never copy-paste a body), assert
tri budgets and heights, print counts, render the sheet and look at it.

## Characters set: `tools/blender/sets/characters.py`

* `SPEC` table (one row per human: height, build, skin, hair, torso/legs/shoe
  colours, sleeve type, headwear, outfit features) drives `make_human()`.
* Shared, parametrised pieces: `Body` (proportions per build thin / average /
  stocky / broad / plump, adult or kid), `head`, `torso`, `arm`, `leg`, `hair`
  styles, `HEADWEAR` builders (chef_hat, flat_cap, hard_hat, courier_cap,
  school_cap, straw_hat, sun_visor, peaked_cap, hood_down) and `OUTFITS`
  builders (apron, vest, cardigan, bands, polo, hoodie, coat, chef_jacket,
  belt, tie, backpack, tote, collar, hood).
* Height = top of the bare head (1.7 adult, 1.6 stooped elderly, 1.1 kid);
  headwear sits on top. All humans share one proportion set so one skeleton
  can rig them all.
* Build-time assertions: faceless (exactly one head part, a single closed
  shell, no part named like a facial feature, only hair/headwear attached),
  distinct (headwear shape, torso colour) pairs, tri budgets (humans
  800-2500, pets <= 1200, props <= 400), feet at z=0, centred, measured
  bare-head top == spec height (landlord 1.62, stocky).
* Recolours of customer_a: customer_a_khaki / _green / _blue.
* Held props (origin = grip unless noted): chef_hat (base), ladle, clipboard,
  delivery_bag, hanging_scale, key_ring, shopping_trolley, smartphone,
  folding_fan (Old Wang), barcode_scanner (clerk), umbrella_closed.
* `manifest.json` (glTF axes): humans `head_top`, `top`; props `grip`,
  `used_by`.

## After Rodin, per character

1. Blender: check no face geometry. Decimate to ~3–6k tris (they are 1/8 screen height). One flat material per colour. Feet on origin, +Y up, height 1.7 m adult, 1.1 m kid, 0.35 m cat.
2. Humans: Mixamo auto-rig (FBX in, FBX out), then download clips: idle, walk, carry box, hand over, wash/scrub, point, shrug, sit. Convert to GLB with one shared skeleton.
3. Pets: Mixamo has no quadruped rig. Either a 5-bone manual rig in Blender (spine, head, tail, 2 legs mirrored) with idle bob + walk, or keep them static with a code-driven bob and turn. Static is fine for Phase 1.
4. Headwear and held props (chef hat, ladle, clipboard, delivery bag, scale, keys, shopping trolley): generate as separate small objects, attach to head/hand bones. Six extra small generations if budget allows, else Blender primitives.

## Interiors set: `tools/blender/sets/interiors.py`

```sh
blender -b --python tools/blender/sets/interiors.py   # exits 1 on any failed assertion
```

Outputs `assets/interiors/*.glb` (24 assets + 3 hideable walls), `manifest.json`, `sheet.png`
(true scale, all), plus review sheets `sheet_furniture.png`, `sheet_small.png`,
`sheet_shells.png`. Idempotent. Rented room (bed, desk, chair, wardrobe, wall
fan, phone+charger, window grille, `room_shell`), tea house (round table,
wooden stool, tea set tray, lattice screen, bench, bamboo pot,
`tea_house_shell`), noodle shop (formica table, chopstick holder, napkin box,
menu board, `noodle_shop_shell`), common (floor mat, calendar, faceless clock,
blank poster). Budgets: 800 tris each, tea/noodle shells 1500.

* Frames (Blender, Z up, front -Y): props base z=0, centred X/Y. Wall pieces
  same; back (+Y) face goes on the wall, anchor `wall_mount` = back-face
  centre, `mount_height_m` = suggested base height above floor. Shells: open
  front on y=0, interior toward +Y, centred X, floor slab base z=0 (floor top
  = anchor `floor_top_z`). The +X side of each shell is open; its full-height
  wall is a separate `<shell>_wall_x.glb` (room_shell_wall_x, tea_house_shell_wall_x,
  noodle_shop_shell_wall_x) with the SAME origin, so the game can hide it.
* `manifest.json` is written in **glTF axes** via `lib/manifest.py` (geometry
  is built in Blender axes and converted: (x, y, z) -> (x, z, -y)): list of
  `{name, file, tris, budget, size_m:[x,y_up,z_depth], origin, frame, anchors}`.
  Shells: `door`/`entrance`/`npc_stand`/`player_stand` as `{pos, facing}`,
  `floor_top_z` (float), extra points (`counter_top`, `pass_window`),
  `furniture_slots: [{asset, pos, rot_y_deg[, external]}]` (asset origin
  placement, rotation about glTF Y; wall pieces already offset so their back
  touches the wall) and `hideable_walls: [{side, file, name, height_m}]`. Blank boards
  (`menu_board_wall`, `calendar_wall`, `poster_blank`) have `text_face
  {pos, size, normal}`. `stool_plastic` is listed as external (street set).
* Colours it relies on (now in `lib/palette.py`): `wood_dark`, `formica`, `dado_green`, `leaf_dark`.

## Props set: `tools/blender/sets/props.py`

```sh
# 43 job props, kitchenware, delivery items, fruit and shop goods (idempotent)
# -> assets/props/*.glb, manifest.json, sheet.png (true scale), sheet_small.png (fit, items <= 0.35 m)
blender -b --python-exit-code 1 --python tools/blender/sets/props.py
```

* Porter: box_small/medium/large (0.3/0.5/0.8 m, height asserted +-5%), box_stack, crate_wood,
  hand_truck, pallet, sack_rice. Dishwasher: bowls (empty/noodles/soup), cup_glass, teacup, teapot,
  kettle, chopsticks, spoon, tray, dish_rack, wok_on_burner, sink_double, counter_noodle. Delivery:
  takeaway_box, takeaway_bag, door_plate. Fruit/goods: apple, banana_bunch, orange, watermelon_slice,
  cabbage, tomato, bao_bun, dumpling_plate, bottle_water, milk_carton, tea_box, egg_tray, rice_bag,
  crate_apples/oranges/bananas, shelf_unit, freezer_chest.
* Tri budget 500 each; hand_truck/sink_double/egg_tray/crate_* 900, counter_noodle 1500,
  shelf_unit 2000 (build fails if exceeded or base not at z=0 centred).
* `manifest.json`: list of `{name, file, tris, budget, size_m:[x, y_up, z_depth], anchors}`.
  Anchors are in **glTF / three.js axes** (x right, y up, +z = asset front), metres from the
  asset origin (base centre). Points are `[x, y, z]`; text faces are `{pos, size:[w, h], normal}`.
  Key anchors: door_plate `text_face`; counter_noodle `npc_stand` (behind), `player_stand` (front),
  `pass_shelf`, `bowl_1..3`, `front_panel`; boxes `label_face`, `top`; crate_* `price_tag`;
  shelf_unit `shelf_1..4`, `price_strip_1..4`, `customer_stand`; freezer_chest `sign_face`;
  milk_carton/tea_box/rice_bag `text_face`; sink_double `worker_stand`, `basin_left/right`.
* Colours it relies on (now in `lib/palette.py`): cardboard, dark_green, leaf_pale, broth, egg_shell.

## Street dressing set: `tools/blender/sets/street.py`

```sh
blender -b --python tools/blender/sets/street.py
# -> assets/street/*.glb (24), manifest.json, sheet.png (true scale, all),
#    sheet_detail.png (true scale, small props). Idempotent.
```

* 24 props: lantern, lantern_string, steamer_stack, sign_hanging, sign_vertical,
  sign_aboard, sign_lightbox, awning, awning_small, stool_plastic, table_folding,
  ac_unit, power_pole, street_lamp, bicycle, scooter_delivery, bin_public,
  planter_pot, tree_street, bollard, laundry_pole (standing rack),
  laundry_pole_bar (wall-mounted, origin `rest_left`, fits building
  `laundry_pole_mounts`), water_urn, red_door. Two-point spans come from
  `lib/mounts.py`.
* Build-time checks: tri budget (800 default; lantern_string 2500, power_pole
  1200, bicycle/scooter 1500, tree 900), origin rule, main dimension within
  12 % of spec, every sign has `text_face`, mount props have `mount`.
* Origins (`origin` field): `feet` = base z=0 centred; `hang` = top hook /
  chain tops at origin, everything below; `hang_left` = lantern_string left
  hook (right hook at +3 m X); `wall` = wall plane at origin, prop in front.
  Human-readable detail in each entry's `mount` string.
* `manifest.json` is a list of `{name, file, tris, size_m, origin, frame,
  anchors, mount?}`. Anchors and `size_m` are in **glTF asset space** (metres,
  +Y up, front = +Z; Blender (x, y, z) -> (x, z, -y)). Text faces are
  `{pos, size:[w,h], normal, face_colour}` (pos sits on the blank face;
  raycast-verified): sign_* `text_face` (sign_vertical also `text_face_back`),
  red_door `couplet_left/right/top` + `door`, bin_public `label_left/right`,
  scooter_delivery `box_side`, power_pole `flyer_face`, awning `valance_face`.
  Other anchors: seat/top/seats, light, tap, hook(s), chain_tops, wire_ends.
* Colours it relies on (now in `lib/palette.py`): gold, bamboo_dark, clay, door_red, canopy_green.

## Buildings set: `tools/blender/sets/buildings.py`

```sh
blender -b --python tools/blender/sets/buildings.py
# -> assets/buildings/*.glb (11 buildings + 6 street tiles), manifest.json, sheet.png (true scale)
```

* Buildings are hollow shells: facade + 1.5 m return walls + back wall + roof
  cap. Facade front on Blender y=0 (glTF z=0), footprint centred in X, base at
  0; awnings/steps/docks protrude towards the street. Budgets: 6000 tris
  (fruit_stall 2500, bus_stop 2000, district_gate 3000), tiles 200.
* Shared helpers: `shell`, `wall_with_holes`, `window` (optional grille cage),
  `door`, `ac_unit`, `sign`/`light_box` (blank paper face + rim, records the
  anchor), `tile_roof`/`pitched_roof`/`flat_roof`, `corrugated`, `slats`,
  `lattice`, `hook`.
* `manifest.json` = list of `{name, kind, file, tris, size_m:[w,h,d], anchors}`
  in **glTF axes** (x right, y up, z towards the street = -Blender Y), metres,
  relative to the asset origin. Every building has `sign_main {pos, size,
  normal}` (pos = centre of the blank face), `door {pos, facing}`,
  `npc_stand` / `player_stand {pos, facing}`; extras where relevant:
  `sign_vertical`, `lantern_hooks` (hook eye; single lanterns hang from here),
  `lantern_string_hooks {left, right}` (noodle shop, exactly the lantern_string span),
  `number_plate`, `laundry_pole_mounts {left, right}` (2.2 m poles),
  `crate_slots {pos, tilt_deg, size}`, `price_board`, `scale_hook`, `seats`,
  `route_board`, `personnel_door`, `dock_top_z`, `counter_top`.
* Tiles: road_straight / road_crossing 8 x 4 m (run along X, surface 0.05),
  pavement_straight 8 x 2 m (kerb 0.2 on the street side, `kerb_side`),
  pavement_corner 2 x 2 m (kerbs on +z and +x), manhole, drain_grate. Edges sit
  exactly at +-half size with no bevel; the script asserts end-to-end tiling
  (no gap, matching edge vertex profiles, road->crossing, pavement->corner).
* Colours it relies on (now in `lib/palette.py`): `wood_dark` (was `dark_wood`), `tile_white`, `paving`.
* Supermarket and tailor display bays are left unglazed below the transom so
  the interior (freezer chest, clothes rail) reads with opaque palette glass.

## Build-all + street mock-up: `tools/blender/build_all.py`, `tools/blender/mockup.py`

* `build_all.py` runs characters, buildings, street, props, interiors (each
  set's `main()` in one Blender process), writes `assets/index.json`
  (`lib/manifest.build_index`), renders the mock-up and prints the summary
  table. Takes about 30 s.
* `mockup.py` lays 6 road_straight + 1 road_crossing along X with pavements
  both sides, the far row (district_gate, tea_house, rented_room, noodle_shop,
  fruit_stall, supermarket, filler_phone_shop, bus_stop, warehouse) and
  near-side dressing and characters. Everything is placed through manifest
  anchors. Asserts: lantern_string / laundry_pole_bar right ends land on the
  right mount (< 1 cm), crate slots fit, and every ground-placed instance is
  supported (hide it, ray-cast down, gap <= 3 cm). Camera = `lib/sheet`
  ELEVATION/AZIMUTH ortho, Workbench outline + cavity, warm background.

## Character rig + clips: `tools/blender/lib/rig.py`, `tools/blender/verify_rig.py`

```sh
blender -b --python tools/blender/sets/characters.py   # builds, rigs and bakes (also run by build_all.py)
blender -b --python tools/blender/verify_rig.py        # re-import checks, one OK line per character,
                                                       # renders assets/characters/sheet_pose.png + sheet_walk.png
blender -b --python tools/blender/verify_rig.py -- --extra /tmp/review   # + talk / carry / idle review sheets
```

* Humans (15): skeleton `st-human-v1`, Mixamo names: Hips, Spine, Chest, Neck, Head, Left/Right
  Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot (Left = +X in Blender = character's left, glTF +X)
  plus non-deforming leaf bones `RightHandGrip`, `LeftHandGrip` (palm) and `HeadTop` (bare-head top).
  Attachment bones' rest frame: local +Y = world up, +Z = character front (glTF), so a held prop
  (origin = grip, modelled upright) parents with an identity transform.
* Bind pose = relaxed A: `rest_arms()` lowers the T-pose arms to 15 deg off vertical and pushes the
  shoulder joint outward (<= 0.10 m x scale) until the arm clears torso/outfit (1.2 cm rest-on allowed);
  only fruit_seller (18) and customer_b (25) needed a wider angle. Per-character values in the manifest.
* Rigid weights: every vertex 1.0 on one bone (head/hair/headwear -> Head; limbs split at elbow /
  knee / ankle rings; torso + outfit by height; backpacks, belts, trims whole). Limbs are continuous
  lofts so a bent joint shears one segment instead of opening a gap; short/rolled sleeves get an extra
  forearm ring at the elbow.
* Clips (24 fps, start at t=0, loops have first == last key): `idle` 4 s, `walk` 1 s (2 steps,
  in place, IK-planted feet), `talk` 2 s (nods + right-hand gesture), `carry_idle` 4 s,
  `carry_walk` 1 s (forearms forward at chest height, palms in). No root motion.
  Walk stride = 0.6 m per 1 s cycle at 1.7 m (scaled by height: kid 0.388, old_wang 0.565,
  landlord 0.572); set move speed = `rig.stride_m / rig.walk_cycle_s`. Each step is 0.3 m.
* Pets (cat, dog, pigeon): skeleton `st-pet-v1` (Root, Spine, Head, Tail), `idle` 2 s
  (breathe, head look, tail swish). Props: no rig.
* Manifest `rig` block per character: `skeleton, clips, clip_durations_s, loop, fps` and for humans
  `stride_m, step_m, walk_cycle_s, walk_speed_mps, grip_bones, head_top_bone, attach_frame,
  rest_arm_deg, shoulder_out_m`.
* `verify_rig.py` asserts from the GLB JSON/binary and a Blender re-import: 1 skin + 1 skinned mesh,
  exact bone and clip names, durations, first == last for loops, attachment-bone frames, rigid
  weights, and the measured walk stride / planted foot.
