import { LAYOUT, pp } from '../lib/paths.js';
import { exists, sha256, writeJson } from '../lib/io.js';
import { log, PipelineError } from '../lib/log.js';
import { setStage } from '../lib/db.js';
import { loadBrand, loadBrief, loadShotList, loadVoiceTiming, sceneWindows, safeZoneOf, assertProject } from '../lib/project.js';
import { ProductionStandards, TimelineSchema, type Timeline, type TimelineScene } from '../../src/types/schemas.js';
import { sequenceLayout, seriesLength } from '../../src/utils/timing.js';

/** Build timeline.json (Remotion input props) from storyboard + REAL voice timing + brand snapshot. */
export async function buildTimeline(id: string): Promise<Timeline> {
  assertProject(id);
  log.step(`Timeline for ${id}`);
  const brand = loadBrand(id);
  const shots = loadShotList(id).shots;
  const vt = loadVoiceTiming(id);
  const { windows, totalSec } = sceneWindows(vt, brand.motion.transitionFrames / ProductionStandards.fps);
  const fps = ProductionStandards.fps;
  if (shots.map((s) => s.sceneId).join() !== windows.map((w) => w.sceneId).join()) {
    throw new PipelineError('shot-list scenes do not match voice timing scenes', 'Re-run: npm run reel -- voice <id> --force');
  }
  // missing asset detection
  const missing: string[] = [];
  for (const s of shots) {
    for (const f of [s.background.source !== 'motion' ? s.background.path : '', s.illustration].filter(Boolean)) if (!exists(pp(id, f))) missing.push(`${s.sceneId}: ${f}`);
  }
  if (missing.length) throw new PipelineError(`Missing assets:\n  ${missing.join('\n  ')}`);

  const totalFrames = Math.round(totalSec * fps);
  const cuts = shots.map((s, i) => ({ cutFrame: Math.round(windows[i].startSec * fps), transitionFrames: s.transitionIn === 'none' ? 0 : brand.motion.transitionFrames }));
  const layout = sequenceLayout(cuts, totalFrames);
  const len = seriesLength(layout);
  if (len !== totalFrames) throw new PipelineError(`internal: transition layout length ${len} ≠ ${totalFrames}`);

  const scenes: TimelineScene[] = shots.map((s, i) => {
    const src = s.background.source;
    return {
      sceneId: s.sceneId,
      sceneIndex: i,
      from: layout[i].from,
      cutFrame: cuts[i].cutFrame,
      durationInFrames: layout[i].durationInFrames,
      transitionFrames: layout[i].transitionFrames,
      transitionIn: i === 0 ? 'none' : s.transitionIn,
      layout: s.layout,
      background: {
        type: src === 'local-video' ? 'video' : src === 'local-image' ? 'image' : 'motion',
        src: src === 'local-video' || src === 'local-image' ? s.background.path : '',
        motionPreset: s.background.motionPreset,
        kenBurns: s.background.kenBurns,
        dim: s.background.dim,
      },
      illustration: s.illustration || (src === 'illustration' ? s.background.path : ''),
      headline: s.text.headline,
      subline: s.text.subline,
      items: s.text.items,
      stat: s.text.stat ? { value: s.text.stat.value, prefix: s.text.stat.prefix, suffix: s.text.stat.suffix, label: s.text.stat.label, decimals: s.text.stat.decimals } : undefined,
      keywords: s.text.keywords,
      source: s.text.source,
    };
  });

  const logoFile = brand.logo ? `brand/${brand.logo.split('/').pop()}` : '';
  const timeline = TimelineSchema.parse({
    version: 1,
    projectId: id,
    fps,
    width: ProductionStandards.width,
    height: ProductionStandards.height,
    durationInFrames: totalFrames,
    brand,
    logoSrc: logoFile && exists(pp(id, logoFile)) ? logoFile : '',
    safeZone: safeZoneOf(brand),
    scenes,
    captions: { enabled: brand.captions.enabled, words: vt.words },
    audio: {
      mix: exists(pp(id, LAYOUT.mixFull)) ? LAYOUT.mixFull : '',
      voice: LAYOUT.voiceTrack,
      music: exists(pp(id, LAYOUT.music)) ? LAYOUT.music : '',
      musicGainDb: brand.music.bedGainDb,
    },
    language: loadBrief(id).language,
    mode: 'final',
  });
  writeJson(pp(id, LAYOUT.timeline), timeline);
  setStage(id, 'timeline', 'done', { inputHash: sha256(timeline), output: LAYOUT.timeline });
  log.ok(`${scenes.length} scenes · ${totalFrames} frames (${(totalFrames / fps).toFixed(2)}s) · ${vt.words.length} caption words · audio: ${timeline.audio.mix ? 'mix' : 'voice+music'}`);
  return timeline;
}
