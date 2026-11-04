import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';
import { loadFont as loadUnbounded } from '@remotion/google-fonts/Unbounded';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as loadGolosText } from '@remotion/google-fonts/GolosText';
import { loadFont as loadOnest } from '@remotion/google-fonts/Onest';
import { loadFont as loadNotoSansArmenian } from '@remotion/google-fonts/NotoSansArmenian';
import { loadFont as loadGoogleSans } from '@remotion/google-fonts/GoogleSans';
import type { FONT_FAMILIES } from '../types/schemas';

export type FontName = (typeof FONT_FAMILIES)[number];

type Loader = (style?: string, opts?: { weights?: string[]; subsets?: string[] }) => { fontFamily: string };

/** Loader + the weights/subsets each family really ships (verified in @remotion/google-fonts typings). */
const FONTS: Record<FontName, { load: Loader; weights: string[]; subsets: string[]; widthEm: number }> = {
  Manrope: { load: loadManrope as unknown as Loader, weights: ['400', '500', '600', '700', '800'], subsets: ['cyrillic', 'latin'], widthEm: 0.6 },
  Unbounded: { load: loadUnbounded as unknown as Loader, weights: ['400', '500', '600', '700', '800'], subsets: ['cyrillic', 'latin'], widthEm: 0.8 },
  Inter: { load: loadInter as unknown as Loader, weights: ['400', '500', '600', '700', '800'], subsets: ['cyrillic', 'latin'], widthEm: 0.6 },
  Montserrat: { load: loadMontserrat as unknown as Loader, weights: ['400', '500', '600', '700', '800'], subsets: ['cyrillic', 'latin'], widthEm: 0.68 },
  GolosText: { load: loadGolosText as unknown as Loader, weights: ['400', '500', '600', '700', '800'], subsets: ['cyrillic', 'latin'], widthEm: 0.6 },
  Onest: { load: loadOnest as unknown as Loader, weights: ['400', '500', '600', '700', '800'], subsets: ['cyrillic', 'latin'], widthEm: 0.6 },
  NotoSansArmenian: { load: loadNotoSansArmenian as unknown as Loader, weights: ['400', '500', '600', '700', '800'], subsets: ['armenian', 'latin'], widthEm: 0.62 },
  GoogleSans: { load: loadGoogleSans as unknown as Loader, weights: ['400', '500', '600', '700'], subsets: ['armenian', 'cyrillic', 'latin'], widthEm: 0.6 },
};

/** Armenian glyphs are wider on average than Latin/Cyrillic ones. */
const ARMENIAN_WIDTH_EM = 0.66;
const ARMENIAN_RE = /[Ա-֏]/;

const cache = new Map<FontName, string>();
let armenianFallback: string | null = null;

function loadFamily(name: FontName): string {
  const f = FONTS[name];
  return f.load('normal', { weights: f.weights, subsets: f.subsets }).fontFamily;
}

/**
 * CSS font stack for a brand font. Noto Sans Armenian is always appended, so a Latin/Cyrillic
 * brand font still renders Armenian text with a professional typeface (per-glyph fallback).
 */
export function fontFamily(name: FontName): string {
  const hit = cache.get(name);
  if (hit) return hit;
  armenianFallback ??= loadFamily('NotoSansArmenian');
  const family = loadFamily(name);
  const css = `"${family}", "${armenianFallback}", "Segoe UI", Arial, sans-serif`;
  cache.set(name, css);
  return css;
}

const ARMENIAN_CAPABLE: FontName[] = ['NotoSansArmenian', 'GoogleSans'];

/** For Armenian reels use an Armenian-capable family for the whole text (letters AND digits from one typeface). */
export function fontForLanguage(name: FontName, language: string): FontName {
  return language === 'hy' && !ARMENIAN_CAPABLE.includes(name) ? 'NotoSansArmenian' : name;
}

/** Heading weight clamped to what the family ships (e.g. Google Sans tops out at 700). */
export function clampWeight(name: FontName, weight: number): number {
  const max = Math.max(...FONTS[name].weights.map(Number));
  return Math.min(weight, max);
}

/**
 * Pick the biggest font size so `text` fits into `maxLines` lines of `maxWidth` px
 * and the longest word fits on one line.
 */
export function fitFontSize(text: string, o: { maxWidth: number; maxLines: number; max: number; min: number; font: FontName; uppercase?: boolean }): number {
  const base = ARMENIAN_RE.test(text) ? Math.max(FONTS[o.font].widthEm, ARMENIAN_WIDTH_EM) : FONTS[o.font].widthEm;
  const k = base * (o.uppercase ? 1.12 : 1);
  const chars = Math.max(1, text.length);
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  const byLines = (o.maxWidth * o.maxLines) / (k * chars * 1.08);
  const byWord = o.maxWidth / (k * longest * 1.04);
  return Math.round(Math.max(o.min, Math.min(o.max, byLines, byWord)));
}
