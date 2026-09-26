# Part 4: job props + food + shop goods → tools/blender/sets/props.py → assets/props/

Follow briefs/assets-common.md.

## Goal
Everything the three jobs and the buying scenes handle: warehouse boxes, kitchen items, delivery items, fruit and goods. These are the objects NPCs and the player pick up, count and hand over, so silhouettes must differ clearly by size class (the porter job teaches 大/小 and counting). Tri budget ≤ 500 each unless noted.

## Items
Porter: box_small 0.3 m, box_medium 0.5 m, box_large 0.8 m (same cardboard style, tape strip, size difference obvious), crate_wood 0.5 m, hand_truck 1.2 m (≤ 900), pallet 1.2 × 1 m, sack_rice 0.6 m (tied top), box_stack (3 mixed boxes joined, for set dressing).
Dishwasher: bowl_empty 0.16 m dia, bowl_noodles (noodles + chopsticks resting), bowl_soup (liquid disc + spoon), cup_glass 0.09 m, teacup 0.07 m, teapot 0.18 m, kettle 0.25 m, chopsticks (pair), spoon, tray 0.4 × 0.3 m, dish_rack 0.5 m with 4 plates in slots, wok_on_burner 0.5 m, sink_double 1.2 m (steel, taps) ≤ 900, counter_noodle 2.4 m with pass-through shelf and 3 bowls on top ≤ 1500.
Delivery: takeaway_box 0.2 m (with lid), takeaway_bag 0.3 m (plastic bag with knot), door_plate blank 0.2 × 0.1 m (anchor text_face), phone_in_hand not needed (characters set has smartphone).
Fruit and goods: apple, banana_bunch, orange, watermelon_slice, cabbage, tomato (all 0.08–0.3 m real scale), bao_bun on plate, dumpling_plate (6 dumplings), bottle_water 0.25 m, milk_carton 0.2 m, tea_box 0.15 m, egg_tray (30 eggs, ≤ 900), rice_bag 0.5 m, crate_apples / crate_oranges / crate_bananas (display crate filled, 0.5 m, ≤ 900 each), shelf_unit 1.8 m tall with 4 shelves of generic boxes/bottles ≤ 2000, freezer_chest 1.2 m with glass lid.

## Acceptance
- [ ] script exits 0; all listed GLBs exported (count them in the report); per-asset tris and size; within budget.
- [ ] Size-class check: box_small/medium/large heights assert 0.3/0.5/0.8 ±5%.
- [ ] manifest.json with sizes; door_plate has text_face anchor; counter_noodle has npc_stand (behind) and player_stand (front) anchors.
- [ ] sheet.png true-scale (small items will be tiny next to the shelf; also render a second sheet `sheet_small.png` in fit mode so food items can be judged). Look at both; 3-line description + fixes.
