# Models

Runtime may load optional GLBs. Parametric builders in `src/render` cover every silhouette without them.

| Path | Role |
| --- | --- |
| `generated/` | **Generated** Blender GLB output — do not edit by hand |

## Command

```bash
~/.local/bin/blender --background --python scripts/blender/build_all.py -- --out public/models/generated
```
