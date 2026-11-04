---
name: research-trends
description: Research a niche/topic for Instagram Reels — audience pains, hook patterns, formats, sourced facts — and propose 3 reel concepts. Use when the user asks for reel ideas, trend research, hooks or content angles, or as step 1 of /create-reel.
argument-hint: "[project-id or topic]"
---

# Research trends

1. If a project id is given, make sure `projects/<id>/brief/brief.json` exists (`npm run reel -- brief <id>`). If only a topic is given, create a project first: `npm run reel -- init <id> --topic "<topic>"` and fill the brief with the user.
2. Delegate to the **trend-researcher** subagent with: project id, the brief summary, and any constraints from the user (region, language, competitor accounts they named).
3. When it returns, run `npm run reel -- validate <id> research`. If it fails, send the errors back to the agent (once).
4. Present to the user: the 3 concepts as a compact table (Hook · Angle · Emotional trigger · Visual direction), the recommendation, number of sources, and explicit data gaps.
   Remind the user they can drop examples into `projects/<id>/references/` to sharpen the research.

Never present unsourced numbers as facts.
