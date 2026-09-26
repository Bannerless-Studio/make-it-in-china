# world3d: rebase onto Jamil's current main (0.11.1) and cover the new content

Repo: /home/fiazul/Desktop/make-it-in-china/silver-tongue. Branch `world3d` = one commit f1a452d on top of 6f1eb9f (0.8.0). `origin/main` is 31 commits ahead (0.11.1). Remotes: origin = jamil314 (read-only for you), fork = Fiazul (do NOT push; the orchestrator pushes). Node: `export PATH="$HOME/.local/node22/bin:$PATH"`. A dev server on 8173 may be running; leave it.

## Goal
`world3d` rebased cleanly onto origin/main, all tests green (theirs + ours), and every new engine feature reachable in 3D. Commit the result on `world3d` as ONE new commit on top of the rebased commit (message: "world3d: cover 0.11 places and errands"), keeping f1a452d's message intact. Do not push.

## Steps
1. `git rebase origin/main` on world3d. Resolve conflicts (expected: package.json typecheck line, package-lock, pages.yml maybe). Run `npm ci`, `npm run build:course`, `npm test`, `npm run typecheck`. Our parity test should now FAIL on `errandStarted`/`errandEnded` and any new Input variants — that's the checklist. Diff 6f1eb9f..origin/main for packages/core/src/types.ts, packages/tui/src/app.ts, content/settings/china-city/world.json and content/settings/china-city/scenes/ to see everything new (errands, cost on replies, WALLET_REASONS "shopping", new places, new scenes, any new inputs/menus in app.ts).
2. New places in world.json: `station_road` (links market, school, hospital, station, tea_house), `school`, `hospital`, `station`, `shop` (links market), `tea_house`, and `stairs` (check what it is — linked from room). Give every place a walkable space in layout.json through the SAME SceneSpace data path (no special cases):
   - A second street space "Station Road" laid out from the same tiles/buildings: tea_house (assets/buildings/tea_house.glb exists; its interior shell exists in interiors set → make tea_house an enterable interior too), station (use bus_stop + a filler facade with a blank sign; NPC if any), school and hospital (filler facades with signs; keep simple), plus dressing. Connect Main Street ↔ Market ↔ Station Road by door/zone triggers consistent with links (goTo hops through the graph).
   - `shop` = the supermarket building (interior: shelf_unit, freezer_chest, counter from props, clerk NPC if content has a shopkeeper NPC).
   - `stairs`: read the content to see its purpose; map to whatever fits (a trigger between room and market or a small space).
   - Vendor any newly referenced GLBs (`npm run assets:sync -w @silver-tongue/world3d` from ../assets; sync copies only referenced ones — extend layout first).
   - NPCs: map every NPC in world.json to a character GLB + npc_stand (new ones → clerk, customer_b, bus_driver, etc. by role; list your mapping).
3. Errands: on `errandStarted` the player holds `delivery_bag` with carry:true (carry_walk/carry_idle clips) and the objective line says where to deliver; on `errandEnded` drop it and float the wage. HUD shows an errand chip while `state.errand` is set. Restoring a save with an errand restores the bag.
4. Shopping: `walletChanged` with reason "shopping" floats "−¥N" with a shop icon/label; reply options that carry `cost` show the price in the reply panel (mirror app.ts's presentation).
5. Any new Input/GameEvent/menus in app.ts → 3D affordance + parity table row + handled-list.
6. Tests: extend the day-playthrough test to cover an errand end-to-end and a shop purchase; parity green; zone non-overlap green with the new spaces; spawn points outside triggers; every place in world.json has a space (assert).
7. `npm run build -w @silver-tongue/world3d` → paste size (must stay < 15 MB). `git status` clean after commit except .claude/.

## Report
DONE / ACCEPTANCE / VERIFICATION (test tails, build size, rebase conflict list + how resolved) / NPC + place mapping table / FILES TOUCHED / OPEN QUESTIONS / browser checklist for the new places and the errand flow (use world3d hooks: enter("station_road"), etc.). SOLE executor; no delegation; no browser; no push.
