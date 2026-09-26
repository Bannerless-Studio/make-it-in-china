# Scripts

Repository checks and authoring entry points (Node and Blender). See `blender/README.md` for mesh builders.

| File | Role |
| --- | --- |
| `check-level.mjs` | Content validation CLI |
| `check-level-rules.mjs` | Shared pure rules (Node + preview) |
| `check-level-rules.d.mts` | Type declarations for shared rules |
| `slot-tuples.mjs` | Fixed-pair eligibility and tuple enumeration |
| `tts-inventory.mjs` | Speech inventory and logical ID builder |
| `tts-inventory.d.mts` | Type declarations for inventory |
| `tts.mjs` | Edge TTS → Opus generator and validator |
| `blender/` | Optional deterministic GLB builders |

## Commands

```bash
npm run check:content
npm run check:content:strict
npm run tts:dry
npm run tts
npm run tts:validate
```

TTS needs Node 20, `edge-tts`, `ffmpeg`, and `ffprobe` on `PATH`. It is not part of normal CI.
