# Make It in China — art and audio bible

Version 1.0 · 2026-09-18 · Phase 1 only. Implement with [GDD.md](GDD.md) and [TDD.md](TDD.md). [ASSETS.csv](ASSETS.csv) lists each logical asset and each speech variant separately. `planned` means not produced; `existing-review` means a candidate file exists, not that it meets this specification. No final assets are generated in this design task.

## 1. Visual rules

Warm low-poly neighbourhood, flat colours, dark silhouette outlines, calm third-person framing. Use the local reference notes for mood, never copy another game's assets, licensed characters, people, music, or UI portraits. Every human has a blank head without eyes/nose/mouth in mesh, texture, accessories or shadows. No animal models; 猫/狗 are text-only labels. No alcohol bottles, gambling props, weapons, suggestive decoration, or supernatural symbols.

Human standing height 1.7 m, head 0.2833 m (1/6), shoulders 0.44 m, torso 0.55 m, leg length 0.82 m, hand length 0.16 m. Head a softly bevelled capsule without facial indentation; mannequin ear geometry also removed to keep silhouette simple. All people share rig proportions; clothes alter silhouette width by maximum ±12%, not bone lengths. Fixed player outfit: oatmeal jacket, indigo trousers, small tan canvas bag. No selectable outfit screen in Phase 1.

| Shape family | Rule |
|---|---|
| Buildings | 1 storey, 3.2 m walls, 0.6 m roof lip, 2.4 m clear door, 0.08 m bevels |
| Street | 60×40 m, 8 m pedestrian corridor; paving slabs 1×1 m; 0.05 m visual curb, not step collision |
| Small props | 6–12 radial segments; bevel0.01–0.03 m; maximum3 material colours |
| Vegetation | Rounded polygonal clusters; no leaf textures, animal silhouettes or individual foliage animation |
| Text | Actual DOM glyphs projected to world; no illegible painted pseudo-Chinese or text rendered into WebGL |
| Materials | Flat diffuse palette; no photographic textures, PBR maps, normal maps, grain/noise overlays or shiny metal |
| Animation | Weight through torso/arms and held objects; no facial emotion or lip movement |

## 2. Palette and time of day

All hex colours are sRGB authoring values. Material slots use named palette roles, not arbitrary imported atlas pixels. Character colours remain stable through the day. Only light/fog tint changes; hanzi/UI do not receive scene lighting.

| Phase 1 district role | Hex | Usage |
|---|---|---|
| ink | #171717 | Outlines, main text |
| paper | #FFF7E7 | Bubbles, notebook pages |
| plaster | #E7D6BA | Main walls |
| paving | #CBBCA6 | Street and interiors |
| wood | #936C4C | Doors, shelves, benches |
| terracotta | #C65D3B | Noodle apron, lantern accent |
| sage | #6D8963 | Delivery rack, planter leaves |
| slate | #526D82 | Room trim, bus board, gate |
| ochre | #D7AD55 | Fruit canopy, helpful focus accents |
| teal | #455A64 | Warehouse vest/door |
| plum | #7E57C2 | Customer outfit |
| umber | #8D6E63 | Mentor cardigan |
| olive | #5B7C4D | Delivery jacket |
| clay | #B56A3D | Fruit seller tunic |
| periwinkle | #5C6BC0 | Shopkeeper waistcoat |
| skin blank A / B | #CFA77D / #98755C | Featureless heads/hands; alternate by NPC, no facial detailing |
| focus | #245D72 | Keyboard ring and selected reply border |
| muted text | #58636A | Secondary English copy on paper |

| Day-slot palette | Sky / fog | Fog near / far / density | Sun | Hemisphere sky / ground | Ambient shadow tint |
|---|---|---|---|---|---|
| M,A1 morning | #DCE9E7 | 28 m / 82 m / 0.010 | #FFF0CF | #E8F1EA / #B6A489 | #7D939B |
| A2 midday | #D5E8EF | 34 m / 90 m / 0.008 | #FFF8E6 | #E6F1F6 / #C0AD8E | #788E9B |
| A3 afternoon | #E9DDC7 | 26 m / 76 m / 0.012 | #FFDCA8 | #F3E6CD / #BA9E7D | #8F8989 |
| A4,E evening | #B6C0D2 | 20 m / 66 m / 0.016 | #F2BC87 | #D5DBEA / #9A897E | #6C758F |

