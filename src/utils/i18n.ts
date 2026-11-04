/** UI strings the engine draws itself (everything else comes from the agents' shot list). Browser-safe. */
import type { LANGUAGES } from '../types/schemas';

export type Lang = (typeof LANGUAGES)[number];

interface Strings {
  locale: string;
  before: string;
  after: string;
  follow: string;
  quoteOpen: string;
}

export const STRINGS: Record<Lang, Strings> = {
  // Eastern Armenian, reformed orthography
  hy: { locale: 'hy-AM', before: 'Մինչև', after: 'Հետո', follow: 'Հետևել', quoteOpen: '«' },
  ru: { locale: 'ru-RU', before: 'Было', after: 'Стало', follow: 'Подписаться', quoteOpen: '“' },
  en: { locale: 'en-US', before: 'Before', after: 'After', follow: 'Follow', quoteOpen: '“' },
};

export const strings = (lang: string): Strings => STRINGS[(lang in STRINGS ? lang : 'hy') as Lang];
