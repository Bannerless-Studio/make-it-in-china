# Blender builders

Deterministic `bpy` scripts that write optional GLBs under `public/models/generated/`. The game runs without them; parametric Three.js fallbacks cover every silhouette. Orchestrator gate: Blender 4.2 at `~/.local/bin/blender`.

| File | Role |
| --- | --- |
| `build_all.py` | Batch entry (seed 17) |
| `common.py` | Shared helpers and `--out` parsing |
| `buildings.py` | Location building shells |
| `furniture.py` | Bicycle and street furniture |
| `lantern.py` | Lantern mesh |
| `fruit_stall.py` | Fruit stall |
| `doorway.py` | Doorway prop |
| `steamer.py` | Steamer prop |
| `signboard.py` | Signboard prop |

## Command

```bash
~/.local/bin/blender --background --python scripts/blender/build_all.py -- --out public/models/generated
```

Individual builders accept the same `--out` flag.
