# Tests

Vitest unit coverage plus a Playwright mobile touch e2e script. Engine tests stay browser-free.

| File | Role |
| --- | --- |
| `smoke.test.ts` | Application smoke |
| `check-level-strict.test.ts` | Strict checker rules |
| `tts-inventory.test.ts` | TTS inventory builder |
| `fixtures/engine.ts` | Shared engine fixtures |
| `fixtures/save-v1.ts` | Captured v1 save strings |
| `engine/content.test.ts` | Content contracts |
| `engine/dialogue.test.ts` | Dialogue routing |
| `engine/economy.test.ts` | Economy and day cycle |
| `engine/learner.test.ts` | Word progress |
| `engine/ledger.test.ts` | Wallet ledgers |
| `engine/progression.test.ts` | Availability, purchases, gate |
| `engine/playthrough.test.ts` | Engine playthrough |
| `engine/review.test.ts` | Review regressions |
| `engine/save.test.ts` | Persistence |
| `engine/slots.test.ts` | Slot fill/validation |
| `render/buildings.test.ts` | Door corridors |
| `render/camera.test.ts` | Occlusion and framing |
| `render/character-detail.test.ts` | Outfit/attachment detail |
| `render/crowd.test.ts` | Pedestrian/cyclist loops |
| `render/daylight.test.ts` | Day-slot palettes |
| `render/drawcalls.test.ts` | Draw budget |
| `render/motion.test.ts` | Collision and bounds |
| `render/npc-walk.test.ts` | NPC waypoint walking |
| `render/street.test.ts` | Street geometry |
| `render/toon.test.ts` | Outline hulls |
| `ui/activityAvailability.test.ts` | Availability reasons |
| `ui/modal.test.ts` | Focus trap |
| `ui/preferences.test.ts` | Preference validation |
| `audio/manager.test.ts` | Manifest and playback resolve |
| `e2e/mobile-touch.mjs` | Pixel 7 real-touch e2e |

## Commands

```bash
npm test
npx vite preview --port 4174
npm run e2e:mobile
```

Never drive touch assertions with mouse events; the e2e script uses CDP touch dispatch.
