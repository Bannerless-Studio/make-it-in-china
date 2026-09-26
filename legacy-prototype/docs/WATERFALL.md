# Make It in China — Waterfall plan (v0.1 rebuild)

Decided 2026-09-18 with the owner. Supersedes the "grey boxes, pick-a-reply, fixed camera" build order in
docs/PLAN.md for everything render/controls/audio. The engine (dialogue runner, learner model, economy,
save), the content format and the level checker survive; the presentation layer is rebuilt.

## Vision (1 paragraph)
A third-person 3D browser game. You arrive in a small Chinese street district knowing ten words and must
earn rent. You walk freely (WASD / joystick, camera behind and above, smooth follow), walk up to people
and press E to talk. Every NPC line is spoken aloud in clear Mandarin with hanzi in a bubble; pinyin on
tap. Understanding earns money; misunderstanding is funny and cheap. Reference feel: Abeto's Messenger
(calm, small world, toon shading, outlines) with the world scale and camera of Cloudkeep. Audience:
adult self-learners. Working title kept.

## Pillars (every decision is tested against these)
1. Language is the mechanic. 2. Speech first, text second. 3. The street is alive: NPCs idle, walk,
carry, react. 4. Failure is cheap and funny. 5. Small, finished, polished over large and rough.

## Roles
- Astra (Codex, gpt-6-astra): DESIGN ONLY — GDD, TDD, art & audio bible, Blender asset scripts spec,
  the implementation mega-brief. Highest reasoning; quota-limited (13% weekly left; resets ~2026-09-20).
- Cursor (gpt-5.6-sol-high, grok-4.6-high): implementation, tests; Cursor Sol authors all 25
  scene scripts, exchanges, consequence branches, hints, and checker metadata in stage 4.
- Claude (Fable): orchestration, gates, browser verification, decisions; runs `scripts/tts.mjs`
  with edge-tts + ffmpeg after content is clean. Sonnet: browser QA, research.
- Owner: assets (make or find), voice check, playtests, final calls.

## Stages (waterfall: each stage has a sign-off before the next starts)
| # | Stage | Output (docs/ or repo) | Owner | Gate |
|---|-------|------------------------|-------|------|
| 0 | Vision & decisions | this file | Claude | owner reads it |
| 1 | Game Design Document | docs/design/GDD.md | Astra | owner sign-off |
| 2 | Technical Design Document | docs/design/TDD.md | Astra | Claude + Opus review |
| 3 | Art & Audio Bible + asset list | docs/design/ART.md, docs/design/ASSETS.csv | Astra, owner supplies assets | owner sign-off |
| 4 | Content tickets 4.1–4.6, then TTS owner gate | content/phase1/*.json, public/audio/** | Cursor Sol scripts; Claude/orchestrator TTS | check:content PASS, complete Opus manifest, native-speaker spot check |
| 5 | Build M1: movement, camera, animation, world shell | src/ | Cursor Sol/Grok | browser QA: feels good on desktop + phone |
| 6 | Build M2: dialogue + speech + UI | src/ | Cursor | full scene playable with audio |
| 7 | Build M3: jobs, economy, day loop, notebook, mentor | src/ | Cursor | 3 jobs playable, 7-day loop |
| 8 | Polish: toon/outline, lighting, SFX, music, transitions | src/ | Cursor + owner assets | Opus review SHIP |
| 9 | Playtest + validation (design doc thresholds) | docs/playtest.md | owner + testers | go/no-go Phase 2 |

## Fixed decisions (do not re-open in design docs)
- Camera: third-person follow, behind + above, exponential-decay smoothing, no wall clipping in the
  street (simple collision capsules). Optional orbit with right-drag / two-finger.
- Controls: WASD + Shift run + E interact + Tab notebook; touch: left joystick, right button cluster.
- Animation: skeletal (AnimationMixer). Minimum clip set: idle, walk, run, talk-gesture, carry-idle,
  carry-walk, wave, nod, shake-head, sit. Shared Quaternius UAL rig for all humans; verified source
  supplies idle/walk/run/talk/sit/pickup/interact, while `character_prepare.py` authors carry/wave/nod/shake.
- Speech: pre-generated per line, zh-CN neural TTS (Xiaoxiao/Yunxi/Yunyang/Yunjian). Player is
  Yunxi +0 Hz; cook is Yunjian +2 Hz; shared-voice character pitches always differ by more than 2 Hz.
  Opus mono 32 kbps in Ogg/WebM only, one clip per line, per-word notebook clips, slow replay 0.8x.
- Reply mechanic Phase 1: pick 2–4 spoken replies (player hears their own line). Phase 2+: word tiles.
- Faceless characters (blank head), no licensed IP, no loans/gambling/alcohol/romance/supernatural.
- Assets: GLB only; Blender bpy scripts as a build step for props we author; CC0 packs for the rest;
  Meshopt only (no decoder is registered today); ≤25 MB complete pack, 15 MB first-interactive target,
  60 fps mid-range laptop, 30 fps mid Android. TTS caps are 8/12/16/24 KB at ≤2/3/4/6 seconds.
- Stack: TypeScript, Vite, three.js, DOM UI. No game engine.

## Fixed v0.1 review decisions
- `sys_gate` is “你会汉语。” using dictionary words only; Phase 1 remains exactly 150 non-bonus words
  and does not add 说.
- Speech ships only as 32 kbps mono Opus in Ogg/WebM for Safari 17+ and supported Chromium/Firefox.
  There is no AAC reserve. Complete-pack proof is 18,214 KB CSV caps + 1,500 KB shell + 500 KB
  world content = 20,214 KB, under the 25,000 KB ceiling.
- Stage 4 uses TDD tickets 4.1–4.6: Cursor Sol authors content against checker rules; the orchestrator
  runs TTS generation. Human, physical-device, native-review, and Blender runs are owner gates.
- Oversized 5.2, 5.4, 6.7, 7.3, and 8.1 work is split into one-day browser-visible tickets in TDD §10.
- ART palette names the four character roles umber/olive/clay/periwinkle; time slots fix fog near/far
  and fallback density. Toon bytes are [70,165,255] and outline ink is `0x171717`.
- GDD uses ASCII wireframes for every surface. Scene rewards are credited before `settleRent`.
  Coverage schedules the starter ten in four scenes: 460 minimum planned placements.
- The parked bicycle is Blender-authored. ASSETS records licences separately, including OFL-1.1 fonts.
  World v2 includes the `residential` waypoint at [26,2] for trigger [26,0,2].

## What v0.0.1 taught (feed into GDD/TDD)
Pick-a-reply in a fixed-camera diorama reads as a quiz, not a game. Without speech there is no
listening practice. Click-to-walk on a grid feels like a menu. Toon material with a texture atlas and
no outline pass looks like nothing. The engine/content split worked; keep it.

## Owner action items
- Blender 4.2.3 LTS is installed at `~/.local/bin/blender`; the orchestrator runs it at the stage-8
  owner gate and records the executable/version in the asset manifest.
- Log in to hyper3d.ai in the Playwright browser if Rodin props are wanted (16 credits).
- Sign off GDD (stage 1) before any build starts.
