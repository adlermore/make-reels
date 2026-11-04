/**
 * Headline typography per language (browser-safe):
 * - non-breaking space BEFORE a dash — a line must never start with «—» (all languages)
 * - non-breaking space AFTER short function words — they must not hang at a line end
 *   (Russian prepositions/conjunctions; Armenian «և», «ու», «որ», «ոչ»…)
 */
const NBSP = ' ';

const SHORT_WORDS: Record<string, Set<string>> = {
  ru: new Set(['а', 'в', 'и', 'к', 'о', 'с', 'у', 'я', 'во', 'да', 'до', 'же', 'за', 'из', 'ко', 'на', 'не', 'ни', 'но', 'об', 'от', 'по', 'со', 'то', 'для', 'без', 'над', 'под', 'при', 'про', 'что', 'как']),
  hy: new Set(['և', 'ու', 'ի', 'որ', 'ոչ', 'մի', 'էլ', 'թե', 'այս', 'այդ', 'այն', 'ավելի', 'չի', 'չեն']),
  en: new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'and', 'or', 'not']),
};

const SENTENCE_END = /[.!?…։]$/;

export function typograph(text: string, lang = 'hy'): string {
  const short = SHORT_WORDS[lang] ?? SHORT_WORDS.hy;
  const tokens = text.trim().split(/ +/);
  const out: string[] = [];
  for (const t of tokens) {
    if (/^[—–-]$/.test(t) && out.length) { out[out.length - 1] += NBSP + t; continue; }
    out.push(t);
  }
  const joined: string[] = [];
  for (let i = 0; i < out.length; i++) {
    // check the LAST word of a unit, so chains like «ոչ թե …» keep gluing forward
    const bare = (out[i].split(NBSP).pop() ?? '').toLowerCase().replace(/[^\p{L}]/gu, '');
    if (short.has(bare) && i + 1 < out.length && !SENTENCE_END.test(out[i])) { out[i + 1] = out[i] + NBSP + out[i + 1]; continue; }
    joined.push(out[i]);
  }
  return joined.join(' ');
}

/** @deprecated kept for backwards compatibility */
export const typographRu = (text: string) => typograph(text, 'ru');

/** Split typographed text into wrap units (regular spaces only; NBSP keeps units together). */
export const wrapUnits = (text: string, lang = 'hy') => typograph(text, lang).split(' ').filter(Boolean);
