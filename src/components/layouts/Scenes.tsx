import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand/BrandContext';
import { SceneBackground } from '../backgrounds/Backgrounds';
import { Flash, Illustration, LightSweep } from '../effects/Effects';
import { AnimatedCounter, Kicker, KineticHeadline, Subline } from '../typography/Typography';
import { hexToRgba, useEnter } from '../../animations/motion';
import type { TimelineScene } from '../../types/schemas';

/** Height reserved at the bottom of the content box for the source footnote. */
const FOOTNOTE_RESERVE = 76;
const SceneCtx = createContext<{ hasSource: boolean }>({ hasSource: false });

/** Positions children inside the content box (safe zone minus caption band, minus footnote space). */
const ContentBox: React.FC<{ children: React.ReactNode; justify?: 'center' | 'flex-start' | 'flex-end'; align?: 'flex-start' | 'center'; gap?: number }> = ({ children, justify = 'center', align = 'flex-start', gap = 36 }) => {
  const { contentBox } = useBrand();
  const { hasSource } = useContext(SceneCtx);
  const height = contentBox.height - (hasSource ? FOOTNOTE_RESERVE : 0);
  return (
    <div style={{ position: 'absolute', top: contentBox.top, left: contentBox.left, width: contentBox.width, height, display: 'flex', flexDirection: 'column', justifyContent: justify, alignItems: align, gap }}>
      {children}
    </div>
  );
};

/** Illustration sized to leave room for the headline inside the content box (never enters the top unsafe zone). */
const MaybeIllustration: React.FC<{ scene: TimelineScene; size?: number }> = ({ scene, size = 520 }) => {
  const { contentBox } = useBrand();
  const { hasSource } = useContext(SceneCtx);
  const textRoom = 560 + (hasSource ? FOOTNOTE_RESERVE : 0); // up to 4 headline lines + subline
  const fit = Math.max(260, Math.min(size, contentBox.height - textRoom));
  return scene.illustration ? <Illustration src={scene.illustration} size={fit} /> : null;
};

// ───────────────────────────── layouts ─────────────────────────────

/**
 * Hook with a number: giant counter, the accent ring closes around it, headline punches in below.
 * Readable from the very first frame (counter starts at ~70% and the ring is already drawing).
 */
export const HookStatScene: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = useBrand();
  const stat = scene.stat ?? { value: 0, prefix: '', suffix: '', label: '', decimals: 0 };
  const punch = spring({ frame: frame + 4, fps, config: { damping: 12, stiffness: 150, mass: 0.7 } });
  // honest ring: proportional for percentages, full circle otherwise
  const target = stat.suffix.includes('%') ? Math.min(1, stat.value / 100) : 1;
  const ring = interpolate(frame, [0, 26], [0.35 * target, target], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const R = 250, C = 2 * Math.PI * R, S = 2 * R + 40;
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      <AbsoluteFill style={{ transform: `scale(${1.14 - 0.14 * punch})` }}>
        <ContentBox align="center" gap={26}>
          <div style={{ position: 'relative', width: S, height: S, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={S} height={S} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={hexToRgba(brand.colors.text, 0.1)} strokeWidth={16} />
              <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={brand.colors.accent} strokeWidth={16} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} />
            </svg>
            <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} decimals={stat.decimals} delay={-6} frames={34} size={stat.value >= 1000 ? 130 : 190} />
          </div>
          <KineticHeadline text={scene.headline} keywords={scene.keywords} align="center" maxSize={104} maxLines={3} stagger={1} delay={-10} />
        </ContentBox>
      </AbsoluteFill>
      <Flash at={0} frames={5} strength={0.2} />
    </AbsoluteFill>
  );
};

export const HookScene: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const punch = spring({ frame: frame + 4, fps, config: { damping: 11, stiffness: 160, mass: 0.7 } });
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      <AbsoluteFill style={{ transform: `scale(${1.18 - 0.18 * punch})` }}>
        <ContentBox align="center">
          <MaybeIllustration scene={scene} size={460} />
          <KineticHeadline text={scene.headline} keywords={scene.keywords} align="center" maxSize={150} stagger={1} delay={-14} />
          {scene.subline && <Subline text={scene.subline} align="center" delay={14} />}
        </ContentBox>
      </AbsoluteFill>
      <Flash at={0} frames={5} strength={0.22} />
    </AbsoluteFill>
  );
};

export const KineticTitleScene: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const { brand } = useBrand();
  const bar = useEnter(2);
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      <ContentBox>
        <MaybeIllustration scene={scene} />
        <div style={{ width: 120, height: 10, borderRadius: 5, background: brand.colors.accent, transform: `scaleX(${bar})`, transformOrigin: 'left' }} />
        <KineticHeadline text={scene.headline} keywords={scene.keywords} />
        {scene.subline && <Subline text={scene.subline} />}
      </ContentBox>
    </AbsoluteFill>
  );
};

