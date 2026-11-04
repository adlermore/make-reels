/** Caption paging shared by the Remotion captions and the SRT exporter (browser-safe). */
import type { Word } from '../types/schemas';

export interface CaptionPage {
  startMs: number;
  endMs: number;
  words: Word[];
}

// «։» = Armenian full stop (verjaket); «՝» (but) = Armenian short pause
const SENTENCE_END = /[.!?…։]["»)]?$/;
const CLAUSE_END = /[,;:—՝]$/;

export function paginateWords(words: Word[], o: { maxWords: number; maxGapMs?: number; cutsMs?: number[] }): CaptionPage[] {
  const maxGap = o.maxGapMs ?? 450;
  const cuts = [...(o.cutsMs ?? [])].sort((a, b) => a - b);
  const pages: CaptionPage[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) pages.push({ startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, words: cur });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (prev && cur.length) {
      const gap = w.startMs - prev.endMs;
      const crossesCut = cuts.some((c) => prev.endMs <= c && w.startMs >= c - 80);
      if (gap > maxGap || crossesCut || SENTENCE_END.test(prev.text) || (CLAUSE_END.test(prev.text) && cur.length >= 2)) flush();
    }
    cur.push(w);
    const next = words[i + 1];
    const nextIsLastOfSentence = !!next && SENTENCE_END.test(next.text) && !SENTENCE_END.test(w.text) && next.startMs - w.endMs <= maxGap;
    if (cur.length >= o.maxWords && !(nextIsLastOfSentence && cur.length < o.maxWords + 1)) flush();
  });
  flush();
  // Hold each page until the next one starts (avoids flicker), but never longer than 700 ms of silence.
  for (let i = 0; i < pages.length; i++) {
    const next = pages[i + 1];
    const hold = next ? Math.min(next.startMs, pages[i].endMs + 700) : pages[i].endMs + 500;
    const cutAfter = cuts.find((c) => c > pages[i].endMs - 1 && c < hold);
    pages[i].endMs = cutAfter !== undefined ? Math.max(pages[i].endMs, cutAfter - 120) : hold;
  }
  return pages;
}

/** Strip trailing commas/periods (incl. Armenian «։» «՝») for on-screen display; keep ? ! ՞ ՜ ՛ and quotes. */
export function displayWord(text: string): string {
  return text.replace(/[.,;:։՝]+$/u, '');
}

/** Share of a caption page's words that are already visible in the on-screen headline (0–1). */
export function overlapWithText(words: Word[], onScreen: string): number {
  const screen = new Set(onScreen.split(/\s+/).map(normalizeForMatch).filter(Boolean));
  const ws = words.map((w) => normalizeForMatch(w.text)).filter(Boolean);
  if (!ws.length || !screen.size) return 0;
  return ws.filter((w) => screen.has(w)).length / ws.length;
}

export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
}

export function isKeyword(word: string, keywords: string[]): boolean {
  const w = normalizeForMatch(word);
  if (!w) return false;
  return keywords.some((k) => {
    const kk = normalizeForMatch(k);
    // match word forms by stem (first ≥5 letters): works for Russian and Armenian suffix inflection
    return kk.length > 0 && (w === kk || (kk.length >= 5 && w.startsWith(kk.slice(0, Math.max(5, kk.length - 2)))));
  });
}

export function msToSrt(ms: number): string {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = Math.round(ms % 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(x, 3)}`;
}

export function pagesToSrt(pages: CaptionPage[]): string {
  return pages.map((p, i) => `${i + 1}\n${msToSrt(p.startMs)} --> ${msToSrt(p.endMs)}\n${p.words.map((w) => w.text).join(' ')}\n`).join('\n'); // SRT keeps punctuation
}
