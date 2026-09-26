# Asset conventions (all sets)

One library, one palette, one manifest shape. Built by
`blender -b --python tools/blender/build_all.py` (every set, then
`assets/index.json`, then the street mock-up). Code: `tools/blender/lib/`
(`palette.py`, `build.py`, `export.py`, `sheet.py`, `manifest.py`, `mounts.py`).

## Axes and units

- Metres. Geometry is authored in Blender (Z up, asset front = -Y) and exported
  as glTF (+Y up, asset front = **+Z**). Blender (x, y, z) -> glTF (x, z, -y).
- Every manifest, every anchor and `size_m` is in **glTF / three.js asset
  axes**, relative to the asset origin: x right, y up, +z = asset front (towards
  the street / camera). Every entry has `"frame": "gltf"`.
- `size_m` = bounding-box size `[x, y_up, z_depth]`.
- Rotations in slots: `rot_y_deg` about glTF +Y (counter-clockwise seen from
  above; same sign as Blender's rotation about +Z).

## Origin rules (`origin` field)

| origin | meaning | used by |
|---|---|---|
| `feet` | base at y=0, bbox centred in x/z | props, furniture, humans, pets, street props, tiles |
| `facade` | facade front on the z=0 plane, footprint centred in x, base y=0; awnings/steps/docks protrude to +z | buildings |
| `shell` | open front edge on z=0, interior toward -z, centred in x, floor slab base y=0 | interior shells + their hideable walls |
| `wall_piece` | `feet` rule, back face is the wall side; `wall_mount` anchor = back-face centre, `mount_height_m` = suggested base height | interior wall pieces |
| `wall` | wall plane at z=0, prop in front (+z) | awnings, AC unit, light-box, vertical sign, red door |
| `hang` | top hook at the origin, everything below | lantern, hanging sign |
| `hang_left` | left hook at the origin, right hook at `hook_right` (+x) | lantern_string |
| `rest_left` | left rest point (pole underside) at origin, right at `rest_right` (+x) | laundry_pole_bar |
| `grip` | hand grip point at origin | held character props (ladle, fan, scanner, umbrella...) |

Hideable walls (`<shell>_wall_x.glb`) share the shell's origin: place both with
the same transform and hide the wall while the camera looks in. Their base is
the floor top (not y=0) because they sit on the shell's floor slab.

## Anchor schema

Anchors live in `entry.anchors`, keyed by name. Shapes (enforced by
`lib/manifest.py`):

- **point** `[x, y, z]`: hooks, seats, tops, `grip`, `scale_hook`, bowl spots.
  Lists of points: `lantern_hooks`, `seats`, `seat_slots`, `wire_ends`.
- **stand** `{pos, facing}`: keys `door`, `entrance`, `*_door`, `*_stand`
  (`npc_stand`, `player_stand`, `worker_stand`, `customer_stand`, `user_stand`...).
  `facing` = unit xz direction a character standing there looks. Place a
  character at `pos` and turn it to `facing`.
- **text face** `{pos, size:[w, h], normal[, face_colour]}`: blank faces the game
  draws text on (`sign_main`, `sign_vertical`, `text_face`, `label_face`,
  `price_tag`, `price_board`, `route_board`, `number_plate`, `couplet_*`,
  `valance_face`, ...). `pos` = centre of the blank face, `normal` points out.
- **mount pairs** `{left, right}`: two points a two-point asset spans.
  `lantern_string_hooks` (noodle shop) takes `lantern_string` (origin on
  `left`); `laundry_pole_mounts` (list, rented room) take `laundry_pole_bar`.
  The spans are shared constants in `lib/mounts.py` (3.0 m, 2.2 m) and both
  the building and street scripts assert them.
- **slots**: `crate_slots [{pos, tilt_deg, size:[w, d]}]`: rotate the item
  about its local +x by `tilt_deg` (back edge rises) and put its base centre
  on `pos`. `furniture_slots [{asset, pos, rot_y_deg[, external]}]` place
  asset origins inside shells (wall pieces already offset to touch the wall).
- **scalars**: `*_z` heights (`floor_top_z`, `dock_top_z`, `surface_z`,
  `kerb_top_z`) are floats in glTF y.
- `mount` (street entries): human-readable mount description.
- `hideable_walls` (shells): `[{side, file, name, height_m, note}]`.

## Tri budgets

| set | budget |
|---|---|
| characters | humans 800-2500, pets <= 1200, held props <= 400 |
| buildings | 6000 (fruit_stall 2500, bus_stop 2000, district_gate 3000), tiles 200 |
| street | 800 (lantern_string 2500, power_pole 1200, bicycle/scooter 1500, tree 900) |
| props | 500 (hand_truck/sink/egg_tray/crates 900, counter_noodle 1500, shelf_unit 2000) |
| interiors | 800, tea/noodle shells 1500, hideable walls 300 |

Each set script asserts its budgets, origin rule and base-at-zero and fails the build otherwise.

## Palette rule

Palette colour names from `tools/blender/lib/palette.py` only. No raw RGB
in set scripts, no textures, no UVs, one material slot per colour. To add
a colour, add it to `palette.SPEC` with a one-line description of where it
is used. No per-set colour blocks.

## Adding a set

1. `tools/blender/sets/<set>.py` from the template in `tools/blender/README.md`:
   delete old GLBs, build each asset as one joined mesh, assert budget and
   origin, `export.export_glb`.
2. Collect entries `{name, file, tris, size_m, origin, anchors, ...}` and call
   `lib.manifest.write(OUT, entries)`, with `blender_frame=True` if anchors are
   authored in Blender axes. It normalises the shapes above, validates them
   and sets `frame`.
3. Add the set name to `lib/manifest.SETS` and `build_all.ORDER`.
4. Render `assets/<set>/sheet.png` (`lib.sheet.render_sheet`, true scale) and
   look at it. If the assets belong on the street, place them in
   `tools/blender/mockup.py` through their anchors. The mock-up ground-checks
   every placed instance with ray casts.

## index.json

`assets/index.json` = `{frame, axes, sets:{set:{count, tris}}, assets:[...]}`,
where every asset is its manifest entry plus `set` and `path` (relative to
`assets/`). Cross-set references (`external`, e.g. the interiors entry
pointing at the street stool) are left out; the owning set lists the asset.
