# world3d: full engine coverage + make it feel like a game

Repo: /home/fiazul/Desktop/make-it-in-china/silver-tongue, branch world3d (uncommitted; do not commit/push). Node: `export PATH="$HOME/.local/node22/bin:$PATH"`. Read packages/world3d/README.md, src/game.ts, src/main.ts, src/world.ts, src/actor.ts, src/layout.json first; then packages/core/src/types.ts (Input + GameEvent unions, GameState), packages/core/src/dialogue.ts + life.ts, packages/tui/src/app.ts (every menu/action the TUI offers — this is your checklist), content/settings/china-city/{world.json,scenes/*.json}, and the assets index /home/fiazul/Desktop/make-it-in-china/assets/index.json (interiors set has room_shell, noodle_shop_shell, tea_house_shell with furniture_slots + hideable walls; props set has counters, boxes, bowls; street has stools etc).

## Goal
Part A — Parity: every `Input` variant and every `GameEvent` variant in core is reachable/handled in world3d, and every action the TUI's app.ts offers (scene menus, mentor, notebook, sleep, new game, name, save export/import string, help/word lookup, place travel, whatever else you find) has a 3D-world affordance. Produce a parity table (TUI action → 3D affordance → core input) in the README and assert it in a test that enumerates the Input union members against a handled-list.

Part B — Game feel, using the assets we have:
1. Interiors: entering noodle_shop, room, warehouse (and tea house if the engine ever references it) transitions from the street to an interior scene built from the interiors/props shells and furniture_slots (noodle_shop_shell + counter_noodle + tables/stools + cook; room_shell + bed/desk/wardrobe + landlord at door; warehouse: use the warehouse building's interior or a simple floor + box_stacks + pallets + foreman). Door trigger on the street → fade → interior with the hideable +x wall removed for the camera; exit trigger at the door → street. Player spawn/exit points from manifests' door anchors.
2. Prompts: floating "E · Talk" / tap hint over an NPC within range; "Enter" hint at doors; place name banner on entering; a small objective line in the HUD ("Go and meet Old Wang at the bus stop", "Ask the cook for work", "Rent is due in N days", "Go home and sleep") derived from core state (availableSceneIds, mentor availability, rent timers, slots left). Keep copy in strings.ts / FTL like the existing pattern.
3. Actions in the world: bed → sleep (with day-end summary card: food, rent, wallet delta, from dayEnded/walletChanged events); landlord → rent scene when available; cook/foreman → job scenes; mentor → notebook explanations; notebook button and a physical notebook prop on the room desk that opens it. Sleep only where core allows (home).
4. Street life: 4–6 ambient walkers (customer_a variants, customer_b, kid, courier on scooter static) walking waypoint loops along the pavement with the walk clip, avoiding the player (simple stop-and-wait when close); cat idle by noodle shop, pigeons scatter (move away) when the player is within 2 m; lantern sway is optional.
5. Day: tint/ambient shift with slots used (morning → evening) and a night fade on sleep. Cheap: lerp hemisphere light colours.
6. Feedback: wallet change floats "+¥5" / "−¥2" near the HUD; wrong-answer "mix-up" gives the NPC a shrug (use talk clip + head shake if no shrug clip, note it); word learned → small notebook pulse.
7. Mobile: virtual joystick or tap-to-walk is enough (tap exists); make sure prompts are tappable and the interior camera fits phone width.

## Constraints
- Do not modify packages/core or content/. If the engine lacks something you need (e.g. an input for "enter building"), map it onto existing inputs (goTo) and list the gap under OPEN QUESTIONS rather than hacking core.
- Reuse: one `SceneSpace` abstraction for street vs interiors (load layout, spawn actors, triggers), one prompt component, one objective resolver. No per-place special cases beyond data in layout.json.
- Keep dist under 15 MB; report size.
- Category fix, not instance: every NPC/place/door goes through the same data path.
- Tests: extend the DOM-free smoke tests: parity assertion; a full-day playthrough script (meet Wang → noodle intro → shift → buy? → sleep) asserting the objective text at each step and dayEnded handling; interior enter/exit state transitions.
- Context budget: targeted reads; if scope blows past the brief, return a handoff with done/remaining. You are the SOLE executor; no delegation; no browser. End with "ready for browser verification" + a scripted checklist for the browser worker (use the `window.world3d` hooks; add hooks as needed, e.g. `world3d.enter("noodle_shop")`, `world3d.sleep()`).

## Acceptance
- [ ] typecheck + all tests green (paste tails); build size.
- [ ] README parity table complete; parity test enumerates every Input variant.
- [ ] Interiors for noodle_shop, room, warehouse enterable/exitable; hooks to jump there.
- [ ] Objective line changes across the playthrough test.
- [ ] Ambient walkers + pets + day tint present (describe how to see them).
- [ ] Report format as before + OPEN QUESTIONS + browser checklist.

## Bugs from the last browser check — fix first, as categories
1. **Place-trigger thrashing crash**: clicking near overlapping trigger zones twice caused a `goTo` loop (dozens of place changes at identical timestamps) and crashed the tab. Root cause is likely zones overlapping + enter/exit firing every frame + `enterPlace` path-walking sending hops re-entrantly. Fix: zones must not overlap (assert in a test), zone transitions debounced/edge-triggered with a "current zone" state, and `enterPlace` must be idempotent and not re-entrant (guard). Add a test that simulates a position oscillating across a zone boundary 100 times and asserts ≤ 2 goTo inputs.
2. **Held prop ⇒ carry pose**: NPCs holding a small hand prop (fan, ladle, keys, clipboard) play `carry_idle` (two-forearms-forward box carry). Carry should only apply to props flagged `carry: true` in layout (boxes/bags); hand props keep idle/talk. Wang should stand normally holding the fan.
3. Cosmetic: the intro narration bubble says "Press [w] … [s]" — TUI key hints. In 3D show the equivalent (tap a word / the "…" button), via the strings override mechanism.
