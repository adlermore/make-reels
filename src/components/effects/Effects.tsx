import React, { useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, interpolate, random, staticFile, useCurrentFrame } from 'remotion';
import { hexToRgba } from '../../animations/motion';
import { useBrand } from '../brand/BrandContext';

/** Film grain: one noise tile generated once, shifted every frame (cheap, no SVG filters). */
let grainDataUrl: string | null = null;
function getGrain(): string {
  if (grainDataUrl) return grainDataUrl;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(random(`grain-${i}`) * 255);
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainDataUrl = canvas.toDataURL('image/png');
  return grainDataUrl;
}

export const FilmGrain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const url = useMemo(() => (opacity > 0 ? getGrain() : ''), [opacity]);
  if (opacity <= 0) return null;
  const x = Math.floor(random(`gx-${frame}`) * 256), y = Math.floor(random(`gy-${frame}`) * 256);
  return <AbsoluteFill style={{ backgroundImage: `url(${url})`, backgroundPosition: `${x}px ${y}px`, opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }} />;
};

export const Vignette: React.FC<{ strength: number }> = ({ strength }) =>
  strength <= 0 ? null : <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: 'none' }} />;

/** Diagonal light sweep — use over headlines / buttons for a premium sheen. */
export const LightSweep: React.FC<{ startFrame?: number; duration?: number; color?: string }> = ({ startFrame = 10, duration = 24, color = '#ffffff' }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [startFrame, startFrame + duration], [-0.4, 1.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (p <= -0.4 || p >= 1.4) return null;
  return <AbsoluteFill style={{ background: `linear-gradient(115deg, transparent ${p * 100 - 15}%, ${hexToRgba(color, 0.35)} ${p * 100}%, transparent ${p * 100 + 15}%)`, mixBlendMode: 'overlay', pointerEvents: 'none' }} />;
};

/** Short white flash for hard cuts / impacts. */
export const Flash: React.FC<{ at?: number; frames?: number; strength?: number }> = ({ at = 0, frames = 6, strength = 0.55 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 1, at + frames], [0, strength, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return o <= 0 ? null : <AbsoluteFill style={{ backgroundColor: `rgba(255,255,255,${o})`, pointerEvents: 'none' }} />;
};

/**
 * SVG illustration with "draw-on" animation. The SVG (written by the asset-producer agent)
 * is sanitised (no scripts / event handlers), every shape gets pathLength=1 so strokes can be
 * revealed via stroke-dashoffset, then fills fade in and the whole piece floats gently.
 */
export function prepareSvg(raw: string): string {
  return raw
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '')
    // Each shape gets: draw order (--i), its own fill-opacity (--fo, multiplied by the fill fade-in),
    // and pathLength=1 for the stroke draw-on. Shapes with their own stroke-dasharray keep it (no draw-on).
    .replace(/<(path|line|circle|rect|polyline|polygon|ellipse)\b([^>]*)>/g, ((): ((m: string, tag: string, attrs: string) => string) => {
      let i = 0;
      return (_m, tag, attrs) => {
        const fo = (attrs.match(/\sfill-opacity\s*=\s*["']([\d.]+)["']/) ?? [])[1] ?? '1';
        const dashed = /\sstroke-dasharray\s*=/.test(attrs);
        const pl = dashed || /pathLength/.test(attrs) ? '' : ' pathLength="1"';
        return `<${tag} data-i="${i}"${dashed ? ' data-nodraw="1"' : ''} style="--i:${i++};--fo:${fo}"${pl}${attrs}>`;
      };
    })())
    .replace(/<svg\b([^>]*)>/, (_m, attrs: string) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="100%" height="100%">`);
}

export const Illustration: React.FC<{ src: string; drawFrames?: number; delay?: number; size?: number }> = ({ src, drawFrames = 36, delay = 4, size = 640 }) => {
  const frame = useCurrentFrame();
  const [svg, setSvg] = useState<string | null>(null);
  const [handle] = useState(() => delayRender(`Loading illustration ${src}`));
  useEffect(() => {
    fetch(staticFile(src))
      .then((r) => { if (!r.ok) throw new Error(`Illustration not found: ${src}`); return r.text(); })
      .then((t) => { setSvg(prepareSvg(t)); continueRender(handle); })
      .catch((e) => cancelRender(e));
  }, [src, handle]);
  // Sequential draw-on: shape i starts when the progress reaches it and overlaps with the next K shapes.
  const p = interpolate(frame, [delay, delay + drawFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shapes = svg ? (svg.match(/data-i="/g) ?? []).length : 1;
  const K = 4;
  const fill = interpolate(frame, [delay + drawFrames * 0.5, delay + drawFrames * 1.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pop = interpolate(frame, [delay, delay + 12], [0.92, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const float = Math.sin(frame / 28) * 10;
  const cls = `ill-${src.replace(/[^a-z0-9]/gi, '')}`;
  if (!svg) return null;
  return (
    <div className={cls} style={{ width: size, height: size, transform: `translateY(${float}px) scale(${pop})`, ['--p' as string]: p, ['--span' as string]: shapes + K, ['--k' as string]: K, ['--fill' as string]: fill }}>
      <style>{`.${cls} svg [data-i]:not([data-nodraw]){stroke-dasharray:1;stroke-dashoffset:clamp(0,calc(1 - (var(--p) * var(--span) - var(--i)) / var(--k)),1)}.${cls} svg [data-nodraw]{opacity:clamp(0,calc((var(--p) * var(--span) - var(--i)) / var(--k)),1)}.${cls} svg [data-i]{fill-opacity:calc(var(--fo) * var(--fill))}`}</style>
      <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};

export const PreviewWatermark: React.FC = () => {
  const { brand } = useBrand();
  return (
    <div style={{ position: 'absolute', top: 40, right: 40, padding: '8px 18px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: brand.colors.accent, fontFamily: 'Arial', fontWeight: 700, fontSize: 30, letterSpacing: 2 }}>
      PREVIEW
    </div>
  );
};