Fog uses the listed linear near/far range; density is the matching exponential design constant recorded for visual regression and is not combined with linear fog in one render. Phase 1 uses linear fog and retains density as exact fallback calibration. Lighting values remain directional2.0 / hemisphere1.2, no exposure change. Evening must remain readable at normal display brightness. Interpolate palette over1.0s at activity end; reduced motion switches over0.15s. No full dark/night gameplay; sleep is 0.25s fade out, 0.25s hold, 0.25s fade in, all text labels stay accessible.

Toon ramp: 3 steps [70,165,255], non-colour NearestFilter, no mipmaps. Hull ink #171717, width1.5 CSS px desktop/1.0 phone, max world expansion0.025m. These values intentionally match the current `src/render/toon.ts` baseline. Small props under0.15m omit hull; body and hat outlines remain. No postprocess bloom/DOF/SSAO; their cost/readability tradeoff is excluded from Phase 1.

## 3. Camera framing and UI skin

```text
WALKING 16:9                       CONVERSATION 16:9
+-----------------------------+  +-----------------------------+
| HUD     45° vertical FOV     |  | HUD         shop sign       |
|    skyline / sign landmark   |  |      NPC       player       |
|          destination        |  |    name + speech bubble     |
|              head           |  |       [hanzi replies]       |
|              body 16–20% H   |  |          [Say]              |
|--------------feet at64%-----|  |                             |
|      clear floor/control tip|  | safe text margins24px       |
+-----------------------------+  +-----------------------------+
PORTRAIT 9:19.5                    INTERIOR
+-----------------+              +-----------------------------+
| HUD/objective   |              | roof hidden in room volume |
| landmark + NPC  |              | back wall +2 props          |
| player          |              |        NPC   player         |
|-----------------|              | camera retracts1.2–9m      |
| name / hanzi    |              | door sightline stays clear |
| replay / slow   |              +-----------------------------+
| reply1 [audio]  |
| reply2 [audio]  |       Camera35° pitch /9m target distance;
| [Say]           |       never put a head or held item behind
+-----------------+       the phone dialogue sheet.
```

Camera character scale follows WATERFALL's follow view: 16–20% rather than the older fixed-camera 1/8 ideal. Preserve destination signs above the dialogue sheet. During dialogue use a target midpoint with player offset0.8m sideways; blend0.35s using the same occlusion solver. Reduced-motion mode keeps the existing camera and moves the DOM sheet only.

| UI token | Value |
|---|---|
| Panel | #FFF7E7, radius12px, border2px #171717, shadow0 4px 0 rgba(23,23,23,0.18) |
| Body English | system sans fallback + bundled Latin subset;18px desktop,17px phone; line-height1.5 |
| Hanzi dialogue | Noto Sans SC subset Regular;26px desktop,24px phone; line-height1.65 |
| Pinyin/gloss |18px /16px; pinyin tone marks never cropped |
| Name label |20px, weight600; no portrait/face thumbnail |
| Buttons | min48px high; padding12px16px; selected border3px focus colour; same fill for all reply correctness |
| Focus |3px #245D72, offset3px; visible on every keyboard element |
| Spacing scale |4,8,12,16,24,32 CSS px |
| Bubble | max560px desktop; phone full width−32px; maximum3 hanzi lines before vertical scroll |
| Text expansion |1.0/1.25/1.5 setting plus browser200%; dialog can scroll independently |
| HUD | top16px, safe-area inset added; wallet text22px; day/slots18px; no red hearts |
| Toast |2s; ±yuan number18px, vertical drift8px over0.2s; reduced motion no drift |
| Sheet transitions |opacity150ms, translate12px; reduced motion opacity only100ms |

