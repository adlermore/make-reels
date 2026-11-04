import React from 'react';
import { AbsoluteFill, Easing } from 'remotion';
import { linearTiming } from '@remotion/transitions';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import type { TRANSITIONS } from '../../types/schemas';

type Empty = Record<string, unknown>;

/** Zoom-through: incoming scene scales down from 112% with motion blur; outgoing pushes forward. */
const ZoomComp: React.FC<TransitionPresentationComponentProps<Empty>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const style: React.CSSProperties = presentationDirection === 'entering'
    ? { opacity: Math.min(1, p * 1.6), transform: `scale(${1.12 - 0.12 * p})`, filter: `blur(${(1 - p) * 10}px)` }
    : { transform: `scale(${1 + 0.1 * p})`, filter: `blur(${p * 8}px)` };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

/** Vertical slide with blur — the default "social" cut. */
const BlurSlideComp: React.FC<TransitionPresentationComponentProps<Empty>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const style: React.CSSProperties = presentationDirection === 'entering'
    ? { transform: `translateY(${(1 - p) * 100}%)`, filter: `blur(${(1 - p) * 12}px)` }
    : { transform: `translateY(${-p * 35}%) scale(${1 - 0.06 * p})`, filter: `blur(${p * 10}px)`, opacity: 1 - p * 0.5 };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

const zoom = (): TransitionPresentation<Empty> => ({ component: ZoomComp, props: {} });
const blurSlide = (): TransitionPresentation<Empty> => ({ component: BlurSlideComp, props: {} });

export function getPresentation(t: (typeof TRANSITIONS)[number]): TransitionPresentation<Record<string, unknown>> | null {
  switch (t) {
    case 'fade': return fade() as TransitionPresentation<Record<string, unknown>>;
    case 'slide': return slide({ direction: 'from-bottom' }) as TransitionPresentation<Record<string, unknown>>;
    case 'wipe': return wipe({ direction: 'from-bottom-left' }) as TransitionPresentation<Record<string, unknown>>;
    case 'zoom': return zoom() as TransitionPresentation<Record<string, unknown>>;
    case 'blur-slide': return blurSlide() as TransitionPresentation<Record<string, unknown>>;
    default: return null;
  }
}

export const transitionTiming = (frames: number) => linearTiming({ durationInFrames: frames, easing: Easing.inOut(Easing.cubic) });
