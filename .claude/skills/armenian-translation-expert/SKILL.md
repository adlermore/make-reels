---
name: armenian-translation-expert
description: Professional translation and transcreation into Eastern Armenian (Հայերեն) from Russian, English and other languages — marketing copy, reel scripts and hooks, captions, posts, reports, business documents — keeping meaning, tone, terminology and length limits. Use when the user asks to translate anything into Armenian or adapt Russian/English content for an Armenian audience.
---

# Armenian translation expert

Shared rules (read first): [../armenian-language-expert/reference/general-rules.md](../armenian-language-expert/reference/general-rules.md) · reels: [../armenian-language-expert/reference/reels-style-guide.md](../armenian-language-expert/reference/reels-style-guide.md) · examples: [../armenian-language-expert/reference/examples.md](../armenian-language-expert/reference/examples.md).

## Process
1. **Understand the source**: purpose, audience, register, hard constraints (character/word limits, timing, placeholders, brand names).
2. **Translate meaning, not words.** Restructure into natural Armenian syntax (verb usually clause-final, focus with the auxiliary). Russian/English idioms → Armenian equivalents or plain wording.
3. **Marketing / reels = transcreation**: hooks, CTAs and headlines may be rewritten to keep the effect (tension, number, direct address) rather than the literal text. Offer 2 variants for hooks and CTAs.
4. **Terminology**: use the glossary in the reels style guide (արհեստական բանականություն / ԱԲ, գործընթաց, կառավարում…). Keep brand and product names in their original spelling on screen; give an Armenian-letter spoken form for narration (`pronunciation`).
5. **Formats**: decimal comma (2,5), thousands with a space (10 000), «2026 թ.», «5000 ֏», quotes « », sentence end «։».
6. **Length**: Armenian usually runs longer than English (and often than Russian). For on-screen text keep ≤ 5–6 words; for narration respect ≈ 2.1 words/s (hy_AM voice) — shorten rather than speed up.
7. **Self-check** (general-rules §7) and, for project files, `npm run reel -- validate <id>`.

## Output format
- Armenian translation (ready to use).
- Short notes in the user's language on non-literal choices, terminology decisions and anything uncertain (with alternatives).
- For tables/JSON: same structure and keys as the source; only values translated.

## Never
- Mix Eastern and Western Armenian; use «եւ»; leave Latin/Cyrillic letters inside Armenian words.
- Invent facts or numbers that are not in the source.
- Transliterate instead of translating (unless the user asks for transliteration).
