---
name: create-storyboard
description: Turn an approved reel script into a validated storyboard and shot list (layouts, backgrounds, motion, on-screen text, transitions, SFX cues, illustrations) and render animatic frames for review. Use when a project has script/script.json and needs storyboarding or storyboard changes.
argument-hint: "[project-id]"
---

# Create storyboard

Precondition: `npm run reel -- validate <id> script` passes.

1. Delegate to **storyboard-director** (project id + any user notes on look/feel). It writes `storyboard/storyboard.md` and `storyboard/shot-list.json`.
2. If it lists **Illustration requests**, delegate them to **asset-producer** (pass the file names + descriptions + the creative style guide section).
3. `npm run reel -- validate <id> storyboard` → fix loop until it passes.
4. If voice timing already exists (after Stage A): `npm run reel -- timeline <id>` then `npm run reel -- frames <id>`, open `projects/<id>/reports/storyboard-contact-sheet.png` with Read and check it yourself before showing the user.
   Before Stage A, summarise the shot list as a table instead (scene · layout · on-screen text · background · transition).
5. Report: layout sequence, poster scene, illustration list, anything that deviates from creative direction.

Engine vocabulary and rules: see `.claude/agents/storyboard-director.md`.
