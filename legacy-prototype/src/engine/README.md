# Engine

Pure TypeScript gameplay rules and state transitions. No browser, DOM, or Three.js APIs.

| File | Role |
| --- | --- |
| `index.ts` | Public exports |
| `types.ts` | Engine contracts |
| `store.ts` | Game API, state, event glue |
| `dialogue.ts` | Dialogue lifecycle and reply routing |
| `economy.ts` | Wallet, slots, rent, day rules |
| `learner.ts` | Word progress, evidence, decay |
| `progress.ts` | Progression, scheduling, gate query |
| `slots.ts` | Scene validation and slot filling |
| `save.ts` | Save validation and serialization |