export const FullbleedScene: React.FC<{ scene: TimelineScene }> = ({ scene }) => (
  <AbsoluteFill>
    <SceneBackground scene={scene} />
    <ContentBox justify="flex-end">
      <MaybeIllustration scene={scene} />
      {scene.headline && <KineticHeadline text={scene.headline} keywords={scene.keywords} maxSize={110} maxLines={3} />}
      {scene.subline && <Subline text={scene.subline} />}
    </ContentBox>
  </AbsoluteFill>
);

export const StatScene: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { brand } = useBrand();
  const stat = scene.stat ?? { value: 0, prefix: '', suffix: '', label: '', decimals: 0 };
  const pct = stat.suffix.includes('%') ? Math.min(1, stat.value / 100) : 1;
  const ring = interpolate(frame, [4, 48], [0, pct], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.exp) });
  const R = 300, C = 2 * Math.PI * R;
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      <ContentBox align="center" gap={28}>
        {scene.headline && <Kicker text={scene.headline} />}
        <div style={{ position: 'relative', width: 2 * R + 40, height: 2 * R + 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={2 * R + 40} height={2 * R + 40} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={hexToRgba(brand.colors.text, 0.1)} strokeWidth={18} />
            <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={brand.colors.accent} strokeWidth={18} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} />
          </svg>
          <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} decimals={stat.decimals} size={stat.value >= 1000 ? 150 : 200} />
        </div>
        {(stat.label || scene.subline) && <Subline text={stat.label || scene.subline} align="center" delay={20} size={50} color={brand.colors.text} />}
      </ContentBox>
      <LightSweep startFrame={40} />
    </AbsoluteFill>
  );
};

const ListItem: React.FC<{ text: string; index: number; delay: number }> = ({ text, index, delay }) => {
  const frame = useCurrentFrame();
  const { brand, bodyFont } = useBrand();
  const p = useEnter(delay);
  const check = interpolate(frame, [delay + 4, delay + 14], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: p, transform: `translateX(${(1 - p) * 60}px)`, padding: '22px 28px', borderRadius: 28, background: hexToRgba(brand.colors.text, 0.07), border: `2px solid ${hexToRgba(brand.colors.text, 0.12)}`, width: '100%' }}>
      <svg width={64} height={64} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
        <circle cx={32} cy={32} r={30} fill={brand.colors.accent} />
        <path d="M18 33 L28 43 L47 22" fill="none" stroke={brand.colors.background} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={check} />
      </svg>
      <div style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: 50, lineHeight: 1.15, color: brand.colors.text }}>
        <span style={{ color: brand.colors.accent, marginRight: 14 }}>{index + 1}.</span>{text}
      </div>
    </div>
  );
};

export const ListScene: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const n = Math.max(1, scene.items.length);
  const spacing = Math.max(8, Math.min(30, Math.floor((scene.durationInFrames * 0.6) / n)));
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      <ContentBox gap={26}>
        {scene.headline && <KineticHeadline text={scene.headline} keywords={scene.keywords} maxSize={92} maxLines={2} />}
        {scene.items.map((it, i) => <ListItem key={i} text={it} index={i} delay={12 + i * spacing} />)}
      </ContentBox>
    </AbsoluteFill>
  );
};

export const QuoteScene: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const { brand, headingFont, t } = useBrand();
  const p = useEnter(0);
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      <ContentBox>
        <div style={{ fontFamily: headingFont, fontSize: 260, lineHeight: 0.6, height: 140, color: brand.colors.accent, opacity: p, transform: `translateY(${(1 - p) * -40}px)` }}>{t.quoteOpen}</div>
        <KineticHeadline text={scene.headline} keywords={scene.keywords} maxSize={96} stagger={2} />
        {scene.subline && <Subline text={`— ${scene.subline}`} delay={18} />}
      </ContentBox>
    </AbsoluteFill>
  );
};

