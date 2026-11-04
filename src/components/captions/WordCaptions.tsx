import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand, CAPTION_BAND_HEIGHT } from '../brand/BrandContext';
import { displayWord, isKeyword, overlapWithText, paginateWords } from '../../utils/captions';
import type { Word } from '../../types/schemas';
import { isLight } from '../backgrounds/Backgrounds';

/** On-screen text of a scene, so captions can step aside when they would only repeat it. */
export interface OnScreenSpan { startMs: number; endMs: number; text: string }

/** A page that repeats ≥ 60% of the visible headline adds nothing for sound-off viewers. */
const REPEAT_THRESHOLD = 0.6;

/**
 * Word-level animated captions: pages of N words, the spoken word is highlighted
 * ('pill' = sits on an accent pill, 'color' = accent text), keywords keep the keyword colour.
 * Always laid out inside the Instagram safe zone.
 */
export const WordCaptions: React.FC<{ words: Word[]; keywords: string[]; cutsMs: number[]; onScreen?: OnScreenSpan[] }> = ({ words, keywords, cutsMs, onScreen = [] }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const { brand, safeZone, captionFont } = useBrand();
  const cs = brand.captions;
  const pages = useMemo(() => {
    const all = paginateWords(words, { maxWords: cs.maxWordsPerPage, cutsMs });
    if (!cs.hideWhenOnScreen) return all;
    return all.filter((p) => {
      const span = onScreen.find((s) => p.startMs >= s.startMs && p.startMs < s.endMs);
      return !span || overlapWithText(p.words, span.text) < REPEAT_THRESHOLD;
    });
  }, [words, cs.maxWordsPerPage, cs.hideWhenOnScreen, cutsMs, onScreen]);
  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
  if (!page) return null;

  const pageStartFrame = Math.round((page.startMs / 1000) * fps);
  const enter = spring({ frame: frame - pageStartFrame, fps, config: { damping: 14, stiffness: 220, mass: 0.6 }, durationInFrames: 8 });
  const light = isLight(brand.colors.background);

  const top =
    cs.position === 'lower-third' ? height - safeZone.bottom - CAPTION_BAND_HEIGHT
    : cs.position === 'upper-third' ? safeZone.top + 40
    : height / 2 - CAPTION_BAND_HEIGHT / 2;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top, left: safeZone.left, right: safeZone.right, height: CAPTION_BAND_HEIGHT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.3em', rowGap: '0.14em',
          fontFamily: captionFont, fontWeight: 800, fontSize: cs.fontSize, lineHeight: 1.14, textAlign: 'center',
          textTransform: cs.uppercase ? 'uppercase' : 'none', transform: `scale(${0.9 + 0.1 * enter}) translateY(${(1 - enter) * 16}px)`, opacity: enter,
        }}>
          {page.words.map((w, i) => {
            const active = ms >= w.startMs && ms < (page.words[i + 1]?.startMs ?? page.endMs);
            const kw = isKeyword(w.text, keywords);
            const wf = Math.round((w.startMs / 1000) * fps);
            const pop = active ? interpolate(frame - wf, [0, 3, 7], [1, 1.07, 1.04], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
            const pill = active && cs.highlightStyle === 'pill';
            const color = pill ? brand.colors.background : active ? cs.highlightColor : kw ? cs.keywordColor : cs.color;
            return (
              <span key={i} style={{
                display: 'inline-block', color, transform: `scale(${pop})`,
                padding: pill ? '0.02em 0.18em 0.08em' : '0.02em 0',
                margin: pill ? '0 -0.08em' : 0,
                borderRadius: '0.22em',
                background: pill ? cs.highlightColor : 'transparent',
                WebkitTextStroke: pill ? '0px transparent' : `${cs.strokeWidth}px ${cs.strokeColor}`, paintOrder: 'stroke fill',
                textShadow: pill ? 'none' : light ? '0 4px 14px rgba(0,0,0,0.10)' : '0 6px 24px rgba(0,0,0,0.45)',
                boxShadow: pill ? `0 8px 26px rgba(0,0,0,${light ? 0.12 : 0.35})` : 'none',
              }}>
                {displayWord(w.text)}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
