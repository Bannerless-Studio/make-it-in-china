# Make It in China

Browser game that teaches Mandarin by making you earn a living in it. You arrive in a Chinese city knowing a few words; every job, purchase and conversation runs in Mandarin. Understanding more words unlocks better jobs, so language is your earning power. Calm small-world feel (talk-and-fetch quests, toon shading, faceless chunky characters, high fixed-ish camera). Phase 1 = HSK 1: one street, three jobs, ~150 words. Full design: `docs/design-doc.txt` / `docs/make-it-in-china-design-doc.pdf`.

**Play:** https://bannerless-studio.github.io/make-it-in-china/ (desktop and phone).

New here? Read [HANDOFF.md](HANDOFF.md): who did what, what is done, what is not, and which upstream version the 3D game is rebased on.

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

Done: full Phase 1 asset library (140 assets, rigged + animated characters); world3d on silver-tongue with street, enterable interiors (noodle shop, room, warehouse), NPC scenes, objectives, day tint, street life, notebook, touch controls, Pages deploy. world3d is rebased on upstream silver-tongue 0.11.1 (all places, errands, shop) and proposed upstream as https://github.com/jamil314/silver-tongue/pull/1.

Next (from `docs/asset-list.md` gaps):
- Separate headwear exports beyond the chef hat; beanie/hoodie-up; tea flask; shopping-bag variants.
- Extra clips from the list (wash, hand-over, point, shrug, sit).
- Filler facade recolours; a bus model.
- Mock-up fixes: cook's `npc_stand` hidden under the awning; near-side filler buildings show blank backs.
- Presentation: toon gradient map, outline method check on mobile, CJK font subset, audio.

## Credits and references

- **Idea and direction:** Ishmum bhai, who set the premise (learn Mandarin by earning a living in a Chinese city) and paired this project with silver-tongue.
- **Game engine, course content, dialogue, save format:** Jamil, [silver-tongue](https://github.com/jamil314/silver-tongue) (MIT). Play his terminal version with `npx silver-tongue`. The 3D front end is proposed upstream in [jamil314/silver-tongue#1](https://github.com/jamil314/silver-tongue/pull/1).
- **3D world, assets, art pipeline:** Fiazul Haque, this repo ([`packages/world3d`](https://github.com/Fiazul/silver-tongue/tree/world3d/packages/world3d) on the fork).
- **Design doc:** [`docs/design-doc.txt`](docs/design-doc.txt). Look-and-feel references only, nothing copied: Abeto's *Messenger* (toon shading, calm fetch quests), Game Boy Advance era fixed-camera games.
- **Vocabulary:** HSK 2.0 word lists (Phase 1 = HSK 1), via silver-tongue's content build.
- **Assets:** all 140 models are generated procedurally by the Blender scripts in [`tools/blender`](tools/blender) (Blender 4.2, bpy/bmesh only). No third-party models, textures or animations are used. Style references: Kenney, KayKit, Quaternius low-poly packs. Characters are faceless by build-time assertion.
- **Tech:** [three.js](https://threejs.org), TypeScript, esbuild, Vitest, GitHub Pages.
- **Built with:** Claude Code (Anthropic), orchestrating Blender and code workers; every asset and screen was verified by rendering or in a browser before it landed.