export const SplitRevealScene: React.FC<{ scene: TimelineScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { brand, bodyFont, headingFont, t } = useBrand();
  const [before = '', after = ''] = scene.items;
  const a = useEnter(4);
  const strike = interpolate(frame, [18, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b = useEnter(24);
  const card = (bg: string, border: string): React.CSSProperties => ({ width: '100%', padding: '34px 36px', borderRadius: 32, background: bg, border: `3px solid ${border}`, fontFamily: headingFont, fontWeight: 800, fontSize: 64, lineHeight: 1.1 });
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      <ContentBox gap={30}>
        {scene.headline && <Kicker text={scene.headline} />}
        <div style={{ ...card(hexToRgba(brand.colors.text, 0.06), hexToRgba(brand.colors.text, 0.15)), color: brand.colors.textMuted, opacity: a, transform: `translateY(${(1 - a) * 30}px)`, position: 'relative' }}>
          <div style={{ fontFamily: bodyFont, fontSize: 30, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>{t.before}</div>
          <span style={{ position: 'relative' }}>
            {before}
            <span style={{ position: 'absolute', left: 0, top: '55%', height: 8, width: '100%', background: brand.colors.textMuted, transform: `scaleX(${strike})`, transformOrigin: 'left' }} />
          </span>
        </div>
        <div style={{ ...card(hexToRgba(brand.colors.accent, 0.14), brand.colors.accent), color: brand.colors.text, opacity: b, transform: `translateY(${(1 - b) * 40}px) scale(${0.96 + 0.04 * b})`, boxShadow: `0 0 80px ${hexToRgba(brand.colors.accent, 0.35 * b)}` }}>
          <div style={{ fontFamily: bodyFont, fontSize: 30, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10, color: brand.colors.accent, textTransform: 'uppercase' }}>{t.after}</div>
          {after}
        </div>
      </ContentBox>
    </AbsoluteFill>
  );
};

export const CTAScene: React.FC<{ scene: TimelineScene; logoSrc: string }> = ({ scene, logoSrc }) => {
  const frame = useCurrentFrame();
  const { brand, bodyFont, headingFont, t } = useBrand();
  const logo = useEnter(0);
  const btn = useEnter(16);
  const pulse = 1 + 0.035 * Math.sin(Math.max(0, frame - 24) / 5);
  return (
    <AbsoluteFill>
      <SceneBackground scene={scene} />
      <ContentBox align="center" gap={40}>
        <div style={{ opacity: logo, transform: `scale(${0.8 + 0.2 * logo})` }}>
          {logoSrc
            ? <Img src={staticFile(logoSrc)} style={{ height: 150 }} />
            : <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 64, color: brand.colors.text, letterSpacing: '-0.02em' }}>{brand.name}</div>}
        </div>
        <KineticHeadline text={scene.headline} keywords={scene.keywords} align="center" maxSize={104} maxLines={3} />
        <div style={{ position: 'relative', overflow: 'hidden', padding: '30px 64px', borderRadius: 999, background: brand.colors.accent, color: brand.colors.background, fontFamily: bodyFont, fontWeight: 800, fontSize: 50, opacity: btn, transform: `translateY(${(1 - btn) * 40}px) scale(${pulse})`, boxShadow: `0 20px 60px ${hexToRgba(brand.colors.accent, 0.45)}` }}>
          {scene.subline || t.follow}
          <LightSweep startFrame={30} duration={22} />
        </div>
        {brand.instagramHandle && <div style={{ fontFamily: bodyFont, fontWeight: 600, fontSize: 42, color: brand.colors.textMuted, opacity: btn }}>{brand.instagramHandle}</div>}
      </ContentBox>
    </AbsoluteFill>
  );
};

/** Small source footnote at the bottom of the content box (credibility for statistics). */
export const SourceFootnote: React.FC<{ text: string }> = ({ text }) => {
  const { brand, bodyFont, contentBox } = useBrand();
  const p = useEnter(18);
  if (!text) return null;
  return (
    <div style={{ position: 'absolute', left: contentBox.left, width: contentBox.width, top: contentBox.top + contentBox.height - 44, fontFamily: bodyFont, fontWeight: 600, fontSize: 32, color: brand.colors.textMuted, opacity: p, letterSpacing: '0.01em' }}>
      {text}
    </div>
  );
};

export const SceneRenderer: React.FC<{ scene: TimelineScene; logoSrc: string }> = ({ scene, logoSrc }) => (
  <SceneCtx.Provider value={{ hasSource: !!scene.source }}>
    <AbsoluteFill>
      <LayoutSwitch scene={scene} logoSrc={logoSrc} />
      <SourceFootnote text={scene.source} />
    </AbsoluteFill>
  </SceneCtx.Provider>
);

const LayoutSwitch: React.FC<{ scene: TimelineScene; logoSrc: string }> = ({ scene, logoSrc }) => {
  switch (scene.layout) {
    case 'hook': return <HookScene scene={scene} />;
    case 'hook-stat': return <HookStatScene scene={scene} />;
    case 'fullbleed': return <FullbleedScene scene={scene} />;
    case 'stat': return <StatScene scene={scene} />;
    case 'list': return <ListScene scene={scene} />;
    case 'quote': return <QuoteScene scene={scene} />;
    case 'split-reveal': return <SplitRevealScene scene={scene} />;
    case 'cta': return <CTAScene scene={scene} logoSrc={logoSrc} />;
    default: return <KineticTitleScene scene={scene} />;
  }
};
