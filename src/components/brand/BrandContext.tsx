import React, { createContext, useContext, useMemo } from 'react';
import { ProductionStandards, type BrandConfig, type SafeZone } from '../../types/schemas';
import { clampWeight, fontFamily, fontForLanguage } from '../../utils/fonts';
import { strings, type Lang } from '../../utils/i18n';

interface BrandCtx {
  brand: BrandConfig;
  safeZone: SafeZone;
  /** Content language of the reel (hy = Eastern Armenian). Drives typography, numbers and UI labels. */
  language: Lang;
  t: ReturnType<typeof strings>;
  headingFont: string;
  bodyFont: string;
  captionFont: string;
  headingWeight: number;
  /** Content area for scene text: inside safe zone, above the caption band. */
  contentBox: { top: number; left: number; right: number; bottom: number; width: number; height: number };
}

const Ctx = createContext<BrandCtx | null>(null);

export const CAPTION_BAND_HEIGHT = ProductionStandards.captionBandHeight;

export const BrandProvider: React.FC<{ brand: BrandConfig; safeZone: SafeZone; width: number; height: number; language?: string; children: React.ReactNode }> = ({ brand, safeZone, width, height, language = 'hy', children }) => {
  const value = useMemo<BrandCtx>(() => {
    const top = safeZone.top;
    const bottom = brand.captions.enabled && brand.captions.position === 'lower-third' ? safeZone.bottom + CAPTION_BAND_HEIGHT : safeZone.bottom;
    const lang = (['hy', 'ru', 'en'].includes(language) ? language : 'hy') as Lang;
    return {
      brand,
      safeZone,
      language: lang,
      t: strings(lang),
      headingFont: fontFamily(fontForLanguage(brand.typography.headingFont, lang)),
      bodyFont: fontFamily(fontForLanguage(brand.typography.bodyFont, lang)),
      captionFont: fontFamily(fontForLanguage(brand.captions.font, lang)),
      headingWeight: clampWeight(fontForLanguage(brand.typography.headingFont, lang), brand.typography.headingWeight),
      contentBox: { top, left: safeZone.left, right: safeZone.right, bottom, width: width - safeZone.left - safeZone.right, height: height - top - bottom },
    };
  }, [brand, safeZone, width, height, language]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useBrand(): BrandCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBrand() must be used inside <BrandProvider>');
  return v;
}
