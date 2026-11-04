# make-reels — AI Reels Production Studio

Free, local Instagram Reels production: Claude Code subagents do the creative work, a TypeScript CLI does the deterministic work
(Remotion render, Piper TTS, procedural music/SFX, FFmpeg mix + QC). **No paid APIs, no API keys.**

Talk to the user in Russian. Reels and all agent working documents are produced in the brief's language — default
**`hy` = professional Eastern Armenian, reformed orthography** (`.claude/skills/armenian-language-expert/reference/reels-style-guide.md`). `docs/` stays in Russian.
Keep code, file names and identifiers in English.

## Resume on another computer
`git pull && npm install && npm run bootstrap`, then read `PROGRESS.md` → section «Точка продолжения» and continue from there.
The DB (`data/studio.db`, not in git) is rebuilt automatically from `projects/*/production-state.json`. Media files are not in git — `produce` re-creates them.
Before finishing work on a machine: commit and push (`git add -A && git commit && git push`).

## Start here
- Produce a reel: `/create-reel [project-id] [topic]` (skill: `.claude/skills/create-reel/SKILL.md`).
- Where a project stands: `npm run reel -- status <id>`. All commands: `npm run reel -- help`.
- Spec & decisions: `docs/SPEC.md`. Progress checklist: `PROGRESS.md`. Architecture: `docs/ARCHITECTURE.md`.

## Commands
- `npm run reel -- <cmd> <id>` — pipeline CLI (`pipeline/cli.ts`). `npm run typecheck`, `npm test`, `npm run studio` (component demo).
- `npm run reel -- doctor` — environment check. `npm run setup:voice` — install Piper + Russian voices into `.venv/`.

## Layout
- `src/` — Remotion engine (browser code, no node imports). Contracts: `src/types/schemas.ts` (zod) shared with the pipeline.
- `pipeline/` — node CLI: `commands/` (one file per stage), `providers/` (voice engines), `audio/` (procedural DSP), `lib/` (db, io, ffmpeg).
- `brands/<id>/brand-config.json` — brand system; projects snapshot it into `projects/<id>/brand/`.
- `projects/<id>/` — one folder per reel; it is also the Remotion public dir (`staticFile('audio/...')`).
- `data/studio.db` — SQLite (node:sqlite): stages, assets, jobs, costs, QC runs. JSON mirrors are exported into each project.

## Rules
- Approvals A–D are recorded with `npm run reel -- approve <id> <a|b|c|d> --note "..."` **only after the user explicitly approved in chat**.
- Never publish to Instagram. Never add paid generation without a separate decision from the user (see `docs/API-INTEGRATIONS.md`).
- Remotion code: animate only via `useCurrentFrame`/`interpolate`/`spring`; deterministic `random(seed)`; fonts via `src/utils/fonts.ts` (Cyrillic + automatic Noto Sans Armenian fallback).
- Changing a schema in `src/types/schemas.ts` means updating validators, agents' docs and `templates/` in the same change.
- After code changes: `npm run typecheck && npm test`.
- Voices: Armenian `hy_AM-gor-medium` (male; dataset GPL-2.0, base public domain). Russian Piper voices are NOT cleared for commercial use (base lessac = research licence). See `docs/SETUP.md`.
- Armenian skills (project): `armenian-language-expert` (preloaded in every agent), `armenian-grammar-expert` (proofreading; preloaded in scriptwriter + QC), `armenian-translation-expert`, `armenian-ui-localization` (+ `npm run lint:hy-strings -- src.json hy.json`).
- Armenian text is linted by `validate` (`pipeline/lib/lint-hy.ts`): «և» not «եւ», «։» not «.», «՞» not «?», no mixed alphabets.
