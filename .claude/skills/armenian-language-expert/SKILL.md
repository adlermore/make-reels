---
name: armenian-language-expert
description: Professional Eastern Armenian (Հայերեն, reformed orthography) for the reels studio — writing and reviewing Armenian research reports, creative briefs, voiceover scripts, on-screen text, captions, storyboards, QC notes and Instagram post copy. Use whenever Armenian text is written, edited, translated or checked in this project, when a brief's language is "hy"/Armenian, or when the user mentions Armenian, Հայերեն or армянский.
---

# Armenian language expert (reels studio)

Goal: Armenian that a native professional would publish without edits — correct, natural, and right for short-form video.

## Read before writing
1. [reference/reels-style-guide.md](reference/reels-style-guide.md) — **reel-specific rules** (register for Reels, numbers in narration vs on screen, TTS pronunciation, glossary, footnote format, timing ≈ 2.1 words/s).
2. [reference/general-rules.md](reference/general-rules.md) — orthography, punctuation, style, IT/business terminology, self-check (from the `armenian-language` skill).
3. [reference/examples.md](reference/examples.md) — examples; ✅ VERIFIED ones are style authority, ⚠️ DRAFT ones are structure only.

## Defaults
- **Eastern Armenian, reformed orthography** unless the brief says Western Armenian. Never mix variants.
- Audience address in Reels: plural lowercase **դուք / ձեր**; CTAs in the plural imperative (Հետևեք, Պահպանեք, Գրեք).
- Every sentence ends with «։»; questions carry «՞» over the stressed vowel; quotes « »; «և» is one letter.

## Workflow for any Armenian deliverable
1. Write directly in Armenian (do not translate word-for-word from a Russian/English draft — restructure the sentence the Armenian way).
2. Narration: numbers as words, no Latin letters or abbreviations; spoken forms go to `pronunciation`.
3. On-screen text: ≤ 5–6 words, digits allowed (88%, 3 ժամ), short words glued by the engine automatically.
4. Run the self-check from general-rules.md §7 and the style guide §8.
5. Run `npm run reel -- validate <id>` — the Armenian linter rejects «եւ», Latin «.»/«?» in Armenian sentences, mixed alphabets, and warns about Latin letters in narration.
6. If unsure about a word, say so and propose an alternative; for campaigns recommend a native-speaker check of the first version.
