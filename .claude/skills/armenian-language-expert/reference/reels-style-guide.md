# Armenian style guide for reels (Eastern Armenian, reformed orthography)

Every agent that writes Armenian (research report, creative direction, script, storyboard, on-screen text,
captions, sound plan, QC review, publish kit) follows this guide. It condenses the user's `armenian-language`
skill (`C:\Users\User\.claude\skills\armenian-language\SKILL.md`, read it too if available) and adds reel-specific rules.
Goal: Armenian that a native professional would publish without edits.

## 1. Variant
- **Eastern Armenian (Արևելահայերեն), reformed orthography** — the Republic of Armenia standard. Never mix with Western Armenian.

## 2. Orthography
- **և** is one letter (U+0587): Երևան, նաև, այլևս, մինչև. Never «եւ» (the validator rejects it).
- Word-initial /o/ → **օ** (օր, օգնել, օգտագործել); **ո** at the start reads "vo" (որ, ոչ, որոշում).
- Word-initial /e/ → **է** (էջ, էկրան, էլեկտրոնային); **ե** at the start reads "ye" (երբ, երկիր).
- **ու** is one vowel written with two letters — never split it.
- Never type Latin/Cyrillic look-alike letters inside Armenian words (o/օ, e/ե, n/ո…) — the validator rejects mixed-alphabet words.

## 3. Punctuation (real Armenian characters)
| Mark | Char | Use |
|---|---|---|
| Full stop (վերջակետ) | **։** U+0589 | End of every sentence. Not Latin «.» and not «:» |
| Comma | , | as in Latin |
| Բութ | **՝** U+055D | short pause / apposition: «Աղբյուր՝ Stanford AI Index 2026» |
| Question | **՞** U+055E | over the stressed vowel of the questioned word: «Ինչո՞ւ», «Որտեղի՞ց սկսել» |
| Exclamation | **՜** U+055C | over the stressed vowel (use rarely in business tone) |
| Emphasis | **՛** U+055B | imperative/vocative: «Հետևե՛ք», «Հարգելի՛» |
| Quotes | « » | never straight quotes |

Headlines that are fragments may have no final punctuation; full sentences end with «։».

## 4. Register and tone for Reels
- Address the audience in the plural, lowercase: **դուք / ձեր / ձեզ** («ձեր բիզնեսը»). Capitalised Դուք/Ձեր is only for letters to one person.
- CTA in the plural imperative: «Հետևեք մեզ…», «Պահպանեք այս տեսանյութը», «Գրեք մեկնաբանություններում»։
- Short sentences, active verbs, concrete numbers. No bureaucratic padding.
- Avoid calques from Russian/English:
  - «որոշում կայացնել» (not «որոշում ընդունել»)
  - «լինել» instead of overused «հանդիսանալ»
  - restructure English word order the Armenian way (verb usually at the end of the clause).

## 5. Numbers, units, dates
- On screen: digits — «88%», «3 ժամ», «5 րոպե», decimal comma «2,5», thousands with a space «10 000».
- In narration: **numbers as words** — «ութսունութ տոկոս», «երեք ժամ» (captions follow the narration exactly).
- Dates: «2026 թ.» / «2026 թվականին». Currency: «5000 դրամ» / «5000 ֏».

## 6. Glossary (business & AI)
| English | Armenian |
|---|---|
| artificial intelligence (AI) | արհեստական բանականություն; on screen short form **ԱԲ** (with suffixes: ԱԲ-ն, ԱԲ-ի, ԱԲ-ով) |
| neural network | նեյրոնային ցանց |
| automation | ավտոմատացում |
| company | ընկերություն |
| business | բիզնես |
| business owner / entrepreneur | բիզնեսի սեփականատեր / ձեռներեց |
| process | գործընթաց |
| management | կառավարում |
| leadership | ղեկավարություն |
| team / employee | թիմ / աշխատակից |
| efficiency / productivity | արդյունավետություն / արտադրողականություն |
| customer / client | հաճախորդ |
| sales / revenue / growth | վաճառք / եկամուտ / աճ |
| competitor | մրցակից |
| data | տվյալներ |
| tool / service | գործիք / ծառայություն |
| decision / strategy | որոշում / ռազմավարություն |
| investment | ներդրում |
| survey / report | հարցում / զեկույց |
| source | աղբյուր — footnote format: «Աղբյուր՝ Microsoft Work Trend Index 2026» |
| follow (social) / subscribe | հետևել / բաժանորդագրվել |
| save / share / comment | պահպանել / կիսվել / մեկնաբանել |

Established loanwords used by Armenian professionals are fine (թվային, ստարտափ, մարքեթինգ, Instagram, CRM). Do not invent purist neologisms.

## 7. Narration for the Armenian voice (Piper hy_AM-gor-medium)
- Measured pace ≈ **2.05 words/second** → use `wordsPerSecond: 2.1` in script.json.
  Usable speech for 30 s ≈ 30 − 1.6 (CTA tail) − 0.35 (lead-in) − 0.32 × (scenes − 1) ≈ 25.8 s for 8 scenes → **≈ 52–56 words**.
- No Latin letters, digits or abbreviations in narration. If the display text needs them (brand names, «ԱԲ»), keep `narration` as the display text
  and put the spoken form in `pronunciation` in Armenian letters: «ԱԲ» → «արհեստական բանականություն», «Microsoft» → «Մայքրոսոֆթ», «Stanford» → «Սթենֆորդ».
- Every sentence ends with «։» — the voice uses it for intonation and pauses.

## 8. Self-check before handing over Armenian text
1. Eastern reformed only; no «եւ»; correct օ/ո and է/ե at word start.
2. Every sentence ends with «։»; ՞ ՜ ՛ sit on the stressed vowel; quotes « ».
3. Case endings and verb agreement are correct; no calques.
4. Register consistent (plural lowercase դուք/ձեր for the audience).
5. Numbers, names, sources consistent between narration, on-screen text and footnotes.
6. Read it aloud mentally — rewrite anything that sounds translated.
7. Run the validator (`npm run reel -- validate <id>`): it lints «եւ», Latin «.»/«?», mixed alphabets and Latin letters in narration.
If unsure about a word, say so and offer an alternative instead of guessing; recommend a native-speaker check for campaigns.
