import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { useBrand } from '../brand/BrandContext';
import { useEnter } from '../../animations/motion';
import { fitFontSize } from '../../utils/fonts';
import { isKeyword } from '../../utils/captions';
import { wrapUnits } from '../../utils/typography';

/**
 * Kinetic headline: each word rises out of a mask with a staggered spring.
 * Keywords get the accent colour and an animated underline bar.
 */
export const KineticHeadline: React.FC<{
  text: string;
  keywords?: string[];
  delay?: number;
  stagger?: number;
  maxLines?: number;
  maxSize?: number;
  minSize?: number;
  align?: 'left' | 'center';
  width?: number;
}> = ({ text, keywords = [], delay = 0, stagger = 3, maxLines = 4, maxSize = 132, minSize = 56, align = 'left', width }) => {
  const frame = useCurrentFrame();
  const { brand, headingFont, headingWeight, contentBox, language } = useBrand();
  const upper = brand.typography.headingCase === 'uppercase';
  const w = width ?? contentBox.width;
  const fontSize = fitFontSize(text, { maxWidth: w, maxLines, max: maxSize, min: minSize, font: brand.typography.headingFont, uppercase: upper });
  const words = wrapUnits(text, language);
  // Armenian glyphs need a little more air than tight Latin display settings
  const tracking = language === 'hy' ? Math.max(brand.typography.letterSpacingEm, -0.01) : brand.typography.letterSpacingEm;
  return (
    <div style={{
      width: w, fontFamily: headingFont, fontWeight: headingWeight, fontSize, lineHeight: language === 'hy' ? 1.1 : 1.06,
      letterSpacing: `${tracking}em`, color: brand.colors.text, textAlign: align,
      textTransform: upper ? 'uppercase' : 'none', display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start',
      columnGap: '0.24em', rowGap: '0.04em',
    }}>
      {words.map((word, i) => <HeadlineWord key={i} word={word} index={i} delay={delay + i * stagger} keyword={word.split(' ').some((part) => isKeyword(part, keywords))} frame={frame} />)}
    </div>
  );
};

const HeadlineWord: React.FC<{ word: string; index: number; delay: number; keyword: boolean; frame: number }> = ({ word, delay, keyword, frame }) => {
  const { brand } = useBrand();
  const p = useEnter(delay);
  const underline = interpolate(frame, [delay + 8, delay + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.08em', position: 'relative' }}>
      <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 105}%) rotate(${(1 - p) * 4}deg)`, color: keyword ? brand.colors.accent : undefined }}>{word}</span>
      {keyword && (
        <span style={{ position: 'absolute', left: 0, bottom: '0.02em', height: '0.08em', width: '100%', background: brand.colors.accent, transform: `scaleX(${underline})`, transformOrigin: 'left', borderRadius: 4 }} />
      )}
    </span>
  );
};

export const Subline: React.FC<{ text: string; delay?: number; size?: number; align?: 'left' | 'center'; color?: string }> = ({ text, delay = 10, size = 46, align = 'left', color }) => {
  const { brand, bodyFont, contentBox } = useBrand();
  const p = useEnter(delay);
  return (
    <div style={{
      width: contentBox.width, fontFamily: bodyFont, fontWeight: brand.typography.bodyWeight, fontSize: size, lineHeight: 1.3,
      color: color ?? brand.colors.textMuted, textAlign: align, opacity: p, transform: `translateY(${(1 - p) * 24}px)`,
    }}>
      {text}
    </div>
  );
};

/** Animated number counter with locale formatting (ru-RU: thin-space thousands). */
export const AnimatedCounter: React.FC<{ value: number; prefix?: string; suffix?: string; decimals?: number; delay?: number; frames?: number; size?: number; locale?: string }> = ({
  value, prefix = '', suffix = '', decimals = 0, delay = 4, frames = 40, size = 240, locale,
}) => {
  const frame = useCurrentFrame();
  const { brand, headingFont, t } = useBrand();
  const p = interpolate(frame, [delay, delay + frames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.exp) });
  const shown = (value * p).toLocaleString(locale ?? t.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const enter = useEnter(delay - 2);
  return (
    <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: size, lineHeight: 1, color: brand.colors.text, letterSpacing: '-0.04em', transform: `scale(${0.85 + 0.15 * enter})`, opacity: enter, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <span style={{ color: brand.colors.accent }}>{prefix}</span>{shown}<span style={{ color: brand.colors.accent, fontSize: size * 0.6 }}>{suffix}</span>
    </div>
  );
};

/** Small pill label ("ФАКТ", "ШАГ 1"...). */
export const Kicker: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const { brand, bodyFont } = useBrand();
  const p = useEnter(delay);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 26px', borderRadius: 999, border: `2px solid ${brand.colors.accent}`, color: brand.colors.accent, fontFamily: bodyFont, fontWeight: 700, fontSize: 34, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: brand.colors.accent }} />
      {text}
    </div>
  );
};
