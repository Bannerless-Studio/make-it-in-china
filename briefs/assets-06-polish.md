# Part 6: polish + integration → street mock-up

Follow briefs/assets-common.md rules (except: you MAY edit tools/blender/lib/ and every set script now — no other worker is running).

## Goal
All five sets (characters, buildings, street, props, interiors) exist. Make them one coherent library: single palette, one manifest convention, one build command, and a rendered street mock-up that places real buildings on real road tiles with dressing, props and characters, proving scale and style agree. Fix the small follow-ups below.

## Tasks
1. Palette merge: move every set's EXTRA_COLOURS block into lib/palette.py (dedupe: dark_wood vs wood_dark → keep one, update callers), delete the per-set blocks. All set scripts must still run unchanged.
2. Manifest convention: standardise every assets/<set>/manifest.json to glTF/three.js axes (x right, y up, +z = front/street). Interiors currently uses Blender axes: convert its anchors and slots. Every manifest entry gets `frame: "gltf"`. Write docs/asset-conventions.md: axes, origin rules (feet/wall/hang/grip), anchor schema (text_face {pos,size,normal}, npc_stand, player_stand, mount, slots), tri budgets, palette rule, how to add a set. Also generate assets/index.json that concatenates all manifests with a `set` field.
3. Interiors shells: replace the 1 m cut-away side wall with a full-height wall exported as a SEPARATE GLB per shell (room_shell_wall_x.glb etc.) so the game can hide it; the shell itself keeps the wall opening. Manifest links them (`hideable_walls`).
4. Characters fixes: landlord height 1.62 (keep stocky); customer_a_red recolour → khaki_brown (rename file customer_a_khaki); add props: folding_fan (Old Wang), barcode_scanner (clerk), umbrella_closed. Re-run faceless + distinct assertions.
5. tools/blender/build_all.py: runs every set script in order, then writes assets/index.json, then renders the mock-up. Print a final summary table (set, count, total tris).
6. Street mock-up: tools/blender/mockup.py → assets/street_mockup.png (2400x1350) and assets/street_mockup.glb. Lay out: 6 road_straight + 1 road_crossing along X, pavement both sides, then along the far pavement in order: district_gate, tea_house, rented_room, noodle_shop (with awning is built-in; add lantern_string on its hooks, steamer_stack + sign_aboard + 2 stool_plastic + table_folding in front), fruit_stall (fill crate_slots with crate_apples/oranges/bananas, hanging_scale on hook), supermarket, filler_phone_shop, bus_stop on the pavement, warehouse at the end with box_stack + hand_truck on the dock. Near pavement: filler_shutter, filler_tailor, tree_street ×3, street_lamp ×3, power_pole ×2, bin_public, bollards, scooter_delivery + bicycle parked, planter_pots. Characters: player on the pavement in front of the noodle shop, cook at noodle npc_stand, fruit_seller at stall npc_stand, old_wang on bus_stop bench (standing beside is fine), courier by the scooter, cat by the noodle shop, pigeons at the bus stop, kid + customer_b walking. Use the manifests' anchors (npc_stand, lantern_hooks, crate_slots, laundry_pole_mounts with laundry_pole) — this is the test that anchors are right. Camera: the game's fixed high three-quarter view (lib/sheet ELEVATION/AZIMUTH), framed on the noodle shop block, Workbench with outline + cavity, warm background. Also render a second wider shot of the whole street.
7. Look at both mock-up renders with the Read tool. Fix anything that reads wrong (scale mismatches, floating props, anchors off, colours clashing). Do at least two look passes. Record what you changed.
8. Append a "Build status" section to docs/asset-list.md: what is built per set, counts, and the remaining gaps vs the original list.

## Acceptance
- [ ] `blender -b --python tools/blender/build_all.py` exits 0 end-to-end; paste the summary table.
- [ ] No EXTRA_COLOURS blocks remain in sets/ (grep); palette.py has them all, documented.
- [ ] All manifests have frame "gltf"; assets/index.json exists; docs/asset-conventions.md written.
- [ ] Interiors: 3 hideable wall GLBs exist and shells have full openings; manifest links them.
- [ ] Characters: landlord 1.62 head top; customer_a_khaki exists; 3 new props; assertions pass (paste lines).
- [ ] assets/street_mockup.png + wide shot rendered and looked at; 5-line description of what reads right and what you fixed.
- [ ] docs/asset-list.md build status appended.
