# Make It in China — Phase 1 asset list (Rodin build sheet)

Source: docs/design-doc.txt (Phase 1 scope, visual direction, no-face rule).
Target look: low-poly, flat colours, toon shading + outlines, fixed high camera. Characters ~1/8 screen height → detail is wasted, silhouette is everything.

## Rodin rules (read before generating)

- One object per generation. Never a whole street/scene — Rodin fuses geometry and you can't place things independently.
- Style suffix on every prompt: `low poly, flat solid colors, no texture detail, cel shaded, stylized game asset, single object, plain background`.
- Characters: `faceless, blank smooth featureless head, no eyes no nose no mouth`. Reject any output with a face; do not try to fix in texture.
- Prefer image-to-3D over text-to-3D for consistency: draw/generate one 2D concept sheet per set in one style first, then feed each object to Rodin. Text-only prompts drift in style between objects.
- Ask Rodin for quad/low-poly output where offered; still decimate + flatten materials in Blender. Export GLB, compress with gltf-transform.
- Signs: generate blank boards only. Hanzi text goes on at runtime (troika-three-text) so scenes.json can change it.
- Log every generation in CREDITS.md (prompt, date) — Rodin terms allow commercial use on paid tiers, keep proof.

## Priority tiers

- **T0** = M1 vertical slice (noodle shop only). Make these first, prove the shader pipeline on them.
- **T1** = rest of Phase 1 street, needed for M3/M5.
- **T2** = polish / variety, only after M4 playtest.

---

## A. Characters (9) — all faceless, one shared rig

Recommendation: keep the design doc's plan — Quaternius mannequin rig for body + animations. Use Rodin only for **head/hat/prop attachments** and outfit variants that get retargeted onto that rig. Rigging a raw Rodin mesh per NPC is the expensive path.

