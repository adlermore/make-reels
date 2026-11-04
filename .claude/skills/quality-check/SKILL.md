---
name: quality-check
description: Independent quality control of a rendered reel (preview or final) — automated FFprobe/FFmpeg checks, frame-based visual review by the quality-controller agent, 100-point score, critical-error blocking, and a fix list routed to the responsible agents. Use after any render or when the user asks to check a video.
argument-hint: "[project-id] [--preview]"
---

# Quality check

1. Make sure the render exists (`renders/final.mp4` or `renders/preview.mp4`).
2. Delegate to the **quality-controller** subagent: "Project <id>, target final|preview. Follow your procedure." Do not pre-judge the result in your prompt — the reviewer must stay independent.
3. When it returns, open `projects/<id>/reports/quality-report.md` and confirm the verdict line yourself.
4. Report to the user: verdict (PASS / FAIL / BLOCKED / PENDING_REVIEW), total and automatic score, critical issues, fix list by owner, and what needs **human** review (voice naturalness, music feel).
5. If FAIL/BLOCKED and the user wants fixes: route each issue to its owner agent, re-run only the affected pipeline steps, re-render, and repeat this skill.

The rubric (100 pts): technical 35 · audio 25 · visual (measured) 15 · content/layout 10 · agent review 15. Pass ≥ 90 and zero critical.
