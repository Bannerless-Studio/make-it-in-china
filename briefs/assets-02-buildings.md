# Part 2: buildings set → tools/blender/sets/buildings.py → assets/buildings/

Follow briefs/assets-common.md.

## Goal
The 8 Phase 1 location fronts plus 3 filler facades and the street base tiles, as low-poly building shells the player walks in front of. Facade plus 1.5 m of return walls each side, a flat or simple pitched roof cap, interiors hollow (open front where the design says so). Each carries blank sign geometry and named anchors so hanzi text and NPCs are placed at runtime.

## Items (tri budget ≤ 6000 each unless noted)
1. noodle_shop — 6 m wide, 2 storeys (ground 3.2 m, upper 2.8 m). Open ground front with counter facing street, red awning across full width, blank horizontal hanging sign board above awning, one lantern hook each side (lanterns come from another set), two upper windows with AC unit shape, tiled roof cap.
2. rented_room — 3-storey walk-up 7 m wide, 9.5 m tall. Stairwell door with blank number plate, 6 windows with grilles, 3 AC units, laundry pole brackets, ground-floor closed shutter. Plaster walls, concrete plinth.
3. fruit_stall — 3.5 m wide, tarp roof on 4 poles (2.3 m), 3 tilted crate racks in front (empty; fruit crates from another set), blank price-board slot, hanging-scale hook. ≤ 2500 tris.
4. supermarket — 6 m wide single storey 3.5 m, full glass front with door, blank light-box sign across top, freezer chest silhouette visible inside, small step.
5. bus_stop — shelter 3 m × 1.2 m, bench, pole with blank route board (0.5 × 0.9 m vertical), kerb-edge yellow stripe block. ≤ 2000 tris.
6. warehouse — 9 m wide, 5 m tall, corrugated panel walls (as bevelled ridges, not textures), roller door half open, loading dock 1 m high with steps, blank sign board over door.
7. tea_house — 6 m wide, 2 storeys, dark wood lattice front, round moon-window on upper floor, blank vertical sign at door, small tiled eave over entrance, red doors.
8. district_gate — arch 6 m wide 5 m tall, two pillars, closed iron gate (bars), blank plaque over arch. ≤ 3000 tris.
9. filler_shutter — 5 m wide 2-storey closed shop, roller shutter down, blank sign.
10. filler_phone_shop — 4 m wide, glass front, blank light-box, bright trim.
11. filler_tailor — 4 m wide, wooden front, blank vertical sign, one window with a mannequin-less rail.
12. street tiles (≤ 200 tris each): road_straight (4 × 8 m slab), road_crossing (with zebra stripes as raised slabs), pavement_straight (2 × 8 m with kerb), pavement_corner, manhole, drain_grate. These must tile exactly: edges at ±half size, no bevel on the tiling edges.

## Anchors per building (in manifest.json)
sign_main {pos, size, normal}, sign_vertical if any, door {pos, facing}, npc_stand (where the shopkeeper stands), player_stand (where the player stops to talk), lantern_hooks [] if any. Positions relative to asset origin.

## Acceptance
- [ ] script exits 0; 11 buildings + 6 tiles exported; per-asset tris and size pasted; all within budget.
- [ ] manifest.json has anchors for every building (sign_main, door, npc_stand, player_stand at minimum).
- [ ] sheet.png rendered true-scale and looked at; describe in 3 lines what each building reads as at a glance and anything you fixed after looking.
- [ ] tile check: road_straight placed twice end to end has no gap (assert bbox edges).
