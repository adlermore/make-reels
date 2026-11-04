import React, { useMemo } from 'react';
import { AbsoluteFill, Html5Audio, staticFile } from 'remotion';
import { TransitionSeries } from '@remotion/transitions';
import { BrandProvider } from '../components/brand/BrandContext';
import { SceneRenderer } from '../components/layouts/Scenes';
import { FilmGrain, PreviewWatermark, Vignette } from '../components/effects/Effects';
import { WordCaptions } from '../components/captions/WordCaptions';
import { getPresentation, transitionTiming } from '../components/transitions/presentations';
import type { Timeline } from '../types/schemas';

const dbToGain = (db: number) => Math.pow(10, db / 20);

/** The single master composition: every reel is a Timeline (props) rendered by this component. */
export const Reel: React.FC<Timeline> = (t) => {
  const brand = t.brand;
  const cutsMs = useMemo(() => t.scenes.map((s) => (s.cutFrame / t.fps) * 1000), [t.scenes, t.fps]);
  const keywords = useMemo(() => Array.from(new Set(t.scenes.flatMap((s) => s.keywords))), [t.scenes]);
  // what each scene already shows as text (captions skip pages that only repeat it)
  const onScreen = useMemo(() => t.scenes.map((s, i) => ({
    startMs: (s.cutFrame / t.fps) * 1000,
    endMs: i + 1 < t.scenes.length ? (t.scenes[i + 1].cutFrame / t.fps) * 1000 : (t.durationInFrames / t.fps) * 1000,
    text: [s.headline, s.subline, ...s.items, s.stat?.label ?? ''].join(' '),
  })), [t.scenes, t.fps, t.durationInFrames]);

  return (
    <BrandProvider brand={brand} safeZone={t.safeZone} width={t.width} height={t.height} language={t.language}>
      <AbsoluteFill style={{ backgroundColor: brand.colors.background }}>
        <TransitionSeries>
          {t.scenes.map((s, i) => {
            const pres = getPresentation(s.transitionIn);
            return (
              <React.Fragment key={s.sceneId}>
                {i > 0 && pres && s.transitionFrames > 0 ? (
                  <TransitionSeries.Transition presentation={pres} timing={transitionTiming(s.transitionFrames)} />
                ) : null}
                <TransitionSeries.Sequence durationInFrames={s.durationInFrames} name={`${s.sceneId} · ${s.layout}`}>
                  <SceneRenderer scene={s} logoSrc={t.logoSrc} />
                </TransitionSeries.Sequence>
              </React.Fragment>
            );
          })}
        </TransitionSeries>

        <FilmGrain opacity={brand.motion.grain} />
        <Vignette strength={brand.motion.vignette} />
        {t.captions.enabled && brand.captions.enabled && t.mode !== 'poster' && t.captions.words.length > 0 && (
          <WordCaptions words={t.captions.words} keywords={keywords} cutsMs={cutsMs} onScreen={onScreen} />
        )}
        {t.mode === 'preview' && <PreviewWatermark />}

        {t.mode !== 'poster' && (t.audio.mix
          ? <Html5Audio src={staticFile(t.audio.mix)} />
          : <>
              {t.audio.voice && <Html5Audio src={staticFile(t.audio.voice)} />}
              {t.audio.music && <Html5Audio src={staticFile(t.audio.music)} volume={dbToGain(t.audio.musicGainDb)} />}
            </>)}
      </AbsoluteFill>
    </BrandProvider>
  );
};
