import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../components/brand/BrandContext';

/** Spring config per brand motion style: calm = soft, dynamic = balanced, punchy = snappy. */
export function useSpringConfig() {
  const { brand } = useBrand();
  switch (brand.motion.style) {
    case 'calm': return { damping: 200, stiffness: 80, mass: 1 };
    case 'punchy': return { damping: 12, stiffness: 220, mass: 0.7 };
    default: return { damping: 16, stiffness: 150, mass: 0.8 };
  }
}

/** 0→1 entrance progress starting at `delay` frames. */
export function useEnter(delay = 0, durationInFrames?: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = useSpringConfig();
  return spring({ frame: frame - delay, fps, config, durationInFrames });
}

/** Linear-eased progress between two frames (clamped). */
export function useProgress(from: number, to: number, easing: (t: number) => number = Easing.inOut(Easing.cubic)) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
}

export const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