| # | Character | Tier | Distinguisher (silhouette + colour) | Carried prop |
|---|---|---|---|---|
| 1 | Player | T0 | plain hoodie, backpack, neutral colour (player-chosen tint later) | backpack |
| 2 | Noodle cook (employer 1) | T0 | white apron, tall paper hat, rolled sleeves | ladle |
| 3 | Mentor / neighbour ("Old Wang" — matches Jamil's game) | T1 | grey cardigan, flat cap, slight stoop | folding fan or tea flask |
| 4 | Landlord | T1 | vest over shirt, keys on belt, stocky | key ring |
| 5 | Warehouse boss (employer 2) | T1 | hi-vis vest, hard hat, clipboard | clipboard |
| 6 | Delivery dispatcher (employer 3) | T1 | yellow/blue courier jacket, cap, phone | insulated delivery bag |
| 7 | Fruit seller | T1 | straw hat, sleeve guards, sun-faded apron | scale |
| 8 | Supermarket clerk | T1 | red polo vest with pocket, name tag block | barcode scanner |
| 9 | Repeat customer | T1 | 3 recolour variants of one body, different bags | shopping bag / umbrella / phone |
| – | Bus driver (static, seen through window) | T2 | uniform shirt, cap | – |

Headwear set to generate separately (attach to head bone): paper chef hat, flat cap, hard hat, courier cap, straw hat, beanie, hoodie-up.

## B. Locations / building fronts (8) — one Rodin object each, facade + short return walls

| # | Location | Tier | Notes |
|---|---|---|---|
| 1 | Noodle shop front | T0 | open front, steamer stack outside, red awning, blank hanging sign board |
| 2 | Noodle shop interior kit | T0 | counter, wok stove, sink + dish rack, 4 tables, plastic stools (separate objects, see D/F) |
| 3 | Rented room building (3-storey walk-up) | T1 | stairwell door, AC units, laundry poles, blank door number plate |
| 4 | Fruit stall | T1 | tarp roof on poles, tilted crate display, hanging scale |
| 5 | Small supermarket | T1 | glass front, blank light-box sign, freezer chest visible |
| 6 | Bus stop | T1 | shelter, blank route board, bench |
| 7 | Warehouse | T1 | roller door half-open, loading dock, stacked crates |
| 8 | Tea house | T1 | wooden lattice front, round tables, blank lantern sign |
| 9 | Locked gate to Phase 2 district | T1 | arched gateway with iron gate, blank plaque |
| 10 | Filler facades ×3 (closed shutters, phone shop, tailor) | T2 | to fill gaps between locations |

Street base (not Rodin — model in Blender, needs exact tiling): road, pavement, kerb, crossing stripes, manhole, drain.

## C. Chinese street dressing (design doc: "plan to model 10–15") — Rodin sweet spot

| # | Prop | Tier |
|---|---|---|
| 1 | Red paper lantern (single + string of 5) | T0 |
| 2 | Bamboo steamer stack (3 tiers, lid) | T0 |
| 3 | Blank hanging signboard (horizontal) | T0 |
| 4 | Blank vertical shop sign | T1 |
| 5 | Blank standing A-board / menu board | T0 |
| 6 | Shop awning (red, striped) | T1 |
| 7 | Plastic stool (red) | T0 |
| 8 | Folding table | T0 |
| 9 | Wall AC unit | T1 |
| 10 | Power pole with wire bundle | T1 |
| 11 | Street lamp | T1 |
| 12 | Bicycle | T1 |
| 13 | Electric scooter (delivery type, with box) | T1 |
| 14 | Public bin (two-slot recycling) | T1 |
| 15 | Potted plant / small tree in pot | T1 |
| 16 | Roadside tree (round canopy) | T1 |
| 17 | Bollard | T2 |
| 18 | Laundry pole with clothes | T2 |
| 19 | Red door with couplets (blank strips) | T2 |
| 20 | Water dispenser / hot water urn | T2 |

## D. Job props (drive the three jobs)

Porter (numbers, 大/小, 个, 多少):
- Cardboard box small, medium, large (3 sizes, same style) — T1
- Wooden crate — T1
- Hand truck / trolley — T1
- Pallet — T2
- Sack (rice) — T1

Dishwasher (杯, 碗, 有/没有):
- Bowl (empty), bowl with noodles, bowl with soup — T0
- Cup / glass, tea cup — T0
- Teapot, kettle — T0
- Chopsticks pair, spoon — T0
- Dish rack, sink, wok on burner — T0
- Tray — T0

Delivery (places, 在, 哪儿, 前面/后面):
- Insulated delivery bag — T1
- Takeaway box, bagged order — T1
- Door number plate (blank) — T1
- Smartphone (held) — T1

## E. Food & shop goods (buying scenes, measure words)

| Item | Tier |
|---|---|
| Apple, banana bunch, orange, watermelon slice | T1 |
| Cabbage, tomato | T1 |
| Bao bun, dumpling plate, noodle bowl (see D) | T0/T1 |
| Bottled water, milk carton, tea box | T1 |
| Egg tray, rice bag | T1 |
| Fruit crate (display, filled) ×3 fruit types | T1 |
| Supermarket shelf unit (with generic boxes) | T1 |
| Freezer chest | T2 |

## F. Interiors (rented room + tea house)

Bed, small desk, chair, wardrobe, wall fan, kettle (reuse), phone charger — T1
Tea house: round table, wooden stool, tea set (pot + 2 cups on tray) — T1

## G. Not Rodin — still required for art pass

- Toon gradient map texture (2–3 step) + district palette swatch (6–8 colours, warm)
- Outline method decision (OutlineEffect vs inverted hull) — test on mobile
- CJK font subset (~300 glyphs used in Phase 1)
- UI: speech bubble, name label, wallet, day counter, notebook — HTML/CSS
- Audio: TTS per line + per word, 2–3 voices; ambient street loop; noodle shop loop
- Animations: from Quaternius library — idle, walk, carry, wash/scrub, hand-over, point, shrug (for "rephrase/gesture" fallback)

---

## Counts

| Set | Objects | T0 |
|---|---|---|
| Characters + hats | 9 + 7 | 2 |
| Buildings | 10 | 1 |
| Street dressing | 20 | 5 |
| Job props | ~20 | ~12 |
| Food/goods | ~15 | 1 |
| Interiors | ~10 | 0 |
| **Total** | **~90** | **~21** |

T0 (~21 objects) is the whole M1 vertical slice. Do those, get them through Blender → GLB → toon shader on a phone, then decide if Rodin's output actually fits the style before generating the other 70.

## Suggested Rodin workflow

1. Make one concept sheet image (same style, same lighting) for a whole set — e.g. all noodle shop props on one canvas.
2. Crop each object, feed to Rodin image-to-3D.
3. Blender: decimate, remove painted textures, assign 1 flat material per colour region, check no face on characters, origin at feet/base, +Y up, real-world scale (stool ≈ 0.45 m).
4. `gltf-transform optimize --compress meshopt`.
5. Drop into a test scene with the toon shader; screenshot from the fixed camera; keep or regenerate.

---

## Rodin shortlist — 15 generations (the ones actually worth the budget)

Rule: spend Rodin only on what free CC0 packs don't have. Generic props and characters come from Kenney / Quaternius / KayKit / Poly Pizza.

| # | Asset | Why Rodin | Reuse |
|---|---|---|---|
| 1 | Noodle shop front (open counter, red awning, blank sign slot) | M1 slice hero building | – |
| 2 | Bamboo steamer stack, 3 tiers + lid | Nothing like it in free packs | Outside noodle shop, tea house |
| 3 | Red paper lantern (single) | Instance into strings of 5 in code | Every shop front |
| 4 | Blank horizontal hanging signboard | Text added at runtime | All 7 locations |
| 5 | Blank vertical shop sign | Same | Noodle shop, tea house, supermarket |
| 6 | Rented-room walk-up (3 storeys, AC units, laundry poles) | Chinese residential look | Duplicate + recolour as filler facades |
| 7 | Fruit stall (tarp roof, tilted crates, hanging scale) | – | – |
| 8 | Small supermarket front (glass, blank light-box) | – | – |
| 9 | Warehouse front (roller door, loading dock) | – | – |
| 10 | Tea house front (wood lattice, round window) | – | – |
| 11 | Bus stop shelter (blank route board, bench) | – | – |
| 12 | Phase 2 gate (arch + iron gate, blank plaque) | – | Same mesh for later district gates |
| 13 | Delivery e-scooter with insulated box | Delivery job icon | Parked at dispatcher, ridden in cutaway |
| 14 | Noodle counter interior block (wok stove + sink + dish rack as one piece) | M1 dishwasher job set | – |
| 15 | Hot water urn / tea dispenser on cart | Distinctly Chinese street object | Tea house, noodle shop |

Swap-ins if one fails or comes out badly: red plastic stool, wall AC unit, power pole with wire bundle.

### Not Rodin — get these free

| Need | Source |
|---|---|
| All 9 characters + hats | Quaternius mannequin rig (faceless already), hats as Blender primitives |
| Boxes, crates, hand truck, pallets, sacks | Kenney / KayKit |
| Bowls, cups, teapot, chopsticks, food items | Kenney food kit, Poly Pizza (filter CC0) |
| Bed, desk, chair, tables, shelves | Kenney furniture |
| Bicycle, bins, street lamp, tree, bollard | Kenney city kit, Quaternius town pack |
| Road, pavement, kerb | Blender, must tile exactly |

---

## Character set — 15 Rodin generations (NPCs, player, pets)

### Base prompt (paste into every character, then add the line-specific part)

```
low poly stylized game character, full body, T-pose with arms straight out and legs slightly apart,
faceless: smooth blank featureless head, no eyes, no nose, no mouth, no ears,
chunky simple proportions, big head, short legs, mitten hands,
flat solid colors, no texture detail, cel shaded, clean silhouette, plain white background
```

Why T-pose: Mixamo auto-rigger (or Rodin's own rig option if your tier has it) needs arms away from body and one connected mesh. Hands touching body or a held prop fused to the hand breaks the rig. Generate held props separately and attach to the hand bone in three.js.

Same base prompt for everyone = same proportions = one skeleton works on all.

| # | Character | Add to prompt | Role in game |
|---|---|---|---|
| 1 | Player | grey hoodie, dark jeans, white sneakers, small backpack, neutral build | protagonist, recolour hoodie later for player choice |
| 2 | Noodle cook | white chef jacket, tall white paper chef hat, dark apron, rolled sleeves, sturdy build | employer, dishwasher job |
| 3 | Old Wang (mentor) | elderly man, grey knitted cardigan over white shirt, brown trousers, flat cap, slight forward stoop, thin | neighbour, evening explanations |
| 4 | Landlord | middle-aged, dark sleeveless vest over light shirt, belt with key ring, stocky, short | rent scenes, phone messages |
| 5 | Warehouse boss | orange hi-vis vest over blue work shirt, yellow hard hat, work boots, broad shoulders | porter job |
| 6 | Delivery dispatcher | bright yellow courier jacket with blue trim, yellow cap, black trousers, lean | delivery job |
| 7 | Fruit seller | woven straw hat, faded green apron, floral sleeve guards, plump, friendly build | fruit stall shopkeeper |
| 8 | Supermarket clerk | red polo shirt with vest, black trousers, name tag block on chest, average build | supermarket shopkeeper |
| 9 | Customer A, young | white t-shirt, light blue jeans, tote bag over shoulder, slim | repeat customer, recolour ×3 |
| 10 | Customer B, auntie | purple padded jacket, wide trousers, short permed hair shape, sun visor, pulling a shopping trolley (generate trolley separately) | repeat customer, market bargaining |
| 11 | Kid | yellow raincoat, red boots, school backpack, tiny | street life, wrong-bus scene |
| 12 | Bus driver | light blue uniform shirt, dark cap, seated pose OK (only seen through window) | bus scenes |
| 13 | Street cat | low poly orange tabby cat, sitting, faceless smooth head with ears, no eyes no mouth, stubby legs | pet, sits outside noodle shop |
| 14 | Small dog | low poly small brown dog, standing, faceless smooth head with floppy ears, curled tail | pet, follows player near rented room |
| 15 | Pigeon | low poly grey pigeon, standing, faceless, round body | flock instanced at bus stop, scatters when player walks |

Pets note: design doc left "do faceless rules apply to animals" open. Safest is yes, so all three above are prompted faceless. If the owner says animals can have faces, regenerate 13–15 only.

### After Rodin, per character

1. Blender: check no face geometry. Decimate to ~3–6k tris (they are 1/8 screen height). One flat material per colour. Feet on origin, +Y up, height 1.7 m adult, 1.1 m kid, 0.35 m cat.
2. Humans: Mixamo auto-rig (FBX in, FBX out), then download clips: idle, walk, carry box, hand over, wash/scrub, point, shrug, sit. Convert to GLB with one shared skeleton.
3. Pets: Mixamo has no quadruped rig. Either a 5-bone manual rig in Blender (spine, head, tail, 2 legs mirrored) with idle bob + walk, or keep them static with a code-driven bob and turn. Static is fine for Phase 1.
4. Headwear and held props (chef hat, ladle, clipboard, delivery bag, scale, keys, shopping trolley): generate as separate small objects, attach to head/hand bones. Six extra small generations if budget allows, else Blender primitives.

### Distinguishing at a glance (fixed high camera, no faces)

Every NPC differs in at least two of: headwear shape, torso colour, build. Quick check: cook = tall hat + white; Wang = flat cap + grey + stoop; landlord = vest + no hat + stocky; boss = hard hat + orange; courier = cap + yellow; fruit seller = straw hat + green; clerk = red + no hat; auntie = visor + purple. No two share a headwear-and-colour pair.

---

## Build status (procedural Blender library, polish pass 2026-09-26)

Everything below is built procedurally by `blender -b --python tools/blender/build_all.py`. Nothing comes from Rodin. Conventions: `docs/asset-conventions.md`. All assets: `assets/index.json`. Scale/style check: `assets/street_mockup.png` + `street_mockup_wide.png`.

| Set | Built | Count | Tris |
|---|---|---|---|
| characters | player, cook, old_wang, landlord (1.62 m, stocky), warehouse_boss, courier, fruit_seller, clerk, customer_a, customer_b, kid, bus_driver; recolours customer_a_khaki/green/blue; cat, dog, pigeon; props chef_hat, ladle, clipboard, delivery_bag, hanging_scale, key_ring, shopping_trolley, smartphone, folding_fan, barcode_scanner, umbrella_closed | 29 | 33,666 |
| buildings | noodle_shop, rented_room, fruit_stall, supermarket, bus_stop, warehouse, tea_house, district_gate, filler_shutter / phone_shop / tailor; tiles road_straight, road_crossing, pavement_straight, pavement_corner, manhole, drain_grate | 17 | 24,106 |
| street | all 20 list items: lantern + lantern_string, steamer_stack, 4 blank signs, awning (+ small), stool, folding table, AC unit, power pole, street lamp, bicycle, delivery scooter, bin, planter pot, tree, bollard, laundry_pole (standing) + laundry_pole_bar (wall-mounted), water urn, red door | 24 | 14,750 |
| props | porter (3 boxes, box_stack, crate, hand truck, pallet, rice sack), dishwasher (bowls x3, cup, teacup, teapot, kettle, chopsticks, spoon, tray, dish rack, wok, sink, noodle counter), delivery (takeaway box/bag, door plate), food/goods (all section E items incl. 3 filled crates, shelf unit, freezer chest) | 43 | 15,270 |
| interiors | rented room (bed, desk, chair, wardrobe, wall fan, phone+charger, window grille, room_shell), tea house (round table, stool, tea set, lattice screen, bench, bamboo pot, shell), noodle shop (formica table, chopstick holder, napkin box, menu board, shell), common (mat, calendar, clock, poster); 3 hideable shell walls | 27 | 8,802 |
| **total** | | **140** | **96,594** |

Remaining gaps against the original list:
- A: headwear is only exported separately for the chef hat. The other hats (flat cap, hard hat, courier cap, straw hat, school cap, sun visor, peaked cap, hood) are baked into their characters. A beanie and hoodie-up were never built. There is no tea flask for Old Wang (he has the fan). No shopping-bag variant apart from customer_a's tote.
- A: no rig and no animations. The shared skeleton, Mixamo/Quaternius retarget and clips (idle, walk, carry, wash, hand-over, point, shrug, sit) are not started. Characters are static T-pose meshes.
- B/C: filler facades have no recolour variants yet. There is no bus model (the bus driver exists).
- G: none of it is started: toon gradient map, outline method test on mobile, CJK font subset, UI, audio.
- Mock-up findings not yet fixed in assets: the noodle cook's npc_stand sits behind the counter under the awning, so the fixed camera cannot see him. Near-side filler buildings show only their blank backs to the camera. Characters are T-posed, so "walking" NPCs are just placed and turned.