Typography: bundle Noto Sans SC Regular and SemiBold subsets, preserve SIL OFL licence; Latin includes English, digits, tone vowels ā á ǎ à and equivalents incl ü/ǖ/ǘ/ǚ/ǜ, punctuation. The [Noto CJK project](https://github.com/notofonts/noto-cjk) provides the source fonts. Generate glyph union from all content, signs, NPC names, English explanation-only 您, and UI strings; include replacement glyph and space. Maximum450 distinct Han glyphs in initial budget; build fails and reports count if exceeded rather than dropping characters. Two WOFF2 subsets combined≤550KB; licence≤10KB. Bengali later adds its own licensed font, not CJK glyph substitution.

Sign panel lettering: horizontal left-to-right,2–4 Han glyphs at equivalent32px projected minimum when within8m; max48px to avoid crowding. Clinic/price labels24px. Signs farther than14m hide; minimum screen readability18px; no fake strokes. Sign board is a blank GLB, its text is a DOM overlay with world-facing/occlusion tests. Menus, receipts and phone cards use the same glyph pipeline; no separate painted labels that escape checking.

## 4. Character sheets and voices

Colour/rig names are stable asset IDs. Outfit rows are material/attachment recipes over shared body and skinned outfit-shell LODs (coat/cardigan/apron/vest/tunic); do not duplicate all10 animations in9 GLBs. Head is a dedicated mesh/skin region replaced by the same blank primitive at build time. Review all LODs with front/side/back thumbnails and no source-texture residue.

| Asset / NPC | Outfit colours | Headwear / prop / width cue | Blank skin |
|---|---|---|---|
| char_player | jacket#E7D6BA, trousers#526D82, bag#936C4C | Small canvas bag, no hat; neutral straight body | A |
| char_landlord | coat#526D82, trousers#455A64, trim#D7AD55 | Navy cap, key ring; straight coat1.05×width | B |
| char_mentor | cardigan#8D6E63, scarf#E7D6BA, trousers#526D82 | Closed book; long hem1.0×width | A |
| char_cook | apron#C65D3B, shirt#FFF7E7, trousers#455A64 | Cream cap, towel; apron1.12×width | B |
| char_warehouse_boss | vest#455A64, sleeves#D7AD55, trousers#526D82 | Clipboard; squared vest1.10×width | A |
| char_delivery_boss | jacket#5B7C4D, strap#936C4C, trousers#455A64 | Parcel/carry strap; narrow0.92×width | B |
| char_fruit_seller | tunic#B56A3D, apron#E7D6BA, trousers#526D82 | Straw hat, apple; rounded1.08×width | A |
| char_shopkeeper | waistcoat#5C6BC0, shirt#FFF7E7, trousers#455A64 | Basket; narrow0.95×width | B |
| char_customer | coat#7E57C2, trousers#526D82, bag#E7D6BA | Shopping bag; loose1.06×width | A |

| Voice owner | TTS voice / rate / pitch | Direction |
|---|---|---|
| Player | zh-CN-YunxiNeural /−10% /+0Hz | Calm adult, plain acknowledgement; never celebrate a correct answer theatrically |
| Landlord | zh-CN-YunyangNeural /−12% /−4Hz | Short pauses between practical details; reassurance without baby talk |
| Mentor | zh-CN-XiaoxiaoNeural /−15% /−2Hz | Warm, separated examples; English explanation remains unvoiced |
| Cook | zh-CN-YunjianNeural /−10% /+2Hz | Clear work rhythm, numbers distinct; no shouting |
| Warehouse employer | zh-CN-YunyangNeural /−8% /−8Hz | Deliberate noun/count contrast, neutral firmness |
| Delivery employer | zh-CN-XiaoxiaoNeural /−8% /+2Hz | Friendly directions, preserve place-word stress |
| Fruit seller | zh-CN-XiaoxiaoNeural /−12% /−6Hz | Conversational price call, no exaggerated street-vendor accent |
| Shopkeeper | zh-CN-YunyangNeural /−10% /+1Hz | Even paced labels and prices |
| Customer | zh-CN-YunxiNeural /−10% /+4Hz | Curious and relaxed; funny outcome comes from props |
| Notebook words | zh-CN-XiaoxiaoNeural /−15% /+0Hz | Isolated dictionary pronunciation, no appended English |

Pitch is a build-time prosody setting in Hz, not runtime sample detuning. Slow replay0.8× preserves pitch. Native review checks 一/不 sandhi, neutral-tone suffixes, number distinctions, place words and all introduction clips. If generation mispronounces a phrase, revise allowed in-level punctuation/text and regenerate; no runtime TTS calls. The player voice is unique. For every shared provider voice, speaking-character pitch presets differ by more than 2 Hz: Yunxi 0/+4, Yunyang −8/−4/+1, and Xiaoxiao −6/−2/+2. Cook alone uses Yunjian +2.

## 5. Environment and prop placement inventory

Quantities are instances; CSV contains one row per reusable output/LOD, not duplicates for each placement. Props omitted from a location's list must not appear as untracked decoration. Shared blob-shadow and steam-quad GLBs are also inventoried; procedural materials provide their soft alpha, never face textures. Build shell floors/walls/roofs/door frames into the location asset; use separate gate leaves for animation. All surfaces with text use DOM strings referenced by ID. Interior props have colliders when top width≥0.3m; countertop items do not.

| Area | Required props and quantities | Placement / purpose |
|---|---|---|
| Street | paving1, boundary_planter8, bush8, streetlight4, bench3, signboard8, lantern4, drain4, bicycle1 | Paving/borders in district_ground; bicycle parked by shop, no riding; landmarks match GDD |
| Room interior | bed1, quilt1, room_table1, chair1, wardrobe1, phone1, calendar1, book2, key_ring1, key_tray2, key_hook4, tv1, computer1 | Bed(−26,−11); table(−22,−11); no room-clutter loot |
| Noodle interior | counter1, sink1, dish_rack1, bowl8, cup8, chopsticks4, pot1, steamer2, rice_portion2, vegetable_plate2, teapot1, towel1, coaster2, tray2, dining_table2, chair4, menu_board1 | Keep doorway→washpoint width2.4m; dishes spawn only in corresponding count |
| Fruit stall | stall1, fruit_crate3, apple12, scale1, basket1, price_card3, tray1 | Price cards attach to display; no chance-based prices |
| Shop interior | counter1, shelf3, basket2, parcel6, carry_strap1, phone_topup_card1, price_card4, receipt1, label_card6 | Labels include 狗/猫 as text only; no animal imagery |
| Bus stop | bus_board1, bench1, timetable_card1, route_arrow2, transport_card3 | Text cards for 出租车/飞机/火车站; wrong-bus is short walking loop, no vehicle asset |
| Warehouse interior | crate12, pallet3, shelf2, clipboard1, loading_pad3, count_card10 | Grounded wobble mix-up; all crates within collision-safe pads |
| Tea interior | round_table2, chair4, book1, teapot1, cup4, kettle1 | Room for mentor/player silhouettes; no decorative bottles |
| Gate frontage | gate_leaf2, clinic_door1, doorbell2, delivery_pad2, parcel2, signboard2 | One residential/customer bell, one clinic bell; no clinic interior |
| Consequence pool | Reuse trays/cups/bowls/crates/calendar/book/apple/parcel; one highlight_ring | Maximum12 temporary prop instances; reset/return to pool on resume |

Mesh budget classes: building LOD0≤8,000 triangles / LOD1≤2,000; large prop≤1,200/300; small prop≤300/90. Every building gets LOD pair. Street repeated large props bench/streetlight/bush/bicycle/stall/shelf/crate get LOD pair; small handhelds do not need separate LOD files (hidden beyond18m). Player/NPC bodies share LOD pair. Boundary planters stay solid even when lower detail renders. No animated collision from decorative sway.

## 6. SFX and music

Procedural sounds are original code recipes to implement; source=owner in CSV. Recipes use deterministic noise seed17. Maximum8 simultaneous SFX, evict quietest/oldest; speech never evicted. Base levels below are pre-user-volume gains, not target output dBFS. Master compressor threshold−12dB, ratio3:1, attack0.003s, release0.25s, knee12dB.

| Asset ID | Trigger / recipe | Duration / gain |
|---|---|---|
| sfx_step_stone | Foot contact; highpassed noise600Hz, lowpass2400Hz |0.07s /0.08; every0.5s walk,0.35s run |
| sfx_step_wood | Interior step; noise lowpass900Hz +120Hz sine |0.09s /0.07 |
| sfx_cloth | Carry/turn; bandpass noise1200Hz |0.18s /0.05 |
| sfx_cup | Ceramic placement; sine880+1320Hz decaying |0.18s /0.10 |
| sfx_bowl | Bowl placement; sine660+990Hz |0.22s /0.10 |
| sfx_crate | Grounded box thud; noise lowpass300Hz |0.14s /0.12 |
| sfx_parcel | Paper rustle; noise bandpass1500Hz |0.22s /0.08 |
| sfx_door | Door latch; sine180Hz+filtered transient |0.20s /0.08 |
| sfx_gate | Wooden gate slide; noise lowpass450Hz |1.20s /0.10 |
| sfx_page | Notebook/book; bandpass noise1800Hz |0.16s /0.06 |
| sfx_select | UI select; sine440Hz |0.04s /0.04 |
| sfx_wage | Wage receipt; sine659 then784Hz, no coin jackpot |0.22s /0.08 |
| sfx_spend | Paper receipt; short cloth/noise |0.10s /0.05 |
| sfx_phone | Incoming S14; sine523/659Hz pair,2 repetitions |0.60s /0.07 |
| sfx_kettle | Steam cue; bandpass noise2200Hz |0.80s /0.035 |
| sfx_water | Sink pouring; noise lowpass1800Hz |0.70s /0.06 |
| sfx_apple | Apple placed; muted sine200Hz |0.08s /0.07 |
| sfx_sign_tap | Text/sign focus; sine330Hz |0.04s /0.04 |
| amb_street_bed | Wind/leaves filtered noise, no voices/birds |30s seamless /0.025 |
| amb_noodle_bed | Low-level filtered kitchen noise, no speech |30s seamless /0.025 |
| music_day | Original sustained tones C4,D4,E4,G4,A4;1 tone every8s;2s overlap |60s loop /0.08 |
| music_evening | Same tone set one octave lower;1 tone every10s;2s overlap |60s loop /0.06 |
| music_gate | Original C4→E4→G4 chord bloom, no fanfare |3s once /0.08 |

No wrong-answer buzzer, success chime per word, continuous footsteps in menus or recorded external music. Music timers use AudioContext time; pause cancels scheduled nodes with100ms fade. Music resumes at loop phase0 after explicit Resume. Audio catalog also includes 20 ambient spoken lines from GDD, voiced replay/hints/replies for every exchange,151 word clips, and3 fixed system lines: `sys_rent` landlord “钱，二十块。”; `sys_gate` mentor “你会汉语。”; `sys_sleep` landlord “睡觉。”. Every token in those lines is one of the 150 dictionary words; `sys_gate` does not add 说. System lines only play once their words are met; otherwise show English notice, no hidden early introductions. Context-specific ordinary consequences use starter “好。” in the relevant NPC voice and gestures; 8 voice-specific versions listed in CSV.

## 7. Blender bpy build outlines (not executable Python)

Each future script is deterministic, no online calls, inputs dimensional JSON + palette, output GLB/LOD1 + manifest record. All apply transforms, triangulate, weld outline normals, set feet/base atY0 after glTF axis conversion, validate metre bounds, remove cameras/lights, export only intended collections. Palette flat materials and named attachment sockets required. These are outlines, not files to run during design.

| Script outline | Ordered construction steps | Exact output limits |
|---|---|---|
| scripts/blender/signboard.py | 1: create2.4×0.12×0.65m bevelled board. 2: add two0.05m wood rails. 3: create named `text_anchor`0.01m above face; no font geometry. 4: apply ink/wood palette. 5: LOD removes bevel/rails. 6: export signboard and signboard_lod1 with matching anchor | LOD0≤360tris/20KB; LOD1≤72tris/8KB;2materials |
| scripts/blender/lantern.py | 1: lathe12-sided squashed sphere radius0.22m,height0.42m. 2: cap top/bottom rings0.12m radius. 3: add4 tassel prisms0.15m. 4: centre hanging socket at top. 5:6-sided LOD, single tassel. 6: export lantern pair; no text or luminous point light |≤480/120tris;24/10KB;3materials |
| scripts/blender/steamer.py | 1:12-sided cylinder radius0.22m,height0.14m. 2: model rim as solid stepped ring. 3: add6 lid slats0.03m wide. 4: separate lid pivot for lifted pose, no physics. 5:LOD6segments+solid lid. 6:export steamer pair |≤600/150tris;30/12KB;2materials |
| scripts/blender/fruit_stall.py | 1: counter2.8×0.8×0.9m. 2: four0.08m posts to2.5m. 3: canopy3.2×1.6m with6 broad material stripes, no texture. 4:attach3 crate sockets and3 DOM-price anchors. 5:LOD retains canopy outline and counter, removes underside slats. 6:export stall pair |≤1,200/300tris;60/20KB;3materials |
| scripts/blender/doorway.py | 1: frame opening2.4×2.6m using0.18m posts. 2: create two0.6m-wide leaves with named hinges at floor. 3: separate clinic panel1.2×2.2m and bell socket. 4:add lintel plaque anchor. 5:LOD removes bevel but retains pivot positions. 6:export doorway pair plus gate_leaf/clinic_door variants; collider remains authored world data |≤1,000/250tris;50/18KB per frame;2materials |

Additional scripts planned: `buildings.py` assembles8 shells+district ground; `furniture.py` creates flat interiors and small labels, including the authored parked bicycle; `character_prepare.py` normalizes the verified UAL rig, maps its existing clips, strips faces, bakes the four missing clips, and generates colour/accessory recipes; `lod.py` reduces static geometry while protecting silhouette/door/attachment vertices. Blender 4.2.3 LTS is installed at `~/.local/bin/blender`; running it remains an owner/orchestrator gate. Existing Kenney/KayKit assets may supply cup/bowl/bench/crate/streetlight/bush forms after uniform material conversion; if a candidate fails its budget, use the matching simple Blender primitive recipe and update provenance.

## 8. Asset inventory interpretation and art acceptance

CSV columns exactly `id,type,source,status,budget_kb,notes,licence`. type is char/prop/building/audio/ui. source exactly CC0 pack/Blender script/owner/TTS. The separate licence field records CC0, project-authored, service terms, or OFL-1.1; font rows therefore say OFL-1.1 rather than treating `owner` as a licence. A char recipe budget is only its manifest/material/attachment metadata; shared body+clip rows own geometry/animation bytes. Repeated props share geometry. Dialogue rows pending stage4 are exact reserved IDs and duration-derived caps, not a claim that full script/audio exists. IDs with `__vNNN` are each permitted full-line slot rendering, ordered per TDD. No wildcard rows hide unlimited future assets.

UI assets are DOM/CSS/icon recipes, not raster portraits. Keep controls/help glyphs simple local vectors or text. UI font, icon sheet, frame style, joystick, prompt, notebook tabs, wallet, slot pips, speaker/replay/slow, map arrow, logo wordmark, focus ring and all8 shop-sign text catalogs are individually listed. All unknown text is stage4 content, never generated on demand in the browser.

Art acceptance: orbit every human at close range and inspect both LODs; verify blank featureless heads and no animal faces. Walk both directions down street and identify all8 NPCs by silhouette at9m. Read all signs at8m and200% browser zoom. Compare morning/evening screenshots for stable character identities and ≥4.5:1 UI contrast. Inspect head/prop attachment during every clip. Verify correct outlines in motion and at LOD switch; no face-shaped UV remnant. Disable dynamic shadows: the Low scene still reads. Observe all12 consequences without facial expressions. Listen to introductions on phone speaker/headphones; reply/word audio never overlaps NPC speech. No final polish gate passes without an inventory/credit row for every shipped object and sound.

## Owner decisions needed

Identical cross-document register. No asset purchasing, generation service spending, public release, or production changes are authorised here.

| ID | Owner decision needed | Recommended default | Needed by |
|---|---|---|---|
| OD1 | Accept stages 1–3 design package and its explicit engine/content corrections | Approve this Phase 1 design; preserve WATERFALL fixed decisions | Before stage 4 build |
| OD2 | Name Mandarin voice/content reviewer | Owner appoints 1 native Mandarin speaker; review all introductions and 一/不 variants, then 20% of other clips | Stage 4 sign-off |
| OD3 | Confirm validation bars and tester recruitment | Keep 60%, 70%, 15-point, majority, 20% bars; 8 game testers and 8 matched drill testers | Before stage 9 |
| OD4 | Confirm release intent and voice redistribution clearance | Private free test; owner checks service/voice distribution terms before any public release | Before external distribution |
| OD5 | Confirm remaining identity defaults from PLAN | Working title unchanged; generic fictional city; fixed outfit; no stated origin/backstory; no animal characters | Before stage 8 lock |
