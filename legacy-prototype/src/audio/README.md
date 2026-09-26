# Audio

Browser speech loading, playback, caching, and volume controls. May use DOM and Web Audio. Never imported by `src/engine/`.

| File | Role |
| --- | --- |
| `manager.ts` | Manifest resolve, unlock, LRU buffers, speech settings |

Clips and `public/audio/manifest.json` come from `npm run tts`.
