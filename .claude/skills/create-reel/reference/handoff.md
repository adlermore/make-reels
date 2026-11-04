# Hand-off contract (stage I/O)

All paths are relative to `projects/<id>/`. Schemas live in `src/types/schemas.ts`; the CLI validates them.

| Stage | Owner | Reads | Writes | Gate (must pass) |
|---|---|---|---|---|
| brief | orchestrator | brief/brief.md | brief/brief.json | `reel brief <id>` |
| research | trend-researcher | brief.json, references/ | research/research-report.md | `reel validate <id> research` |
| creative | creative-director | brief, research, brand/brand-config.json | creative/creative-direction.md | `reel validate <id> creative` |
| script | scriptwriter | brief, research, creative | script/script.md, script/script.json (ScriptSchema) | `reel validate <id> script` |
| storyboard | storyboard-director | script, creative, brand | storyboard/storyboard.md, storyboard/shot-list.json (ShotListSchema) | `reel validate <id> storyboard` |
| illustrations | asset-producer | storyboard requests, creative style guide | assets/illustrations/*.svg | `reel validate <id> storyboard` |
| **A** | user | — | — | `reel approve <id> a --note` |
| voice | sound-designer | script.json, brand voice | audio/voice/voiceover.wav, voice-timing.json (VoiceTimingSchema) | command exit 0 |
| music / sfx / mix | sound-designer | voice timing, shot-list, brand | audio/music/*, audio/sfx/*, audio/mix/*, sound-design-plan.md | mix-report.json within targets |
| timeline | motion-designer | shot-list, voice timing, brand, mix | timeline.json (TimelineSchema) | command exit 0 |
| frames | motion-designer | timeline | reports/storyboard-contact-sheet.png | visual check |
| **B** | user | — | — | `reel approve <id> b --note` |
| preview | orchestrator | timeline | renders/preview.mp4 | `reel qc <id> --preview` no CRITICAL |
| **C** | user | — | — | `reel approve <id> c --note` |
| final | orchestrator | timeline | renders/final.mp4, final-no-music.mp4, poster.png, subtitles.srt | — |
| qc | quality-controller | final.mp4, frames, script | reports/qc-review.json → quality-report.md | verdict PASS (≥ 90, no critical) |
| **D** | user | — | — | `reel approve <id> d --note` |
| deliver | orchestrator | everything | README.md, production-cost-report.json, asset-manifest.json | all deliverables present |

## Agent result format (what every subagent returns)
```
STATUS: done | blocked | needs-user-input
FILES: <written files>
VALIDATION: <copy of ✔/⚠/✖ lines from the CLI>
SUMMARY: <3–6 bullets>
OPEN QUESTIONS / RISKS: <bullets or "none">
```

## Re-runs
Each production command hashes its inputs and skips work when nothing changed (approved assets are reused, never regenerated).
Changing an upstream artifact marks downstream stages `stale` — re-run them in order. `--force` regenerates deliberately.
