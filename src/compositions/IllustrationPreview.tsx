import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BrandProvider } from '../components/brand/BrandContext';
import { Illustration } from '../components/effects/Effects';
import type { BrandConfig, SafeZone } from '../types/schemas';

export interface IllustrationPreviewProps extends Record<string, unknown> {
  src: string;
  brand: BrandConfig;
  safeZone: SafeZone;
}

/** Shows one SVG exactly as the engine draws it, on the brand background (used by `reel illustrations`). */
export const IllustrationPreview: React.FC<IllustrationPreviewProps> = ({ src, brand, safeZone }) => (
  <BrandProvider brand={brand} safeZone={safeZone} width={720} height={720}>
    <AbsoluteFill style={{ backgroundColor: brand.colors.background, alignItems: 'center', justifyContent: 'center' }}>
      {src ? <Illustration src={src} size={640} delay={0} /> : null}
    </AbsoluteFill>
  </BrandProvider>
);
