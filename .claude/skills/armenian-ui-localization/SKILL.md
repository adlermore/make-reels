---
name: armenian-ui-localization
description: Localization of websites, apps and interfaces into Eastern Armenian (Հայերեն) — UI strings, JSON/YAML/PO/XLIFF locale files, buttons, errors, onboarding, emails — preserving keys, placeholders, ICU plurals and length limits, with consistent UI terminology and hy-AM formats. Use when the user asks to localize/translate an interface, i18n files or app strings into Armenian, or to review an existing Armenian localization.
---

# Armenian UI localization

Shared language rules: [../armenian-language-expert/reference/general-rules.md](../armenian-language-expert/reference/general-rules.md).

## Hard rules for locale files
- **Never change keys, file structure, or placeholders**: `{name}`, `{{count}}`, `%s`, `%d`, `%1$s`, `<b>…</b>`, `\n`, ICU `{count, plural, …}`. Translate only human-readable values.
- **Plurals**: Armenian uses CLDR categories `one` and `other`; keep both branches and write the number with the noun in the singular form after numerals as Armenian grammar requires («5 ֆայլ», not «5 ֆայլեր») — verify each string.
- Keep brand/product names and code terms in their original form.
- After editing, check placeholders automatically: `npm run lint:hy-strings -- <source.json> <target.json>` (keys, placeholders, «եւ», Latin «?», mixed alphabets).

## UI conventions
- **Buttons / menu items**: infinitive form — Պահպանել, Չեղարկել, Ջնջել, Խմբագրել, Ներբեռնել, Վերբեռնել, Ուղարկել, Որոնել.
- **Messages to the user**: polite plural «Դուք/Ձեր» capitalised in direct single-user address (account, settings, emails); keep one convention per product.
- **Errors**: say what happened and what to do — «Գաղտնաբառը սխալ է։ Փորձեք կրկին։»
- **Status texts**: «Բեռնվում է…», «Պահպանված է», «Ուղարկված է»։
- **Formats (hy-AM)**: 1 234,5 · 25.10.2026 or «2026 թ. հոկտեմբերի 25» · 14:30 · 5000 ֏ · percent «15%»։
- **Length**: Armenian strings are often 20–35% longer than English — check buttons and tabs for truncation; propose shorter synonyms instead of abbreviating words.
- **Fonts**: ensure the UI font has Armenian glyphs (e.g. Noto Sans Armenian, Google Sans); test diacritics ՞ ՛ ՜.

## Core terminology
| English | Armenian |
|---|---|
| settings | կարգավորումներ |
| sign in / sign out | մուտք գործել / դուրս գալ |
| sign up | գրանցվել |
| password | գաղտնաբառ |
| user / account / profile | օգտատեր / հաշիվ / պրոֆիլ |
| search | որոնել (button) / որոնում (noun) |
| save / cancel / delete / edit | պահպանել / չեղարկել / ջնջել / խմբագրել |
| download / upload | ներբեռնել / վերբեռնել |
| next / back / done | հաջորդը / հետ / պատրաստ է |
| notification | ծանուցում |
| update | թարմացում |
| error / warning | սխալ / զգուշացում |
| file / folder | ֆայլ / պանակ |
| privacy policy / terms | գաղտնիության քաղաքականություն / օգտագործման պայմաններ |

## Output format
- The localized file (same structure) or a string table `key | source | Armenian | note`.
- A list of strings that need product context or may be truncated.
