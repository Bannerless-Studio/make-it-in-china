# Credits

- HSK 2.0 Level 1 vocabulary (150 entries): Chinese Testing International / Hanban,
  *HSK Vocabulary List (Levels 1–6)*. The listed variant entry `哪（哪儿）` is represented as
  `哪儿` in `words.json` so each `hanzi` value remains a segmentable `WordId`.

## 3D Assets — assets/raw/

| file | source URL | author | licence | notes |
|---|---|---|---|---|
| assets/raw/kenney/city-kit-commercial.zip | https://kenney.nl/assets/city-kit-commercial | Kenney (kenney.nl) | CC0 | Kenney "City Kit (Commercial)" v2.1, 4.0MB zip, 41 GLB/glTF files, buildings/props, no characters/faces. |
| assets/raw/kenney/food-kit.zip | https://kenney.nl/assets/food-kit | Kenney (kenney.nl) | CC0 | Kenney "Food Kit", 4.4MB zip, 200 GLB/glTF files, food props only, no characters/faces. |
| assets/raw/quaternius/universal-animation-library-standard.zip | https://quaternius.com/packs/universalanimationlibrary.html (downloaded via https://quaternius.itch.io/universal-animation-library) | Quaternius | CC0 | "Universal Animation Library" Standard tier, 16MB zip, contains Unreal-Godot GLB rig+animation exports (UAL1_Standard.glb, UAL1_Standard_RM.glb) plus FBX/other formats; faceless humanoid mannequin rig, no facial features. |
| assets/raw/kaykit/kaykit-city-builder-bits-1.0-free.zip | https://kaylousberg.itch.io/city-builder-bits | Kay Lousberg (KayKit) | CC0 | Optional pack, 4.7MB zip, 123 GLB/glTF/FBX files, city building prop bits, no characters/faces. |

Rodin (Hyper3D) generations: SKIPPED — not logged in at https://hyper3d.ai/workspace/rodin (header showed "Login", no credit balance visible). 0 of 16 credits used, 0 props generated. See report for details; retry once logged in.

## Used files — public/models/

All runtime manifest entries below use GLB. The KayKit source glTF files need their referenced BIN
data and `citybits_texture.png` embedded during the copy so the runtime has no sidecars.

| runtime file | source pack file |
|---|---|
| `character/UAL1_Standard.glb` | Quaternius Universal Animation Library Standard, `Unreal-Godot/UAL1_Standard.glb` |
| `buildings/building-a.glb` | Kenney City Kit (Commercial), `Models/GLB format/building-a.glb` |
| `buildings/building-b.glb` | Kenney City Kit (Commercial), `Models/GLB format/building-b.glb` |
| `buildings/building-c.glb` | Kenney City Kit (Commercial), `Models/GLB format/building-c.glb` |
| `buildings/detail-awning.glb` | Kenney City Kit (Commercial), `Models/GLB format/detail-awning.glb` |
| `street/streetlight.glb` | KayKit City Builder Bits, `Assets/gltf/streetlight.gltf` |
| `street/bench.glb` | KayKit City Builder Bits, `Assets/gltf/bench.gltf` |
| `street/box_A.glb` | KayKit City Builder Bits, `Assets/gltf/box_A.gltf` |
| `street/bush.glb` | KayKit City Builder Bits, `Assets/gltf/bush.gltf` |
| `food/bowl-broth.glb` | Kenney Food Kit, `Models/GLB format/bowl-broth.glb` |
| `food/chopstick.glb` | Kenney Food Kit, `Models/GLB format/chopstick.glb` |
| `food/cup-tea.glb` | Kenney Food Kit, `Models/GLB format/cup-tea.glb` |
| `food/steamer.glb` | Kenney Food Kit, `Models/GLB format/steamer.glb` |
| `food/pot.glb` | Kenney Food Kit, `Models/GLB format/pot.glb` |

Parametric district shells, tiled roofs, street kerbs, skyline, parked bicycle, lanterns,
interior furniture, and outfit attachments are project-authored three.js fallbacks (no
atlas textures, no faces). They ship even when `public/models/generated/` is empty.
Optional Blender exports from `scripts/blender/` use the same ART palette and CC0 is
unchanged for Kenney / KayKit / Quaternius GLBs when those files are present.
