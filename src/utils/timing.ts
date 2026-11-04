/**
 * Converts scene cut points into TransitionSeries sequence layout.
 * Transition i is centred on cut i, so the visual cut lands on the voiceover boundary.
 * Browser-safe; used by the demo and by pipeline/commands/timeline.ts.
 */
export interface CutSpec {
  cutFrame: number;
  transitionFrames: number; // overlap into this scene from the previous one (0 for first / "none")
}

export function sequenceLayout(cuts: CutSpec[], totalFrames: number): Array<{ from: number; durationInFrames: number; transitionFrames: number }> {
  const n = cuts.length;
  const tf = cuts.map((c, i) => (i === 0 ? 0 : c.transitionFrames));
  // Clamp transitions so each scene is at least 2× its neighbouring transitions + 6 frames.
  for (let i = 1; i < n; i++) {
    const prevLen = cuts[i].cutFrame - cuts[i - 1].cutFrame;
    const nextLen = (i + 1 < n ? cuts[i + 1].cutFrame : totalFrames) - cuts[i].cutFrame;
    const maxTf = Math.floor(Math.min(prevLen, nextLen) / 2) - 3;
    tf[i] = Math.max(0, Math.min(tf[i], maxTf));
  }
  const starts = cuts.map((c, i) => (i === 0 ? 0 : c.cutFrame - Math.floor(tf[i] / 2)));
  return cuts.map((_, i) => {
    const end = i + 1 < n ? starts[i + 1] + tf[i + 1] : totalFrames;
    return { from: starts[i], durationInFrames: Math.max(1, end - starts[i]), transitionFrames: tf[i] };
  });
}

/** Total length of a TransitionSeries = sum(durations) - sum(transitions). */
export function seriesLength(layout: Array<{ durationInFrames: number; transitionFrames: number }>): number {
  return layout.reduce((s, l) => s + l.durationInFrames, 0) - layout.reduce((s, l) => s + l.transitionFrames, 0);
}
