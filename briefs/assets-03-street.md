# Part 3: street dressing set → tools/blender/sets/street.py → assets/street/

Follow briefs/assets-common.md.

## Goal
The Chinese street dressing that makes the block feel like a real Chinese street. 20 props from docs/asset-list.md section C, plus signage blanks. Tri budget ≤ 800 each unless noted.

## Items
1. lantern — red paper lantern 0.4 m, gold caps, tassel. Origin at the top hook so it hangs from lantern_hook anchors.
2. lantern_string — 5 lanterns on a sagging cord 3 m wide, origin at left end hook. ≤ 2500.
3. steamer_stack — 3 bamboo steamers + lid, 0.45 m tall, 0.4 m diameter, woven-rim suggestion via ring bevels.
4. sign_hanging — blank horizontal board 1.6 × 0.5 m, wooden frame, 2 chains, origin at chain tops. Anchor: text_face {pos,size,normal}.
5. sign_vertical — blank 0.4 × 1.6 m board with bracket, origin at wall mount. Anchor text_face.
6. sign_aboard — A-frame menu board 0.6 × 0.9 m on pavement. Anchor text_face (front).
7. sign_lightbox — blank 2 × 0.6 m box sign with rim, origin at wall mount. Anchor text_face.
8. awning — red striped shop awning 4 m wide, origin at wall mount line; plus awning_small 2 m.
9. stool_plastic — red plastic stool 0.45 m.
10. table_folding — 1.2 × 0.6 m folding table.
11. ac_unit — wall AC outdoor unit 0.8 m with bracket, origin at wall.
12. power_pole — 7 m concrete pole with crossarm, insulators and a bundle of 3 sagging wires 1 m long stub each side. ≤ 1200.
13. street_lamp — 5 m lamp, curved arm, lamp head.
14. bicycle — 1.8 m, basket, kickstand. ≤ 1500.
15. scooter_delivery — electric scooter with insulated box on the back, 1.7 m. ≤ 1500.
16. bin_public — two-slot recycling bin 1 m.
17. planter_pot — clay pot with round shrub 0.9 m.
18. tree_street — round canopy tree 4 m with square grate at base. ≤ 900.
19. bollard — 0.9 m.
20. laundry_pole — pole with 3 hanging garments (flat shapes) 2.2 m.
21. water_urn — hot water urn on a cart 1.1 m.
22. red_door — double red door with gold studs and blank couplet strips either side, 2.4 × 2.6 m, origin at wall. Anchors couplet_left, couplet_right text faces.

## Acceptance
- [ ] script exits 0; all 23 GLBs exported (awning + awning_small count separately); per-asset tris and size pasted; within budget.
- [ ] manifest.json anchors: every sign has text_face; lantern/lantern_string/awning/ac_unit/sign_* document their mount origin in a `mount` field.
- [ ] sheet.png true-scale, looked at, 3-line description + what you fixed.
