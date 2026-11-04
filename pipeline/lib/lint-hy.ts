/**
 * Professional Eastern Armenian checks for on-screen text and narration (reformed orthography).
 * Errors block the stage; warnings go to the orchestrator. Mirrors the armenian-language style guide
 * (.claude/skills/armenian-language-expert/reference/reels-style-guide.md).
 */
const ARM = /[Ա-և]/u;
const LAT = /[A-Za-z]/;
const CYR = /[Ѐ-ӿ]/;

export interface LintResult { errors: string[]; warnings: string[] }

export function lintArmenian(text: string, where: string, kind: 'narration' | 'screen'): LintResult {
  const errors: string[] = [], warnings: string[] = [];
  if (!text || !ARM.test(text)) return { errors, warnings };

  if (/եւ/u.test(text)) errors.push(`${where}: «եւ» → «և» (reformed orthography uses the single letter U+0587)`);

  for (const token of text.split(/\s+/)) {
    for (const part of token.split(/[-‑–—]/)) {
      const letters = part.replace(/[^\p{L}]/gu, '');
      if (ARM.test(letters) && (LAT.test(letters) || CYR.test(letters))) {
        errors.push(`${where}: mixed alphabets in «${token}» — a Latin/Cyrillic look-alike letter is typed inside an Armenian word`);
      }
    }
  }

  // abbreviations legitimately use «.» (2026 թ., էլ. փոստ, պրն., տկն.) — remove them before checking
  const noAbbr = text.replace(/(?<!\p{L})(թթ|թ|էլ|պրն|տկն|այլն)\./gu, '');
  if (/[\p{L}\d][.](\s|$)/u.test(noAbbr)) {
    (kind === 'narration' ? warnings : errors).push(`${where}: sentence ends with Latin «.» — use the Armenian full stop «։» (U+0589)`);
  }
  if (/[\p{L}\d]:(\s|$)/u.test(text)) warnings.push(`${where}: «:» used as a full stop — use «։» (U+0589)`);
  if (/\?/.test(text)) errors.push(`${where}: Latin «?» — put «՞» (U+055E) over the stressed vowel of the questioned word (e.g. Ինչպե՞ս)`);
  if (/!/.test(text)) warnings.push(`${where}: Latin «!» — Armenian uses «՜» (U+055C) over the stressed vowel; keep «!» only if it is a deliberate stylistic choice`);
  if (/"[^"]+"/.test(text)) warnings.push(`${where}: straight quotes — use « » in Armenian text`);
  if (kind === 'narration' && LAT.test(text)) warnings.push(`${where}: Latin letters in narration — the Armenian voice cannot read them reliably; add "pronunciation" written in Armenian letters`);
  return { errors, warnings };
}
