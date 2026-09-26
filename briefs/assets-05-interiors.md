# Part 5: interiors set → tools/blender/sets/interiors.py → assets/interiors/

Follow briefs/assets-common.md.

## Goal
Furniture for the rented room, the tea house, and the noodle shop seating, plus a few interior wall pieces so a room can be dressed without a full building interior. Tri budget ≤ 800 each unless noted.

## Items
Rented room: bed_single 1.9 × 0.9 m with folded blanket and pillow, desk_small 1 × 0.5 m, chair_wood, wardrobe 1.8 m tall two-door, fan_wall (round cage fan on bracket), phone_charger_on_desk (tiny; optional), window_grille_panel 1 × 1.2 m (interior wall piece), room_shell (3 walls + floor, 3.5 × 3 × 2.6 m, open front toward -Y, door on the back wall) ≤ 800.
Tea house: table_round 0.9 m dia wooden, stool_wood 0.45 m, tea_set_tray (pot + 2 cups on tray) 0.35 m, lattice_screen 1.2 × 1.8 m, bench_wood 1.5 m, plant_bamboo_pot 1.4 m, tea_house_shell (walls + floor 6 × 5 m, open front, counter along back) ≤ 1500.
Noodle shop seating: table_square 0.7 m formica with steel legs, stool_plastic reuse note (from street set — do NOT duplicate; reference it in manifest as external), chopstick_holder + napkin box on table, menu_board_wall blank 1 × 0.6 m (anchor text_face), noodle_shop_shell (walls + floor 6 × 5 m, open front, kitchen pass-through window on back wall) ≤ 1500.
Common: mat_floor 1 × 0.6 m, calendar_wall blank (anchor text_face), clock_wall (faceless: no numerals, two hands), poster_blank (anchor text_face).

## Acceptance
- [ ] script exits 0; all listed GLBs exported and counted; per-asset tris and size; within budget.
- [ ] manifest.json: every shell has anchors door, npc_stand, player_stand, and a `furniture_slots` list of suggested positions; every blank board has text_face.
- [ ] sheet.png true-scale, looked at, 3-line description + fixes. Shells should render open-front so the inside is visible from the sheet camera (front = -Y; the camera looks from front-right).
