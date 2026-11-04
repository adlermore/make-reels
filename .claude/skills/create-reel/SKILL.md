---
name: create-reel
description: Full Instagram Reels production — from a content brief to a QC-approved final.mp4 — using the studio's subagents and the free local pipeline (Remotion, Piper TTS, procedural audio, FFmpeg). Runs research → creative → script → storyboard → assets → audio → edit → render → QC with four user approval gates.
argument-hint: "[project-id] [topic or path to brief.md]"
disable-model-invocation: true
---

# /create-reel — Executive Producer playbook

You (the main session) are the **Executive Producer & Orchestrator**. You delegate specialist work to subagents,
verify every hand-off with the CLI, and stop at the four approval gates.

**Languages:** talk to the user in Russian. The reel itself (narration, on-screen text, captions, publish kit) and every
agent working document are written in the brief's language — default **`hy` = professional Eastern Armenian, reformed
orthography** (rules: `.claude/skills/armenian-language-expert/reference/reels-style-guide.md`). When you show Armenian texts at a gate, add a one-line Russian
gloss per scene so the user can check meaning quickly. File names, ids and code stay in English.

Arguments: `$ARGUMENTS` (optional project id and/or topic). Hand-off contract: [reference/handoff.md](reference/handoff.md).

## 0. Brief
1. Determine `<id>` (kebab-case, e.g. `ai-business-30s`). If no project exists: `npm run reel -- init <id> --brand <brand> --topic "<topic>"`.
2. Open `projects/<id>/brief/brief.md`. If fields are empty, ask the user for the Content Brief **in one message** (topic, language — default Armenian (Eastern), duration 15/30/45/60/custom, audience, style, format, voice male/female, CTA, brand). Fill the file. Armenian voice offline = male only (hy_AM-gor); a female Armenian voice needs `voice.engine: "recorded"`.
3. `npm run reel -- brief <id>` → must print ✔. Show the user a 4-line summary.

## 1. Research → Creative (sequential: creative depends on research)
- Agent **trend-researcher**: "Project <id>. Read brief.json + references/. Write research/research-report.md per your spec."
- `npm run reel -- validate <id> research`
- Agent **creative-director**: "Project <id>. Use the recommended concept (or <concept> chosen by the user)."
- `npm run reel -- validate <id> creative`

## 2. Script → Storyboard → Illustrations
- Agent **scriptwriter** → must finish with a passing `validate <id> script`.
- Agent **storyboard-director** → shot-list + illustration requests.
- Agent **asset-producer** → draws the requested SVGs (and registers user footage).
- `npm run reel -- validate <id>` (all creative stages) must pass. Loop the responsible agent on any error (max 2 loops, then ask the user).

## ★ STAGE A — CREATIVE APPROVAL (stop and wait)
Present: research summary (3 bullets + sources count), creative concept (big idea, direction), the full script table (narration + on-screen text),
storyboard summary (layout sequence), visual direction, **estimated production cost: $0 (all local)** + estimated render time (~2–4 min).
Ask: approve / change what. Apply changes via the relevant agent and re-validate.
Only after an explicit "yes": `npm run reel -- approve <id> a --note "<user's words>"`.

## 3. Audio + edit assets (sound-designer, then motion-designer)
- Agent **sound-designer**: voice → music → sfx → mix → write audio/sound-design-plan.md.
  (or directly: `npm run reel -- produce <id> assets` runs voice→music→sfx→mix→timeline→frames)
- `npm run reel -- timeline <id>` and `npm run reel -- frames <id>`.
- Agent **motion-designer**: inspect `reports/storyboard-contact-sheet.png`, fix overflow/collisions/rhythm.

## ★ STAGE B — ASSETS / ANIMATIC APPROVAL (stop and wait)
Show: the contact sheet image path (`projects/<id>/reports/storyboard-contact-sheet.png`), voice engine/voice, real duration vs target,
`audio/mix/mix-full.wav` to listen to, music preset + licence. Note: no paid generation exists in this studio (Stage B replaces "generation approval").
After "yes": `npm run reel -- approve <id> b --note "..."`.

## 4. Preview
`npm run reel -- produce <id> preview` → `renders/preview.mp4` (540×960, watermark) + automated QC on the preview.

## ★ STAGE C — PREVIEW (stop and wait)
Show: preview path, auto-QC summary (failed checks), your own recommendations. Apply requested changes (loop to the owning agent → re-run affected steps; unchanged steps are skipped automatically by input hashing).
After "yes": `npm run reel -- approve <id> c --note "..."`.

## 5. Final + independent QC
1. `npm run reel -- render <id> --final` → final.mp4, final-no-music.mp4, poster.png, subtitles.srt.
2. Agent **quality-controller**: "Project <id>, review renders/final.mp4 per your procedure." It writes reports/qc-review.json and re-runs qc.
3. If verdict ≠ PASS: route issues to owners, fix, re-render, re-QC (max 3 cycles; then report to user honestly).
4. Write `publish-kit.md` yourself (caption, hashtags, first comment, alt text, AI-label recommendation) in the brief's language — for Armenian follow `.claude/skills/armenian-language-expert/reference/reels-style-guide.md` and its self-check.

## ★ STAGE D — FINAL APPROVAL (stop and wait)
Show: QC verdict + score, final.mp4 / final-no-music.mp4 / poster.png paths, publish kit.
After "yes": `npm run reel -- approve <id> d --note "..."` → `npm run reel -- deliver <id>` → summarize deliverables.

## Rules
- Parallelize only independent work (e.g. sound-designer and asset-producer after Stage A). Never parallelize dependent stages.
- Every agent must end with a structured result; if it only says "done", ask it for the result.
- Never record an approval the user did not give. Never publish to Instagram.
- `npm run reel -- status <id>` shows where production stands; it survives restarts (state in data/studio.db + production-state.json).
- If something fails: read the error + hint, identify the owning stage, fix, re-run that stage only.
