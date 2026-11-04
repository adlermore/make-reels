import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { Reel } from './compositions/Reel';
import { demoTimeline } from './demo/demoTimeline';
import { IllustrationPreview } from './compositions/IllustrationPreview';
import type { Timeline } from './types/schemas';

const calculateMetadata: CalculateMetadataFunction<Timeline> = ({ props }) => ({
  durationInFrames: props.durationInFrames,
  fps: props.fps,
  width: props.width,
  height: props.height,
});

export const RemotionRoot: React.FC = () => (
  <>
    {/* Every reel renders through this composition; the pipeline passes timeline.json as input props. */}
    <Composition id="Reel" component={Reel} defaultProps={demoTimeline} calculateMetadata={calculateMetadata}
      durationInFrames={demoTimeline.durationInFrames} fps={30} width={1080} height={1920} />
    {/* Utility: preview an SVG illustration as the engine draws it. */}
    <Composition id="IllustrationPreview" component={IllustrationPreview} durationInFrames={90} fps={30} width={720} height={720}
      defaultProps={{ src: '', brand: demoTimeline.brand, safeZone: demoTimeline.safeZone }} />
  </>
);
