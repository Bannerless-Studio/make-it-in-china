# Render

Three.js world presentation, movement, characters, and daylight. No DOM UI imports — compose with UI only from `src/main.ts`. Text stays in the DOM; no faces on meshes.

| File | Role |
| --- | --- |
| `scene.ts` | Renderer loop and dialogue/input glue |
| `world.ts` | District from `world.json` v2 |
| `input.ts` | Keyboard, touch, gamepad → `Intent` |
| `camera.ts` | Third-person follow and orbit |
| `motion.ts` | Capsule collision and bounds |
| `navigation.ts` | Pathfinding (tests + NPC waypoints) |
| `character.ts` | Player/NPC mannequin, outfits, clips |
| `npc.ts` | Schedule anchors and talk facing |
| `crowd.ts` | Background pedestrians/cyclist |
| `buildings.ts` | Location silhouettes (parametric / GLB) |
| `props.ts` | Lanterns, furniture, stall props |
| `street.ts` | Road, pavers, kerbs, sky, skyline |
| `daylight.ts` | Day-slot sky/fog/sun palettes |
| `toon.ts` | Toon materials and outline hulls |
| `geom.ts` | Vertex-colour batching |
| `assets.ts` | GLB cache and skeleton-safe clone |
| `constants.ts` | Speeds, camera, palette, clip map |
