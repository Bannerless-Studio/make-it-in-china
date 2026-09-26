# Phase 1 content

Curriculum and world data for the shipping slice. Speech IDs are authored on line, reply, and hint `audio` fields; the TTS build expands slot variants.

| File | Role |
| --- | --- |
| `scene-list.md` | Human curriculum outline |
| `scenes.json` | Dialogue and activity scenes |
| `words.json` | Vocabulary entries |
| `world.json` | Locations, NPCs, pools, district v2 fields |
| `voices.json` | Build-time player/system/NPC speech presets |
| `ambient.json` | Overheard street lines (coverage + audio IDs) |
| `word-audio-map.json` | Generated durable hanzi → `word_NNN` clip IDs |

`word-audio-map.json` is retained/updated by `npm run tts`; do not renumber by hand.
