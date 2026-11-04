import React, { useMemo } from 'react';
import { AbsoluteFill, Img, Loop, OffthreadVideo, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand/BrandContext';
import { hexToRgba } from '../../animations/motion';
import type { TimelineScene } from '../../types/schemas';

/** Relative luminance check so effects adapt to light or dark brands. */
export const isLight = (hex: string) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
};

/** Soft moving colour fields (radial gradients only — cheap to render, no CSS blur). */
export const AuroraBackground: React.FC<{ seed?: number; intensity?: number }> = ({ seed = 1, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { brand } = useBrand();
  const c = brand.colors;
  const blobs = [c.primary, c.secondary, c.accent, c.primary];
  const t = frame / 30;
  const light = isLight(c.background);
  return (
    <AbsoluteFill style={{ backgroundColor: c.background, overflow: 'hidden' }}>
      {blobs.map((col, i) => {
        const r = (k: number) => random(`aurora-${seed}-${i}-${k}`);
        const x = 50 + 38 * Math.sin(t * (0.12 + r(1) * 0.1) + r(2) * 6.28);
        const y = 45 + 35 * Math.cos(t * (0.1 + r(3) * 0.08) + r(4) * 6.28);
        const size = 42 + r(5) * 26;
        return (
          <AbsoluteFill
            key={i}
            style={{
              background: `radial-gradient(circle at ${x}% ${y}%, ${hexToRgba(col, (i === 2 ? 0.28 : 0.5) * intensity)} 0%, ${hexToRgba(col, 0)} ${size}%)`,
              mixBlendMode: light ? 'multiply' : 'screen',
              opacity: light ? 0.35 : 1,
            }}
          />
        );
      })}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${hexToRgba(c.background, 0.15)} 0%, ${hexToRgba(c.background, light ? 0.35 : 0.7)} 100%)` }} />
    </AbsoluteFill>
  );
};

/** Deterministic drifting particles / bokeh. */
export const ParticleField: React.FC<{ count?: number; seed?: number }> = ({ count = 70, seed = 2 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { brand } = useBrand();
  const particles = useMemo(
    () => new Array(count).fill(0).map((_, i) => ({
      x: random(`p-x-${seed}-${i}`) * width,
      y: random(`p-y-${seed}-${i}`) * height,
      r: 2 + random(`p-r-${seed}-${i}`) * (i % 9 === 0 ? 22 : 5),
      speed: 0.4 + random(`p-s-${seed}-${i}`) * 1.4,
      phase: random(`p-ph-${seed}-${i}`) * Math.PI * 2,
      color: i % 3 === 0 ? brand.colors.accent : i % 3 === 1 ? brand.colors.primary : brand.colors.text,
    })),
    [count, seed, width, height, brand.colors],
  );
  return (
    <AbsoluteFill>
      <AuroraBackground seed={seed} intensity={0.6} />
      {particles.map((p, i) => {
        const y = (((p.y - frame * p.speed) % height) + height) % height;
        const x = p.x + Math.sin(frame / 40 + p.phase) * 14;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / 25 + p.phase));
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: p.r * 2, height: p.r * 2, borderRadius: '50%',
            background: `radial-gradient(circle, ${hexToRgba(p.color, 0.9 * tw)} 0%, ${hexToRgba(p.color, 0)} 70%)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

/** Futuristic perspective grid moving towards the camera. */
export const GridBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { brand } = useBrand();
  const offset = (frame * 3) % 80;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AuroraBackground seed={3} intensity={0.7} />
      <AbsoluteFill style={{ perspective: 700, perspectiveOrigin: '50% 30%' }}>
        <div style={{
          position: 'absolute', left: '-50%', width: '200%', top: '45%', height: '120%',
          transform: 'rotateX(68deg)', transformOrigin: 'top center',
          backgroundImage: `linear-gradient(${hexToRgba(brand.colors.primary, 0.5)} 2px, transparent 2px), linear-gradient(90deg, ${hexToRgba(brand.colors.primary, 0.5)} 2px, transparent 2px)`,
          backgroundSize: '80px 80px', backgroundPosition: `0 ${offset}px`,
          maskImage: 'linear-gradient(180deg, transparent 0%, black 30%, black 70%, transparent 100%)',
        }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 46%, ${hexToRgba(brand.colors.accent, 0.35)} 0%, transparent 45%)` }} />
    </AbsoluteFill>
  );
};

const kenBurnsTransform = (mode: TimelineScene['background']['kenBurns'], p: number) => {
  switch (mode) {
    case 'in': return `scale(${1.04 + 0.12 * p})`;
    case 'out': return `scale(${1.16 - 0.12 * p})`;
    case 'left': return `scale(1.15) translateX(${3 - 6 * p}%)`;
    case 'right': return `scale(1.15) translateX(${-3 + 6 * p}%)`;
    default: return 'scale(1)';
  }
};

/** Local footage or still with Ken Burns move and readability dim. */
export const MediaBackground: React.FC<{ bg: TimelineScene['background']; durationInFrames: number }> = ({ bg, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { brand } = useBrand();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const media = bg.type === 'video'
    ? <Loop durationInFrames={Math.max(1, durationInFrames)}><OffthreadVideo src={staticFile(bg.src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Loop>
    : <Img src={staticFile(bg.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  return (
    <AbsoluteFill style={{ backgroundColor: brand.colors.background, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: kenBurnsTransform(bg.kenBurns, p) }}>{media}</AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${hexToRgba(brand.colors.background, bg.dim * 0.6)} 0%, ${hexToRgba(brand.colors.background, bg.dim)} 55%, ${hexToRgba(brand.colors.background, Math.min(0.92, bg.dim + 0.35))} 100%)` }} />
    </AbsoluteFill>
  );
};

export const SceneBackground: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const { brand } = useBrand();
  const bg = scene.background;
  if ((bg.type === 'video' || bg.type === 'image') && bg.src) return <MediaBackground bg={bg} durationInFrames={scene.durationInFrames} />;
  switch (bg.motionPreset) {
    case 'particles': return <ParticleField seed={scene.sceneIndex + 1} />;
    case 'grid': return <GridBackground />;
    case 'solid': return <AbsoluteFill style={{ backgroundColor: brand.colors.background }} />;
    default: return <AuroraBackground seed={scene.sceneIndex + 1} />;
  }
};
