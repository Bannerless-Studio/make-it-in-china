# Legacy prototype (superseded)

This is the first Make It in China prototype: a standalone Vite + Three.js app with its own TypeScript engine, content JSON, edge-tts audio and CC0/Blender grey-box models (v0.0.1 to v0.1).

It is **superseded** by the `world3d` package built on Jamil's silver-tongue engine: https://github.com/Fiazul/silver-tongue/tree/world3d/packages/world3d. The live game at https://fiazul.github.io/make-it-in-china/ is built from that branch.

Kept for reference only; not built or deployed. `pages.yml.disabled` is its old Pages workflow. The prototype's original README follows below.

---

# Make It in China

Browser game that teaches HSK Mandarin by making you earn a living in it. Working title.

## Status

**v0.0.2 slice** — third-person district with movement, follow camera, spoken Mandarin dialogue, learner notebook, and eight buildings with DOM signs.

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints. Optional checks:

```bash
npm test
npm run check:content
npm run build
```

Speech clips ship under `public/audio/`. Regenerate only if you are an author: `npm run tts` (needs Node 20, `edge-tts`, and `ffmpeg` on `PATH`).

## How to play

### Desktop
- Title screen: **New game**, or **Continue** when a local save exists.
- **WASD** or arrows walk; hold **Shift** to run.
- Right-drag orbits the camera.
- Walk up to an NPC, face them, press **E** or **Talk**.
- **1–4** select a reply; **Enter** or **Say selected reply** commits it. Hover a reply to preview speech.
- **Tab** or **Book** opens the notebook. **Esc** or **Menu** opens pause.
- HUD speaker mutes or unmutes speech.

### Phone
- Left joystick moves; **Run** sprint; drag the open street to orbit.
- **Talk** starts dialogue when near an NPC.
- First tap on a reply previews it; second tap says it.
- Use the on-screen menu and notebook controls the same way as desktop.

## Settings

Pause → settings. On this device you can change:
- Speech volume and mute
- Default pinyin visibility
- Text size

Mute and volume also follow the HUD speaker button and persist after reload.

## Save and import

Progress autosaves in the browser. From pause you can export a save string and import one later. Import replaces the current run after confirmation. **New game** clears the local save.

## Audio

NPC and player lines play automatically once audio is unlocked (first tap or key). Use **Replay** to hear a line again and **Pinyin** to show pronunciation. Tap a dialogue word for pinyin, gloss, and word audio. The notebook plays word and first-seen sentence clips.

## Licence and credits

See `docs/CREDITS.md`.
