# Reference videos (watched 2026-09-18 via downloaded mp4 + frame extraction)

Only 1 of the 3 posts actually claims AI-agent authorship. The other two are hand-built
moodboard references.

| # | Post | What it is | AI claim |
|---|------|-----------|----------|
| 1 | @abeto_co 2025-09-25 "Messenger" (messenger.abeto.co) | 3rd-person follow cam on a tiny spherical planet; cel-shaded flat colours + black ink outlines; dialogue box with name tag + portrait; heart pickups; CJK signage as set dressing. Character HAS a face (we won't). 3D low-poly title card. | none — indie dev's own project |
| 2 | @threejs RT of @nowsomemv 2026-09-14 "The Atoll" | Fixed top-down cam, rowboat sailing to an island; soft PBR-ish low-poly, no outlines; foam wake, canopy shadows on sand. Portfolio site, not a game. | none |
| 3 | @0xMarioWu 2026-09-15 "Cloudkeep: The Floating Gardens" | Chase cam behind a hot-air balloon through floating islands; painterly pastel toon; HUD: compass, coin counter with "+3" toasts, rotating objective text, control legend, mobile joystick. Pilot is a tiny silhouette (effectively faceless). 44s, 4K. | "built with GPT-6 Astra + Blender + Three.js, ~1 hour, ~15% of weekly quota, simple prompts" — first-person, unverified, no repo |

## Steal for this project
- Cel outline (post 1) reads far more "game" and GBA-adjacent than soft PBR (2, 3). Inverted-hull
  outline + MeshToon, as PLAN.md already says. Don't chase lighting realism.
- Bounded small world (planet / islands) = no streaming, no big pathing. Our one street is the same idea.
- Cheap progression feel (post 3): counter that ticks up with a "+N" toast, and an objective line
  that swaps. Map to: wallet "+5块" toast, and a one-line "today: 洗碗 shift at 面馆" objective.
- One directional light with soft shadow map onto flat ground sells the toy-diorama look (1, 2).
- Name label + bubble (post 1) — same as our UI, minus the portrait.
- Evidence for "an agent builds a playable HUD + controls + loop in one sitting": one unverified tweet. Plan for it, don't bank on it.

Scratch: videos/frames in the session scratchpad (not in repo).
