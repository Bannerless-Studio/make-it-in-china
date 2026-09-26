# localhost:5179 — Make It in China (vertical slice)

Vite dev server, three.js isometric grey-box street. Do not start/stop it — assume already running.

## Confirmed flow
1. `browser_navigate` to `http://localhost:5179/`, viewport 1280x800 for desktop pass.
2. Scene loads immediately: red "面馆" (noodle shop) building top-right of default camera, faceless
   blocky mannequins (player + NPCs, indistinguishable by look alone) scattered on a beige grid street.
   HUD top-right (`#game-hud`): `20块 · 第1天` / `today: 洗碗 shift at 面馆`. Notebook button `#notebook-button`
   ("词本") bottom-right, tooltip top-left "Click or tap the street to walk".
3. **Click that reaches the cook and auto-starts dialogue**: click on the ground at approx
   `(870, 300)` in the *default* 1280x800 camera framing (near the shop's front step). Dialogue
   triggered on the very first click there (within <1s, no need to poll 8s). Camera then zooms in
   tight on the shop/NPC.
4. Dialogue DOM: `.npc-name` → `陈师傅 · 厨师`. `#dialogue-line` has `.word-tap` spans per hanzi word/phrase.
   Tap a `.word-tap` (real click or `el.click()`) → `#word-popup` shows `pinyin · gloss`, e.g.
   `bēizi · cup; glass`.
5. Reply buttons: `#reply-options .reply-button`. Real user clicks work when the bubble is on-screen;
   when it's off-screen (see bug below) use `el.dispatchEvent(new PointerEvent('pointerup', {bubbles:true}))`
   via `browser_evaluate` — handlers fire on `pointerup`, this reproduces real interaction faithfully.
6. Wrong reply → line changes to a short consequence (e.g. `这是杯子，不是碗。`), wallet -1, then returns to
   the *same* exchange (line + reply options identical to before). Confirmed exactly this in scene
   `p1_noodle_dishwasher_01`.
7. Finishing all exchanges in the scene hides `#dialogue-bubble` and pays a shift wage added to wallet
   as a lump sum (e.g. `+8块` shown transiently in `#game-hud` text, wallet jumped 19→27). This is a
   scene-completion payout, not a bug — don't mistake a jump >1 for a wallet-math error.
8. Notebook (`#notebook-button` at bottom-right, screen coords depend on viewport — use
   `getBoundingClientRect()` then real `browser_mouse_click_xy`, JS `.click()` on it did NOT open the
   panel in one earlier attempt): opens `#notebook-panel`, word list in `#notebook-words` as
   `<section><h3>group name</h3><div class="notebook-word state-{known|shaky|met}">hanzi · pinyin · gloss — state</div>...</section>`.
   Two sections seen: scene-specific group (e.g. "面馆") + `已会 · Starter words`.
9. `#export-save` populates `#save-string` (an `<input>`/`<textarea>`, read via `.value`) with a
   base64 JSON blob, e.g. `eyJ2IjoxLCJ3YWxsZXQiOjI3LCJkYXkiOjEsLi4u` → decodes to `{"v":1,"wallet":27,"day":1,...}`.
10. localStorage key `make-it-in-china.save.v1` persists across reload; `#hud-wallet`/`#hud-day` match
    pre-reload after a plain navigate (no special reload button needed).
11. Mobile viewport 390x844: no horizontal scroll (`document.documentElement.scrollWidth === clientWidth`).

## Static preview on 5180
Same app, `vite preview` build served at `http://localhost:5180/` — no HMR. Reachable-click
coordinate is viewport-relative, not fixed: `(870,300)` works at 1280x800, but at the default
1850x966 window the cook is reached at `(1108,600)` instead — always confirm with
`#dialogue-bubble.hidden` after a click+~1.5s wait rather than trusting one fixed coordinate.
Asset loading is inconsistent between full reloads: sometimes GLTF models 404 (HTML returned
instead of JSON) and the scene falls back to grey-box primitives (mannequins/boxes, matches the
5179 grey-box description); other times real Quaternius-style rigged character models + detailed
buildings/table/lamp load fine — same URL, no code change, likely a dev/preview server flakiness
or CDN/asset-path race. When primitives are used, ~14 `console.warn` fallback messages appear
(non-fatal). When real models load, 9 `console.error THREE.GLTFLoader: Couldn't load texture
Textures/colormap.png` appear every time — this is a genuine repeatable runtime error (missing
texture asset in the build), not just a favicon 404.

## Fixed 2026-09-18
- Dialogue bubble off-screen positioning — now clamped; `#dialogue-bubble` fully within viewport
  (verified left=469,right=821,top=256 in 1280x800) and `#reply-options` docked fixed bottom-center
  (bottom≈790/800, horizontally centered exactly). Real `browser_mouse_click_xy` on `.reply-button`
  now advances dialogue — no `dispatchEvent` workaround needed.
- Tokenizer dropping 碗: line "一个杯子，二个碗。" now yields 6 `.word-tap` spans (一/个/杯子/二/个/碗); tapping
  碗 shows `#word-popup` "wǎn · bowl". First-appearance words carry `.new-word` class with
  `text-decoration-line: underline` (computed style confirmed, e.g. 个, 杯子).
- "Duplicate-looking reply options" bug: re-verified 2026-09-18 on 5180, 3 fresh-save runs. The
  "你做几个？" exchange (5th exchange, scene `p1_noodle_dishwasher_01`) now always renders two
  genuinely distinct buttons `一个。one.` / `二个。two.` — text differs, no dupes. All 3 runs drew
  the identical pair though (template values look non-randomized, always cup_count=1/bowl_count=2)
  — data-level fix confirmed for distinctness, but slot variety across sessions is NOT actually
  exercised by current content.
- `#wallet-toast` race re-verified: NOT a bug in the runtime sense — toast shows `-1块` and
  `hidden=false` reliably within ~5-290ms of a wrong-reply click (polled via rAF in the same JS
  tick as the click) and correctly flips to `hidden=true`/empty text by 2.5s. The earlier "empty
  text" observation was a *test-harness* artifact: a separate `browser_evaluate` round-trip after
  the click has enough latency that the toast's own timeout had already fired. Use the
  same-tick-poll technique, not a follow-up round trip, to observe it.
- Scene-completion `+N块` toast: not captured this run (round-trip latency issue as above); would
  need the same same-tick-poll technique wired to the exact click that completes a scene — not yet
  automated, still outstanding.

## CRITICAL ENVIRONMENT BLOCKER (2026-09-18 regression run)
Mid-session, the shared Playwright MCP browser was hijacked by what looks like a **concurrent
automated process** (likely another agent/worker using the same browser instance for asset
sourcing): new tabs kept opening/navigating to itch.io (Quaternius animation packs, KayKit city
kit — an actual zip was downloaded to `.playwright-mcp/`), kenney.nl, hyper3d.ai, and Google/Bing/
DuckDuckGo image-reference searches for terms like "low poly chinese street noodle shop game
artstation" / "toon shaded chinese alley lanterns 3d" — clearly related to sourcing/researching
assets for *this* game, not anything I triggered. It got aggressive enough to hijack the
current/active tab within 1-3s of any action (even a fresh `browser_tabs new` tab), making
multi-step scripted flows (bugs 3-8 below) unreliable/impossible to verify in this run. Confirmed
via: grep of src/, dist/, content/*.json, vite.config.ts for itch.io/kenney/hyper3d/quaternius/
location.href/window.open — zero matches, so this is NOT app code, it's an external process
sharing the browser session. Before the next regression pass, ensure no other worker/agent holds
the Playwright MCP browser concurrently.

## Release-check findings 2026-09-18 (v0.0.1 candidate, static 5180)
- **NEW BUG — spontaneous landlord dialogue on fresh load.** After `localStorage.clear()` +
  reload (confirmed localStorage genuinely empty, day1/wallet20 state), `#dialogue-bubble` opens
  immediately (no click) with `王先生 · 房东` saying `今天做完了。` and a `好 · OK` button, no
  `#reply-options`. Clicking OK dismisses it and the game proceeds normally (cook dialogue reachable
  right after). Reproduced twice (plain reload and `?toon=1` reload). Cosmetic/confusing on first
  boot but not blocking — dismiss via OK before scripting further steps.
- `#hud-objective` DOES now update within a play session (fix vs earlier note): went
  `today: 洗碗 shift at 面馆` → `today: shifts complete` after finishing all of day 1's dialogue
  content (3 chained exchanges/scenes with 陈师傅, ending in `今天做完了。` + `好 · OK`, wallet
  20→46 total across 3 payouts of +8/+9/+10-ish). **NEW BUG**: this same `today: shifts complete`
  string persists into day 2 after sleeping (`#hud-day` correctly flips to `第2天`, wallet -2
  overnight cost 46→44) — objective never resets for the new day, and approaching the cook on day 2
  is a silent no-op (no dialogue, matches the day-1 "exhausted slot" bug but now spans days).
- `#reply-options` hidden/empty confirmed correctly after the final `好 · OK` of the day (`hidden`
  attribute set, 0 children) — the earlier "stale buttons" bug looks fixed.
- Cook dialogue chain observed as one continuous multi-exchange conversation (no separate re-approach
  needed) covering wash-up counting, water/tea serving, and a rice/dishes meal exchange, ending in
  the `今天做完了` line — content is richer than the earlier "exactly 2 scenes" note; that earlier
  finding is superseded.
- Exchange "你做几个？" (asks count of the *first-named* item, e.g. cups) now draws genuinely
  randomized numbers per fresh save: run A → options `二个`/`三个`; run B (separate clear+reload) →
  options `三个`/`一个`. Confirms per-session variety works (earlier note about non-randomized
  cup_count=1/bowl_count=2 was itself a snapshot of one seed, not a hardcoded value).
- Notebook 碗 row: `碗 · wǎn · bowl — known 额外 · bonus` — bonus tag present. Progress line:
  `28 / 150` (N/150 format confirmed).
- `?toon=1` produces **no visible rendering difference** from default — same shading/colors/models,
  same 5 GLTFLoader texture errors. If a distinct toon/cel-shaded pipeline is intended, it does not
  appear to be wired up (or the flag name/param is wrong).
- `#loading` element never observed present at any poll (immediately after reload, or +6s) — either
  it disappears in <0.1s or isn't rendered at all in this build. Not a fail per spec (spec only
  requires it show-then-disappear; can't distinguish "never appeared" from "appeared+vanished
  instantly" without finer polling).
- Consistent 5 `console.error THREE.GLTFLoader: Couldn't load texture Textures/colormap.png` on every
  load in this run (matches prior finding — real models loaded, not grey-box fallback this run).

## New bugs found 2026-09-18 (5180 regression, items 5-8)
- **`#hud-objective` never updates.** Text stays "today: 洗碗 shift at 面馆" through scene1
  completion, scene2 start/completion, and the 3rd (blocked) interaction — same string the whole
  day regardless of which scene is active/done.
- **Silent no-op when a day's action slots are exhausted.** Day 1 supports exactly 2 completed
  scenes with the cook (scene1 `p1_noodle_dishwasher_01` "你好，工作。", scene2 "你好，请。" — the
  water/tea/cup-count scene). Walking up and clicking the cook a 3rd time same day does *nothing*:
  no dialogue, no toast, no HUD change, no console message — confirmed via
  `document.body.innerText` diff before/after the click. Per spec this silent nothing is a FAIL;
  expected a "no more work today" / "come back tomorrow" message.
- **`#reply-options` doesn't hide/clear when `#dialogue-bubble` hides.** After a scene completes
  (bubble `hidden=true`), the last exchange's `.reply-button`s remain in the DOM, visible on
  screen, and presumably still clickable — stale UI left over from the finished scene, easy to
  mistake for a live prompt.
- Player-reach-NPC click coordinate drifts each time the player/NPC actually walk (expected), but
  worth noting for future runs: after finishing a scene, re-approaching the same NPC from a
  standing-adjacent position sometimes requires walking away first and re-clicking near the NPC —
  a click directly on the NPC's mesh while already standing next to it does not re-trigger.

## Known bugs / rough edges (as of 2026-09-18 check)
- **Duplicate-looking reply options** ("你做几个？" both `一个。`) and **`#wallet-toast` empty-text race**
  — NOT re-verified in the 2026-09-18 regression run due to the environment blocker above; scenes.json
  now uses `{cup_count}`/`{bowl_count}` templates for that exchange (data-level fix looks present) but
  runtime confirmation of distinct rendered text, and toast timing/text, is still outstanding — re-run
  once the browser is free of concurrent use.
- `browser_take_screenshot` with a relative `filename` saves to the **project root**
  (`/home/fiazul/Desktop/chinese_immi/<name>.png`), not the scratchpad — copy it out and delete the
  stray file from the project root afterward.

## Day-2 regression re-check 2026-09-18 (static 5180)
- Fresh `localStorage.clear()`+reload: `#dialogue-bubble.hidden===true`, no spontaneous landlord
  popup this run (earlier "landlord on fresh load" bug NOT reproduced here — may be intermittent).
  5 `Couldn't load texture Textures/colormap.png` console errors present every load (real models
  loaded, not grey-box fallback) — same known GLTFLoader texture-path bug, not zero as hoped.
- Reaching the cook: clicking directly on the cook's mannequin sprite at the shop table works
  reliably; clicking open ground several tiles away (e.g. the old `(870,300)` note) did NOT trigger
  a walk-to-NPC or dialogue in this run — camera panned toward the click point but the player
  mannequin barely moved and no interaction fired. Table/NPC screen position shifts a lot between
  camera pans, so re-screenshot and click the mannequin itself each time rather than trusting a
  fixed coordinate.
- Played day-1 scene1 (dishwasher cup/bowl counting, 5 exchanges: 好/不→杯子→碗→好→三个) all correct
  first try: bubble hid, wallet 20→28块 (+8 payout). `#hud-objective` stayed
  `today: 洗碗 shift at 面馆` the whole time (unchanged by scene completion — confirms known bug).
- Sleep (`睡觉`) button: `#hud-day` 第1天→第2天, wallet 28→26块 (-2 overnight), objective text
  reset to identical `today: 洗碗 shift at 面馆` string (NOT "shifts complete", but also not a
  distinct "(review)" variant — just looks like day-1's string reused).
- Day 2, re-approaching the cook (clicking the mannequin) DID start a new dialogue immediately —
  first line `你好，请。` (not a silent no-op this run, contradicts the earlier "silent no-op /
  spans days" bug note — looks fixed, or at least not reproduced with a fresh day-2 approach).
  Played 2 exchanges (好→水和茶) correctly, wallet unchanged at 26块 (no completion payout yet,
  mid-scene).
- Reload mid-conversation (day2, dialogue left open on "你喝水。" exchange): day/wallet persisted
  correctly (第2天/26块) AND the in-progress dialogue bubble resumed exactly where left off
  (same NPC, same line, same reply options) — this is dialogue-state persistence working as
  intended, not the "spontaneous unwanted popup" bug; don't conflate the two. A reload while no
  dialogue is active would be needed to re-check the "no bubble on load" criterion cleanly.

## GitHub Pages live check 2026-09-18
- `https://fiazul.github.io/make-it-in-china/` at 1280x800: all `models/*` GLTF/GLB requests
  returned 200 (character, buildings, street props, food props) — no 404s, unlike the flaky
  5180 static-preview behavior noted above. No app console errors (only favicon 404 + an unrelated
  stale duckduckgo.com 404 from browser history, both benign).
- Cook mannequin reached by clicking directly on the purple-suited mannequin standing at the shop
  table (not ground coords) — first line `你好，工作。`. 3 correct exchanges (好→杯子→碗) kept
  wallet unchanged at 20块; a deliberate wrong reply on the 4th exchange dropped it to 19块 with
  consequence line `这是杯子，不是碗。` — matches documented -1块 behavior exactly.
- Reload (no localStorage clear) correctly restored wallet=19块, day=第1天.

## preview.html (dev-only content preview, checked 2026-09-18)
- URL: `http://localhost:5179/preview.html`. `<h1>` = "Stage-4 content preview". Summary line:
  "13 scenes · 172 stable content sites · 150/150 HSK1 words · 116 placements".
- Red blocking banner: `section.banner.blocked`, text "STRICT CHECK BLOCKED" (bg `rgb(255,228,228)`,
  text `rgb(124,16,16)`). Below it, `<section><h2>Strict issues</h2><ul>...302 <li>...</ul></section>` —
  302 issue rows this run, format `RULE5 FAIL word:<hanzi>: missing per-word audio mapping` (repeats
  per HSK1 word — looks like every word is missing per-word audio, driving the block).
- Two `<select>` filters, no `<input>` filters: Scene select (`getByLabel('Scene All scenesS00 ·')`,
  14 options incl. "All scenes") and Rule select (`getByLabel('Rule All rulesRule 1Rule')`, 11 options
  incl. "All rules"). No stable `id`/`name`/`class` on either — use Playwright `getByLabel` text match
  or `document.querySelectorAll('select')[0|1]`.
- Selecting a scene value (e.g. `p1_arrival_00`) correctly filters `section.scene` to just that one
  (others get hidden, `offsetParent === null`); its `.exchange` children count = exchanges in that
  scene (5 for `p1_arrival_00`).
- Coverage table: single `<table>`, 151 `<tr>` (1 header + 150 word rows, one per HSK1 word). Rows
  below-threshold get class `coverage-low`. "150/150" text appears in the h1 summary line, not inside
  the table itself.
- Console: only a benign `favicon.ico 404`; no app-level JS errors on load.
- Section order top-to-bottom: `.banner.blocked` → `.controls` (the two selects) → "Strict issues" →
  "Scenes" (list of `section.scene`, each with `h2/h3` heading `S0N · scene_id` or bare `scene_id`
  for `_wrong`/mixup variants, and `.exchange` children) → "World content sites" → "Coverage" (the table).

## Stage-5 slice (WASD 3rd-person, checked 2026-09-18)
Controls changed from click-to-move to WASD/arrows + Shift run + E talk + right-drag orbit. Sections
above (click-to-move, `(870,300)` coordinate, etc.) are for the PREVIOUS build — do not reuse those
coordinates for movement now.
- Fresh load spawns player at the 家 sign with 王先生·房东 (landlord) already in range — `[E] Talk · 王先生`
  prompt div (`document.body.innerText.includes('[E] Talk')`, no stable selector found yet, just a
  floating div with that exact text) shows immediately on a clean `localStorage.clear()`+reload, no
  walking needed to reproduce prompt-appears behavior.
- **Gotcha**: if a save exists in localStorage, reload resumes an **already-open dialogue bubble**
  (e.g. mid-conversation with 陈师傅) which blocks WASD from doing anything visible — screen looks
  identical before/after holding W. Always `localStorage.clear()` + reload before a movement test.
- 9 DOM sign labels found via `[class*="sign"]` (no stable class name string, matched loosely):
  家, 饭店, 水果, 商店, 火车站, 工作, 茶, 前面, 医院 — one more than spec's "eight buildings" count.
- Touch controls: parent `#touch-controls` has `display:none` at desktop (correctly hides child
  `#joystick-base` even though the joystick div itself computes `display:block` — check the parent,
  not the joystick element, when testing "hidden at desktop"). At 390x844 `#touch-controls` becomes
  `display:block`; joystick (`#joystick-base`, ~112x112 bottom-left) + `Run` (48x48 circle) + `Talk`
  (~143x41 pill) buttons all appear bottom-right, matched via visible text `Run`/`Talk`/text content,
  no stable id found for the run/talk buttons themselves.
- Movement confirmed via `page.keyboard.down('w')`/`up('w')` for ~2s (`browser_run_code_unsafe`,
  must use `page.waitForTimeout`, NOT bare `setTimeout` — that throws `ReferenceError` in the
  Playwright server sandbox). Screenshot before/after showed camera moved substantially (walked
  through the 家 building's open doorway into its interior in ~2s). Shift+W moved noticeably further
  in the same 2s window than plain W — run confirmed faster than walk.
- **No collision detected**: walking (or running) straight at the 家 building's walls/doorway passes
  through into a hollow interior; continuing further can put the camera fully inside a wall mesh
  (screen goes mostly black/backface-culled with just a sliver of exterior geometry visible at an
  angle) — reproduced twice. Worth flagging as a real gap if the spec expects colliders.
- **Right-drag orbit**: a single `page.mouse.move(x2,y2)` with no `steps` after `mouse.down('right')`
  produced NO visible camera change (identical screenshot). Adding `{ steps: 20 }` (or any multi-step
  move) to generate intermediate mousemove events DID rotate the camera (pitch changed, more
  sky/hedge visible) — orbit works, but only responds to genuine incremental mousemove deltas, not a
  single jump. Use `steps` when scripting this.
- E-talk dialogue: pressing `e` while `[E] Talk · 王先生` prompt is shown opens `.npc-name` = "王先生 · 房东",
  line "你好。" / gloss "Hello.", a `.replay-button` (labelled "↺ audio" visually) and single
  `好 · OK` reply. No `<audio>` DOM element and no network request for any audio file
  (opus/mp3/wav) appears after clicking `.replay-button` — either audio isn't wired yet or it uses
  something not observable via `browser_network_requests`/DOM (e.g. not yet implemented).
- All `models/**/*.glb` requests returned 200 this run (character, buildings, street, food props) —
  no 404s, real models rendered (not grey-box), matches the GitHub Pages behavior noted earlier
  rather than the flaky 5180 preview behavior.
- Console: zero errors/warnings tied to this page during a fresh WASD-slice run (only a benign
  `favicon.ico` 404). Earlier `bindingCombinations is not defined` errors seen via
  `browser_console_messages({all:true})` are stale, from a **different** page/tab
  (`/src/preview/main.ts`, the content-checker preview) from earlier in the shared browser session —
  not reproducible on `http://localhost:5179/` itself; don't conflate the two when using `all:true`.

## Stage-5b smoke re-check 2026-09-18 (wall collision + speech audio fixes)
- **Wall collision now works**: holding W into the 家 building's doorway for 4s stops the player right
  at the threshold line (screenshot `docs/screenshots/s5b-wall.png`) — no longer passes through into
  the hollow interior like the earlier finding above. S/D/W combo + right-drag orbit (3 screenshots)
  showed close-up wall-plane views during orbit but never a black/backface-culled frame — orbit-near-wall
  fix also holds.
- Holding A for 8s toward the west edge: player ends stationary against the 家 building's west wall,
  consistent with a boundary stop (no fall-through, no glitch); could not confirm this is literally the
  *district* edge vs. just re-hitting the house wall from a different angle — no debug position global
  exposed (`window.__playerPosition` etc. all `null`/`undefined`).
- **Audio is wired now** (previous note above, "no audio observable", is superseded): `window.__audioState`
  = `{playing, lastId, contextState}` is a real global, updates live. `contextState` was already `"running"`
  pre-interaction in this Playwright session (no gesture-block observed here).
  - E-talk on landlord fires `/audio/phase1/<sceneId>_e<N>.opus`, 200, sets `lastId`.
  - `.replay-button` re-fires the same line's opus and flips `contextState` `unavailable→running`; a real
    `<span class="speaking-indicator" aria-label="Speaking">●●●</span>` appears while it plays (query
    `[class*="speak"]`, not a fixed class name assumption — worth confirming the class string in a future run).
  - Hovering a `.reply-button` for ~1s fires a *preview* opus at `<sceneId>_e<N>_r1.opus` (200) — reply-hover
    audio confirmed wired.
  - Notebook (`Tab` key opens `#notebook-panel`, not just click) rows are `#notebook-words button` with text
    `▶ word` / `▶ sentence`; clicking one fires `/audio/phase1/word_NNN.opus` and sets `lastId` to `word_NNN`.
  - Mute toggle: `#mute-button` (`aria-label="Mute speech"`, icon flips 🔊→🔇, `aria-pressed` true/false).
    State persists via localStorage key `make-it-in-china.audio.v1` = `{"master":1,"speech":1,"muted":bool}`
    — survives reload correctly.
  - **Gotcha**: `#notebook-panel` overlaps `#mute-button` and intercepts clicks even when the mute button is
    visually clear — must `page.click('#notebook-close')` before clicking `#mute-button`, or a real-mouse
    click on the mute button will retry-timeout.
- Console/network across this whole run: zero real errors, zero 404s (only a stale `favicon.ico 404` and
  `bindingCombinations is not defined` / `reading 'subscribe'`/`'settings'` entries visible under
  `browser_console_messages({all:true})` — those are leftovers from earlier reload cycles/tabs in the same
  shared browser session, not present when querying without `all:true` right after a fresh reload; don't
  conflate the two like the existing note above about `preview/main.ts` staleness already warns.

## Stage-8 visual smoke (static preview 4173, art pass) 2026-09-18
- Served at `http://localhost:4173/` (`vite preview`), same app/selectors as 5179. Title-menu overlay now
  appears first on load ("A MANDARIN STREET STORY" / "Make It in China", `New game`/`Import save`/`Settings`/
  `Help`/`Credits` buttons) — must `getByRole('button',{name:'New game'})` (or `Continue` if a save exists)
  before the actual 3D scene renders; a screenshot taken before this click is just the menu, not "spawn".
- Right-drag orbit is real but flaky under scripted `page.mouse` moves: many attempts with `steps` produced
  *zero* visible change; success came from a slow drag (`down` at one point, then many small
  `move(..., {steps:5})` calls each followed by `waitForTimeout(30)`, ~30px per step, held for ~750px total)
  — screenshot **while still holding the button down**, one `mouse.up` afterward. A second big drag right
  after the first can overshoot back past 360° to the original framing — don't chain two large drags, verify
  with a screenshot after each one.
  - Gotcha: starting the drag at a screen point near the `[E] Talk · <NPC>` prompt/mannequin can fire the
    talk interaction on `mouseup` (dialogue opens mid-drag) even though only the right button was used —
    the app appears to bind interact to generic `pointerup`/`mouseup`, not left-click specifically. Start
    orbit drags from open sky/street, away from any NPC prompt, to avoid this.
- WASD movement direction is relative to current player facing, not fixed world axes, and turning
  accumulates — repeated `D` then `W` bursts from the same spot can loop back to the starting building
  instead of progressing outward. The district is small/compact: from the 家 spawn, one clean
  `D (3s) + W (6s)` burst reaches the 工作 (workplace/warehouse) building; continuing `A(1.5s)+W(3.5s)`
  from there reaches 火车站 (train station); further wandering easily loops back to 家 rather than reaching
  新 buildings — budget movement bursts carefully, re-screenshot after every burst rather than chaining blind.
- No scroll-wheel zoom; `page.mouse.wheel` had no visual effect on camera distance.
- Sign labels (家/饭店/水果/商店/火车站/工作/茶/前面/医院) are only meaningfully positioned in the DOM
  (`getBoundingClientRect`) when the actual in-world 3D sign is on-screen; when off-screen they report a
  constant fixed placeholder rect (`x:-43,y:772` or similar) that does NOT change as the camera turns —
  don't use these rects as a navigation compass, they're not a live world-to-screen projection when hidden.
- HUD `End day` button opens a confirm modal ("END OF DAY / Sleep until morning?" with `Unused slots`/`Food`
  stat boxes and `Back`/`Sleep` buttons) — click `getByRole('button',{name:'Sleep'})` (non-exact match needed,
  exact:true found 0 — the accessible name may include extra whitespace/icon). Confirmed day 1→2 tick,
  wallet ¥20→¥18 (-2 food cost), same街 framing. No sky/fog/lighting change observed after sleep — daytime
  scene looks identical before/after; no `window.__timeSlot` or any time/light/sky/fog-named global exposed.
- Wall collision blocks entry through the 家 doorway entirely: holding W for 3s then another 2s from a fresh
  spawn stops the player at the exact same threshold pixel position both times (no fade, no interior, no
  furniture) — contradicts the earlier stage-5b note that collision merely "stops at threshold" implying a
  hollow interior beyond; in this stage-8 preview build the door does not open at all.
- Perf: `requestAnimationFrame` counted over 2s in-page gives ~60fps average (121 frames / 2008ms = 60.3fps).
  `window.renderer`/`.info` not exposed (as expected, confirmed absent).
- All `models/**/*.glb` requests (`character/UAL1_Standard`, `buildings/building-{a,b,c}`,
  `buildings/detail-awning`, `street/{streetlight,bench,box_A,bush}`, `food/{bowl-broth,chopstick,cup-tea,
  steamer,pot}`) return 200 on this build — no `/models/generated/*` path exists at all, and zero console
  errors/404s across the whole run (fresh loads, orbit, movement, sleep, collision test).

## Stage-9 redesigned DOM-UI smoke (static 4173, checked 2026-09-18)
- Title dialog default-focuses "New game" (or "Continue" once a save exists). **BUG — forward Tab is
  broken as a focus trap**: from any focused element inside the title dialog (and inside the Credits
  dialog, same bug), pressing `Tab` always snaps focus back to the FIRST focusable element instead of
  advancing to the next one — reproduced 5+ times, both dialogs. `Shift+Tab` (backward) works correctly
  and wraps normally (New game → Shift+Tab → wraps to last item Credits). Category: likely a shared
  focus-trap helper reused by every modal/sheet (title, Credits, Help, Settings, pause, sleep, save) —
  worth auditing all of them, not just the two tested here.
- **BUG — Escape-close does not restore focus to the opener** for Credits and Help (and likely
  Settings/pause/save, not individually re-tested): closing always leaves focus on "New game" regardless
  of which button opened the dialog. Real per-opener focus restore is expected per WAI-ARIA dialog
  pattern; this is a category issue in the same shared modal helper as the Tab-trap bug above.
- Settings: `input[type=checkbox]` pinyin toggle (2nd checkbox in `.settings-list`) + `select[aria-label="Text size"]`
  (100/125/150) persist correctly to localStorage key **`make-it-in-china.preferences.v1`** =
  `{"pinyin":bool,"textSize":number}` — confirmed surviving a full reload.
- HUD element rects (1280x800, day1 fresh load): day/slots `x24-85,y34-68`; wallet `x210-289,y37-65`;
  objective `x99-257,y102-132`; Menu `x374-457,y26-76`; mute `x301-361,y24-78`; Book `x1170-1264,y78-136`;
  End day `x16-132,y148-202` — no pairwise overlaps found.
- Dialogue bubble (E-talk on 王先生 landlord at spawn): NPC name chip `王先生 · 房东`, hanzi computed
  font-size 32.5px vs pinyin line 22.5px (clear hierarchy), `.previewing` class + background-color change
  applied to a reply button on real `browser_hover` (not just CSS `:hover`), `Speaking` indicator present.
  Hovering a reply fires `<sceneId>_eN_rM.opus` (200); pressing digit key (`1`/`2`) selects (adds
  `pressed`/`active` state, enables "Say selected reply"); `Enter` then confirms and advances the line —
  confirmed `.opus` dialogue-line requests keep firing per exchange (`p1_arrival_00_e1.opus` →
  `_e2.opus` → `_e3.opus` → `_e4.opus`, all 200).
- Wrong-reply behavior in this build's S00 scene (`p1_arrival_00`): picking the "wrong" option (你 for
  a "我 vs 你" exchange) deducted ¥1 (20→19) but did NOT repeat the same exchange — it advanced to a
  short unrelated filler line ("好。"/Okay) then returned to the ORIGINAL "是我。是你。" exchange with
  fresh options afterward. No hint card appeared after this single miss (scene may not implement the
  two-miss hint at all — not conclusively tested with 2 consecutive misses on the same exchange due to
  time budget).
- Pause (`Escape` mid-dialogue): dialogue state is preserved underneath the pause dialog (same NPC/line/
  options visible after Resume). Pause menu buttons: Resume, Controls & help, Settings, Save & import,
  Credits, Return to title.
- Save & import sheet: textbox starts empty; **must click "Export" first** to populate it — base64 JSON
  string appeared correctly (`eyJ2IjoxLCJ3YWxsZXQiOjE5...` decodes to save state) after Export click.
- End day → confirm sheet "Sleep until morning?" with Unused-slots/Food stat boxes, Back/Sleep buttons.
  Sleep: Day 1→2, wallet -¥2 (food), objective text correctly reset to the fresh day-1-style string (not
  "shifts complete" carried over — this earlier-build bug looks fixed in stage-9).
- Notebook (`Tab` key): `.notebook-word` classes seen: `state-known`, `state-shaky`, `state-met`, plus a
  `selected` modifier appended to the active row's class (e.g. `state-shaky selected`). One
  `▶ Hear word` button per detail row; clicking it fired `/audio/phase1/word_073.opus` (200).
- Phone 390x844: **overlap found** — with the dialogue bubble/reply-card sheet open, its bounding box
  (`x16-374,y305-828`) visually covers the on-screen `Run`/`Talk` touch buttons (`Talk` rect
  `x317-373,y700-756` sits fully inside/behind the reply-card sheet, confirmed by screenshot
  `docs/screenshots/ui-phone-390.png` — reply-card #2 visually extends to the bottom edge where Talk
  would be). Whether this blocks clicks (z-index/pointer-events) wasn't confirmed by an actual tap-through
  test — flag as a likely real touch-control-vs-dialogue overlap on narrow phones, worth a follow-up
  tap-through check.
- 360x740 and 390x844 both report `document.documentElement.scrollWidth === clientWidth` (no horizontal
  scroll).
- Accessibility: three `aria-live="polite"` regions exist — `#rent-notice`, `#wallet-toast`,
  `#notebook-detail` (no single generic toast/live region; multiple purpose-specific ones). Focus ring
  clearly visible on `Tab` (blue outline, screenshot `docs/screenshots/ui-focus.png`, shown on the
  "Continue" button once a save exists). `prefers-reduced-motion` emulation NOT tested this run — no
  `browser_emulate_media`-equivalent tool available in this Playwright MCP session; would need CDP-level
  emulation not exposed here.
- Console/network across the whole run: zero errors/warnings (`browser_console_messages({level:'error'})`
  returned 0 after the favicon-404 tab was gone), zero 404s — all `models/*.glb`, `audio/*.opus`,
  `audio/manifest.json`, and font requests returned 200.

## Stage-10 debug API + visual check (static 4173, 2026-09-18)
- New globals confirmed live: `window.__debug.position()` returns `[x,y,z]`; `__debug.teleport(x,z)` moves
  the player instantly (y stays 0); `__debug.setTimeSlot('M'|'A1'|'A2'|'A3'|'A4'|'E')` and `__debug.timeSlot()`;
  `__debug.fps()` returns a live rAF-based number (measured 60 both calls, 2s apart).
- Door-facing camera framing: `content/phase1/world.json` `locations[*].door.position` is `[x,0,z]` at the
  street edge, but "7m south (larger z)" only holds for the **south-row** buildings (rented_room, noodle_shop,
  fruit_stall, supermarket — door z=-6, teleport to z=door_z+7=1). For the **north-row** buildings (bus_stop,
  warehouse, tea_house — door z=6, building interior extends to z=11+), the street/open side is actually
  *smaller* z, so use teleport z=door_z-7=-1, not +7 — a literal "+7" walks the camera into/past the building.
  For `phase2_gate` (door faces west, footprint is a thin N-S wall at x=28-30), don't reuse the row offset at
  all — the neighboring supermarket (6m away in x) dominates the frame at x=21; a closer x=24,z=0 vantage
  correctly centers both gate signs (`医院`, `前面`) and the wall.
- Location→teleport point cheat sheet (x,z) used for facade screenshots this run: rented_room(-24,1),
  noodle_shop(-8,1), fruit_stall(8,1), supermarket(22,1), bus_stop(-24,-1), warehouse(-8,-1), tea_house(8,-1),
  phase2_gate(24,0).
- Walking through the 家 door: `page.keyboard.down('w')`/`up('w')` from teleport(-24,1) needs **two** ~2.5-3s W
  holds back-to-back (first stops around z=-5, right at the threshold collider; a second W burst continues
  through to z≈-12 inside) — a single ~2.5s hold only reaches the threshold, not the interior; don't mistake
  that for a stuck/blocked-collision bug.
- Interior render: once inside, the camera sees the bed/table furniture clearly with a sunlight patch through
  the open door — the south wall/roof between camera and player is being hidden while indoors (no need to
  orbit or find a special toggle), confirming the "roof fades over interiors" behavior works.
- Time-of-day (`__debug.setTimeSlot`) at the rented_room spawn: **M and A2 look visually identical** (same
  cool grey sky-tint on the background skyscraper silhouettes, same shadow angle) — no detectable lighting
  delta between those two slots in this build. **A3 is visibly warmer** (skyscrapers tint pale gold, ground
  lit warmer) and **E is clearly evening** (background buildings tint distinct orange/amber, ground goes
  darker brown) — E does read as evening. No streetlight/lamp prop was in frame at this vantage point so lamp
  emissive change could not be directly confirmed either way in this run.
- Characters: player mannequin renders cream/white top with tan lower body and no attachment visible from
  behind; landlord (王先生) renders a **navy cap + navy/blue shirt + tan waist-level accessory** — colors are
  visibly distinct from the player at a glance, both still faceless (confirmed from behind at teleport(-25,-4)).
  Could not get a clean face-on angle of the NPC (camera always frames from behind the player in this build,
  no orbit attempted this run) to inspect apron/bag prop detail more closely.
- Perf/console/network (desktop, one full walkthrough: 8 facades + interior + 4 time slots + character shot):
  `__debug.fps()` = 60 at both start and +2s; zero console errors/warnings (only the standing benign
  `favicon.ico 404`); all `models/**/*.glb` requests every reload returned 200, no other 404s.
- Phone 390x844 dialogue-vs-touch-controls overlap check: the actual tappable button is `#touch-talk` (56x56,
  bottom-right, NOT the same as the floating `#talk-prompt` "[E] Talk · <name>" text div — clicking/tapping
  the prompt div itself times out because the canvas intercepts pointer events there; you must click the real
  `#touch-talk` button coordinates). After opening dialogue this way, `#dialogue-bubble` bounding rect
  (`top=123,bottom=620,width=390`) sits entirely above both `#touch-talk` (`top=700`) and `#joystick-base`
  (`top=692`) — **no overlap this run**, contradicts the earlier stage-9 note about the reply-card sheet
  covering Talk at 390px width; that finding looks fixed (or was specific to a different dialogue state/scene
  with more reply text pushing the sheet taller — worth re-checking with a longer dialogue line if regression
  suspected).

## Stage-10 visual smoke round 2 (4173, v3 screenshots, 2026-09-18)
- `__debug.draws()` new global confirmed: 36 draw calls at fresh spawn (M slot), `fps()`=60. Both queried
  together via one `browser_evaluate`.
- **Gotcha — `teleport(x,z)` does not reset player facing.** Facing/orientation persists from whatever
  direction the player last moved. Teleporting then holding `w` can walk the WRONG way (e.g. away from a
  building into the street) if a prior movement in the same page session pointed the player elsewhere.
  Always do a fresh `page.goto()` reload (fresh facing) before scripting a `teleport()` + `w`-into-door
  sequence, don't reuse the same tab across multiple teleport/movement segments.
- **Gotcha — reload after using `__debug` mid-session can leave `Continue` permanently disabled** on the
  title screen (30s click timeout, button never becomes enabled) — likely the debug teleport/timeslot
  writes produced a save state the title screen's Continue-validity check rejects. Workaround: click
  `New game` instead of `Continue` after such a reload.
- Time slots at rental-room spawn (M/A2/A3/E), 2.5s settle each: **M and A2 are still visually
  near-identical** (same cool sky, same shadow angle/length) — reconfirms the stage-10 note, not fixed.
  A3 reads warmer (pale gold tint at sky edges). E shows a genuinely lit ochre/yellow window pane on the
  家 building (window changes from blue/dark to solid warm yellow) — window-glow criterion PASSES. E's
  sky patch (visible top-left past the hedge) is a fairly saturated flat orange, arguably NOT the "muted
  grey-blue, not saturated orange" spec target — worth a design check. No lantern prop was in frame at
  this vantage in any slot, so lit-lanterns criterion is untested here (need a vantage with a lantern
  prop in shot).
- Noodle-shop-row teleport `(-8,1)` in A2: zebra crossing, center-lane dashes, and a round manhole/drain
  disc on the asphalt are all clearly rendered; soft contact-shadow blobs under both the player and a
  passing pedestrian are visible. Screenshot `docs/screenshots/v3-noodle-A2.png`.
- Street life at rented-room spawn (A2, 20s+10s apart): only **one** background pedestrian (purple shirt)
  in frame, **zero** cyclists visible from that vantage; the pedestrian's screen position was pixel-identical
  between the two shots 10s apart — no observed movement in this window. A cyclist prop WAS seen elsewhere
  (bottom-left corner of `docs/screenshots/v3-player-back.png`, near the 工作 building) — cyclists exist in
  the world, just not always in a given 10s/one-vantage sample.
- Walking (`w`, 2.5s) straight at that same pedestrian: player stops adjacent to/overlapping the NPC: the
  NPC does **not** step aside (same screen position before/after) — soft "walk-into" collision exists but
  no yield/sidestep behavior. Screenshot `docs/screenshots/v3-npc-collide.png`.
- Player-from-behind (`docs/screenshots/v3-player-back.png`): plain cream top / tan lower body, no
  satchel/parcel/apron or any back-attachment prop visible — matches the stage-10 finding, still true here.
- Run test (Shift+W, 2s) in open street: **no clearly detectable FOV widening** — canvas edge content
  before/after run looks like the same lens, just moved forward (player screen-position stayed centered,
  world scaled/panned as if camera follows tightly behind, not leading ahead). First attempt at this test
  aimed at a building wall and clipped the camera INSIDE the wall geometry (screenshot
  `docs/screenshots/v3-run-before.png`/`v3-run-during.png`) — same "run overshoots collision" class of bug
  as the earlier no-collision notes; redo in open ground to test FOV cleanly next time.
- Entering 家 in slot E (two ~2.8s `w` holds from teleport(-24,1), fresh page reload first — see gotcha
  above): `position()` went 1 → -5.5 (threshold) → -12.2 (interior), matches the documented z path exactly.
  Interior screenshot `docs/screenshots/v3-interior-E.png`: bed + table visible, dim grey walls, no window
  visible/lit in this exact framing (camera facing away from the window) — can't literally confirm "glow
  vanishes" without a frame that includes the window, but no stray light leak observed either.
- **`End day` has no separate Sleep-confirm sheet in this build** (contradicts stage-8/9 notes about a
  "Sleep until morning?" modal with Back/Sleep buttons) — clicking `End day` once immediately advanced
  Day 1→2 and deducted ¥2, no modal appeared/needed confirming. Re-test: may be state-dependent (e.g. no
  modal when already indoors, or the modal was removed in a later build) — flag for follow-up.
- NPC-walking-after-sleep check was inconclusive: the sleep in this run happened while the player was
  standing INSIDE the 家 interior (empty room, no NPCs render indoors), so the post-sleep screenshot
  (`docs/screenshots/v3-npc-walk.png`) shows only the empty bedroom — can't confirm or deny NPC walking
  behavior from an indoor vantage. Re-run End day from an OUTDOOR position to actually test this.
- Console/network across the whole run: zero real console errors (only the standing `favicon.ico` 404),
  all `models/**/*.glb` and `audio/manifest.json` requests 200; `__debug.fps()` = 60 checked at start and
  again at the end of a multi-minute session.

## Selectors quick reference
- Stage-5 (WASD build): `#touch-controls` (parent, display none/block gates visibility),
  `#joystick-base`, prompt text `[E] Talk · <name>` (no stable selector), `.npc-name`,
  `.replay-button` (audio replay), reply text `好 · OK`.
- Audio: `window.__audioState` = `{playing, lastId, contextState}`; `#mute-button`
  (`aria-label="Mute speech"`); `.speaking-indicator`; opus URLs `/audio/phase1/<sceneId>_e<N>.opus`,
  `..._r1.opus` (reply preview), `/audio/phase1/word_NNN.opus` (notebook word/sentence play);
  localStorage `make-it-in-china.audio.v1`. Notebook opens via `Tab` key; rows `#notebook-words button`
  text `▶ word`/`▶ sentence`; close with `#notebook-close` before clicking anything behind the panel.
- HUD: `#game-hud`, `#hud-wallet`, `#hud-day`, `#hud-objective`, `#wallet-toast`
- Dialogue: `#dialogue-bubble`, `.npc-name`, `#dialogue-line`, `.word-tap`, `#word-popup`
- Replies: `#reply-options .reply-button` (pointerup handler)
- Notebook: `#notebook-button`, `#notebook-panel`, `#notebook-words .notebook-word.state-{known|shaky|met}`
- Save: `#save-string`, `#export-save`, `#import-save`; localStorage key `make-it-in-china.save.v1`
- Preferences (stage-9): localStorage key `make-it-in-china.preferences.v1` = `{"pinyin":bool,"textSize":100|125|150}`.
- Stage-10 debug API: `window.__debug.position()`, `.teleport(x,z)`, `.setTimeSlot('M'|'A1'|'A2'|'A3'|'A4'|'E')`,
  `.timeSlot()`, `.fps()`, `.draws()` (renderer draw-call count). Phone touch-talk button is `#touch-talk`
  (56x56), NOT the `#talk-prompt` text div. `teleport()` doesn't reset facing — reload before scripting a
  teleport+walk sequence.
