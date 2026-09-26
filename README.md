# Make It in China

Browser game that teaches Mandarin by making you earn a living in it. You arrive in a Chinese city knowing a few words; every job, purchase and conversation runs in Mandarin. Understanding more words unlocks better jobs, so language is your earning power. Calm small-world feel (talk-and-fetch quests, toon shading, faceless chunky characters, high fixed-ish camera). Phase 1 = HSK 1: one street, three jobs, ~150 words. Full design: `docs/design-doc.txt` / `docs/make-it-in-china-design-doc.pdf`.

**Play:** https://fiazul.github.io/make-it-in-china/ (desktop and phone).

## Built with silver-tongue

Game logic, course content, dialogue and save format come from Jamil's engine **silver-tongue**: https://github.com/jamil314/silver-tongue. The 3D front end is the `packages/world3d` package on the `world3d` branch of the fork: https://github.com/Fiazul/silver-tongue/tree/world3d. It drives `@silver-tongue/core` via `send(input)` / `GameEvent[]` (seam described in `docs/silver-tongue-integration.md`).

This repo owns the art: the procedural Blender asset library, its docs, and the deploy that publishes the game here.

## Controls

- Desktop: WASD/arrows walk (Shift runs), E talks/enters, number keys pick replies, notebook button.
- Phone: left-thumb virtual joystick (appears where the thumb lands), tap-to-walk, big E action button and notebook button; portrait and landscape layouts; "Add to Home Screen" runs fullscreen.

## Assets

All 3D assets are generated procedurally in headless Blender (4.2+); nothing is hand-modelled or downloaded:

```sh
blender -b --python tools/blender/build_all.py
```

Builds five sets into `assets/` (characters, buildings, street, props, interiors: 140 GLBs, ~97k tris), `assets/index.json`, per-set `manifest.json` + contact sheets, and the scale check `assets/street_mockup.png`. Humans share a rig with clips `idle`, `walk`, `talk`, `carry_idle`, `carry_walk`; pets have `idle`. Conventions: `docs/asset-conventions.md`. List and build status: `docs/asset-list.md`. Tool usage: `tools/blender/README.md`.

The game vendors the GLBs it uses into `packages/world3d/assets` in silver-tongue (`npm run assets:sync -w @silver-tongue/world3d`, reading from this repo's `assets/` via `WORLD3D_ASSETS`).

## Deploy

`.github/workflows/deploy-game.yml` (manual, daily, and on push to main) checks out `Fiazul/silver-tongue@world3d`, runs `npm ci`, `npm run build:course`, `npm run build -w @silver-tongue/world3d`, retitles it "Make It in China" and publishes `packages/world3d/dist` to the `gh-pages` branch. Pages serves `gh-pages`.

## Layout

| Path | What |
|---|---|
| `docs/` | design doc, asset list + status, asset conventions, silver-tongue integration notes |
| `tools/blender/` | procedural asset pipeline (`build_all.py`, `sets/`, `lib/`, mock-up, contact sheets, cleanup) |
| `assets/` | generated GLBs, manifests, sheets, `index.json`, street mock-up |
| `briefs/` | worker briefs: the project log |
| `legacy-prototype/` | first standalone Vite prototype, superseded; kept for reference |
| `.github/workflows/` | game deploy to `gh-pages` |

## Status and next steps

Done: full Phase 1 asset library (140 assets, rigged + animated characters); world3d on silver-tongue with street, enterable interiors (noodle shop, room, warehouse), NPC scenes, objectives, day tint, street life, notebook, touch controls, Pages deploy. In progress: rebasing world3d onto upstream silver-tongue 0.11.1.

Next (from `docs/asset-list.md` gaps):
- Separate headwear exports beyond the chef hat; beanie/hoodie-up; tea flask; shopping-bag variants.
- Extra clips from the list (wash, hand-over, point, shrug, sit).
- Filler facade recolours; a bus model.
- Mock-up fixes: cook's `npc_stand` hidden under the awning; near-side filler buildings show blank backs.
- Presentation: toon gradient map, outline method check on mobile, CJK font subset, audio.
- Upstream the world3d package to jamil314/silver-tongue.
