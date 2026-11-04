---
name: armenian-grammar-expert
description: Professional grammar check and editing of Eastern Armenian texts (Հայերեն) — proofreading, case endings, articles, agreement, word order, punctuation, calques, style. Use when the user asks to check, proofread, edit or "fix" Armenian text, when reviewing agent-written Armenian (scripts, captions, posts, reports), or when QC needs a grammar verdict.
---

# Armenian grammar expert (Eastern Armenian, reformed orthography)

Shared rules (read first): [../armenian-language-expert/reference/general-rules.md](../armenian-language-expert/reference/general-rules.md) and, for reels, [../armenian-language-expert/reference/reels-style-guide.md](../armenian-language-expert/reference/reels-style-guide.md).

## Review procedure
1. Identify the variant (Eastern by default) and the register (Reels audience = plural lowercase դուք/ձեր; letters to one person = capitalised Դուք/Ձեր). Flag any mixing.
2. Check, in this order:
   1. **Orthography** — «և» (never «եւ»); word-initial օ/ո, է/ե; «ու» never split; no Latin/Cyrillic look-alike letters inside words.
   2. **Definite article** — «-ը» after a consonant, «-ն» after a vowel, and «-ն» after a consonant when the next word starts with a vowel (բիզնեսն է, տունն այստեղ է).
   3. **Cases** — ուղղական, սեռական/տրական (-ի, -ու…), հայցական, բացառական (-ից), գործիական (-ով), ներգոյական (-ում); check that the governed case matches the verb/postposition (համար + genitive: «բիզնեսի համար»; մասին + genitive: «ԱԲ-ի մասին»).
   4. **Plural** — usually «-եր» for one-syllable stems and «-ներ» for polysyllabic ones; verify irregular and compound words instead of guessing.
   5. **Agreement** — subject–verb person/number; auxiliary «է/են» agreement (ընկերությունները օգտագործում են).
   6. **Word order & focus** — the auxiliary attaches to the focused word («Որոշում է ոչ թե ծառայությունը…»); negation «չ-» / «ոչ» placement.
   7. **Punctuation** — «։» at sentence end, «՝» for pause/apposition, «՞ ՜ ՛» over the stressed vowel, « » quotes, commas before «որ», «թե», «երբ» clauses.
   8. **Calques & style** — «որոշում կայացնել» (not «ընդունել»), avoid overusing «հանդիսանալ», «իրականացնել», «կատարել»; restructure word-for-word Russian/English syntax; remove bureaucratic padding.
3. Keep the author's meaning and tone; do not rewrite what is already correct.

## Output format
- The corrected text (ready to paste).
- A change table: `Was → Now → Why` (explain in the user's language — Russian if they write Russian).
- Uncertain points listed separately with alternatives — never present a guess as a rule.

## In this project
- Before handing back reel texts, run `npm run reel -- validate <id>` (Armenian linter: «եւ», Latin «.»/«?», mixed alphabets, Latin letters in narration).
- Grammar errors visible on screen are **critical** for QC.
