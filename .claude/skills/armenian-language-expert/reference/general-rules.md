# Armenian language — professional quality

Goal: Armenian that a native professional would sign without edits. Accuracy beats speed — always do the self-check pass below before returning Armenian text.

## 1. Pick the variant first

- **Default: Eastern Armenian (Արևելահայերեն), reformed orthography** — the standard in the Republic of Armenia.
- **Western Armenian (Արևմտահայերեն), classical orthography** — only if the user writes in it, mentions the diaspora (Lebanon, Syria, France, USA, etc.), or asks for it. Do not mix the two in one text.
- If the audience is unclear and the text is external (clients, publication), ask once: «Восточноармянский или западноармянский?»

## 2. Conversation rules

- User writes in Armenian → answer in Armenian (same variant). User writes in Russian/English about Armenian text → explain in their language, give the Armenian text separately.
- User writes transliterated Armenian (`barev, inchpes es`) → understand it, answer in **Armenian script**, unless they ask for transliteration.
- Never output transliteration in deliverables (emails, docs, UI).
- Keep code, identifiers, CLI commands, file names and product/brand names in their original form (usually English).

## 3. Orthography (Eastern, reformed)

- **և** — one ligature letter (U+0587) for the conjunction "and" and inside words: Երևան, արև, նաև. Never write «եւ» in reformed orthography (it is classical/Western).
- **Word-initial /o/ → օ** (օր, օգնել, օրինակ); **ո** at the start reads "vo" (որ, ոչ). Exception: ով, ովքեր.
- **Word-initial /e/ → է** (էջ, էլեկտրոնային); **ե** at the start reads "ye" (երկիր, երբ).
- **ու** is a single vowel written with two letters — never split it.
- Double-check commonly confused pairs: պ/բ/փ, տ/դ/թ, կ/գ/ք, ճ/ջ/չ, ծ/ձ/ց, ռ/ր, ղ/խ.

## 4. Punctuation — use real Armenian characters

| Mark | Char | Code | Usage |
|---|---|---|---|
| Վերջակետ (full stop) | ։ | U+0589 | End of sentence. **Not** Latin `.` and **not** colon `:` |
| Ստորակետ (comma) | , | U+002C | Same as Latin comma |
| Բութ | ՝ | U+055D | Short pause, apposition, after «Հարգանքով՝» |
| Շեշտ | ՛ | U+055B | Emphasis / vocative, **on the stressed vowel**: Հարգելի՛ |
| Հարցական նշան | ՞ | U+055E | Question — **over the stressed vowel of the questioned word**, not at the end: Ինչպե՞ս եք։ |
| Բացականչական նշան | ՜ | U+055C | Exclamation, over the stressed vowel |
| Չակերտներ (quotes) | « » | U+00AB/BB | Quotation marks |
| Միջակետ | . | | Abbreviations: թ., էլ. փոստ |

## 5. Style and register

- Business/external texts: formal **Դուք** with capital Դ (Դուք, Ձեզ, Ձեր) when addressing one person in letters.
- Prefer native constructions over Russian/English calques:
  - «որոշում կայացնել», not «որոշում ընդունել»
  - «լինել» instead of overusing «հանդիսանալ» (calque of «являться»)
  - Avoid word-for-word English structures; restructure the sentence the Armenian way.
- Short sentences, clear verbs, no bureaucratic padding.
- Numbers: decimal comma (3,5), thousands separated by a space (10 000). Currency: դրամ / ֏ after the number.
- Dates: «2026 թ. հոկտեմբերի 20» / «հոկտեմբերի 20-ին».

### Business letter template
```
Հարգելի՛ պարոն Պետրոսյան,        (or: Հարգելի՛ տիկին Սարգսյան,)

<body: who we are in one sentence → why we write to them specifically → value → one clear question>

Հարգանքով՝
<Name Surname>
<Position>, <Company>
<phone> | <email>
```

## 6. IT and business terminology (Eastern)

| Russian / English | Armenian |
|---|---|
| пользователь / user | օգտատեր |
| пароль / password | գաղտնաբառ |
| приложение / app | հավելված |
| сайт / website | կայք |
| база данных / database | տվյալների բազա |
| электронная почта / email | էլեկտրոնային փոստ (էլ. փոստ) |
| скачать / download | ներբեռնել |
| загрузить / upload | վերբեռնել |
| обновление / update | թարմացում |
| настройки / settings | կարգավորումներ |
| ошибка / error | սխալ |
| клиент / client | հաճախորդ |
| предложение / offer | առաջարկ |
| договор / contract | պայմանագիր |
| встреча / meeting | հանդիպում |
| партнёр / partner | գործընկեր |

Established English loanwords (սերվեր, ֆայլ, API, CRM) are fine when Armenian professionals actually use them; do not invent purist neologisms.

If the project has its own glossary (CLAUDE.md, `glossary`, examples of approved texts), it **overrides** this table — read it first and match its style.

## 6a. Examples

Before writing emails, letters, UI strings or other work texts, read `examples.md` in this skill's folder.
- **✅ VERIFIED** examples are written or approved by a native speaker — match their style, wording and structure closely.
- **⚠️ DRAFT** examples are Claude-written — use them only for structure, never as proof that a word or construction is correct.

## 7. Self-check before returning Armenian text

Go through the text once more and verify:
1. Single variant (Eastern reformed by default), no «եւ», correct օ/ո, է/ե at word start.
2. Sentences end with **։**, question/emphasis marks sit on the stressed vowel, quotes are « ».
3. Correct case endings and verb agreement; no calques from Russian/English.
4. Register is consistent (Դուք throughout for external texts).
5. Names, brands, numbers and dates are correct and consistently formatted.
6. Reads naturally aloud — rewrite anything that sounds translated.

If unsure about a word or construction, say so explicitly and offer an alternative instead of guessing. For high-stakes external texts (contracts, campaigns to many clients) recommend a quick native-speaker review of the first version, then reuse it as a template.

## 8. Files and encoding (Windows)

- Always save Armenian text as **UTF-8**. Prefer the Write/Edit tools.
- In Windows PowerShell 5.1, `Set-Content`/`Add-Content` default to ANSI and will corrupt Armenian — pass `-Encoding utf8`.
- If the terminal shows `????` or garbled text, the file is likely fine; suggest `chcp 65001` and a font with Armenian support (Cascadia Code, Segoe UI) in Windows Terminal.
