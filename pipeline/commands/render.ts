import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { LAYOUT, pp, projectDir, ROOT } from '../lib/paths.js';
import { ensureDir, exists, readJson, sha256File, writeText } from '../lib/io.js';
import { ffmpeg } from '../lib/ffmpeg.js';
import { log, PipelineError } from '../lib/log.js';
import { setStage, registerAsset, recordJob, exportAssets } from '../lib/db.js';
import { assertProject, loadBrand, safeZoneOf } from '../lib/project.js';
import { TimelineSchema, ProductionStandards, type Timeline } from '../../src/types/schemas.js';
import { paginateWords, pagesToSrt } from '../../src/utils/captions.js';
import { requireApproval } from './admin.js';

const bundles = new Map<string, string>();

async function serveUrlFor(id: string): Promise<string> {
  const hit = bundles.get(id);
  if (hit) return hit;
  log.info('bundling Remotion project…');
  const url = await bundle({
    entryPoint: path.join(ROOT, 'src', 'index.ts'),
    publicDir: projectDir(id), // project folder is the static root → staticFile('audio/…') works
    outDir: path.join(os.tmpdir(), `make-reels-bundle-${id}`),
    onProgress: () => undefined,
  });
  bundles.set(id, url);
  return url;
}

function loadTimeline(id: string, mode: Timeline['mode']): Timeline {
  if (!exists(pp(id, LAYOUT.timeline))) throw new PipelineError('timeline.json missing', `Run: npm run reel -- timeline ${id}`);
  return { ...readJson(pp(id, LAYOUT.timeline), TimelineSchema), mode };
}

const concurrency = Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2)));

export async function renderVideo(id: string, mode: 'preview' | 'final') {
  assertProject(id);
  if (mode === 'final') requireApproval(id, 'approval-c', 'final render');
  const stage = mode;
  const timeline = loadTimeline(id, mode);
  const out = pp(id, mode === 'preview' ? LAYOUT.preview : LAYOUT.final);
  ensureDir(path.dirname(out));
  log.step(`Render ${mode} → ${path.relative(ROOT, out)}`);
  setStage(id, stage, 'running');
  const t0 = Date.now();
  try {
    const serveUrl = await serveUrlFor(id);
    const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: timeline });
    let last = -1;
    await renderMedia({
      composition, serveUrl, inputProps: timeline, outputLocation: out,
      codec: 'h264', pixelFormat: 'yuv420p', colorSpace: 'bt709', audioCodec: 'aac', audioBitrate: '320k', enforceAudioTrack: true,
      crf: mode === 'final' ? ProductionStandards.crf : 26,
      scale: mode === 'preview' ? 0.5 : 1,
      imageFormat: 'jpeg', jpegQuality: mode === 'final' ? 95 : 80,
      concurrency,
      overwrite: true,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 10) * 10;
        if (pct !== last) { last = pct; process.stdout.write(`  ${pct}%`); }
      },
    });
    process.stdout.write('\n');
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    registerAsset({ assetId: `${id}:${mode}`, projectId: id, sceneId: null, kind: 'render', path: mode === 'preview' ? LAYOUT.preview : LAYOUT.final, provider: 'remotion', model: 'Reel', prompt: '', durationSec: timeline.durationInFrames / timeline.fps, width: mode === 'preview' ? timeline.width / 2 : timeline.width, height: mode === 'preview' ? timeline.height / 2 : timeline.height, status: 'draft', license: 'project output', costUsd: 0, sha256: sha256File(out) });
    if (mode === 'final') await finalExtras(id, timeline);
    exportAssets(id);
    setStage(id, stage, 'done', { output: path.relative(projectDir(id), out) });
    recordJob(id, stage, 'remotion', 'renderMedia', 'ok', `${timeline.durationInFrames} frames`, Date.now() - t0);
    log.ok(`${mode} rendered in ${secs}s`);
  } catch (e) {
    setStage(id, stage, 'failed', { error: (e as Error).message });
    recordJob(id, stage, 'remotion', 'renderMedia', 'error', (e as Error).message, Date.now() - t0);
    throw e;
  }
}

/** final-no-music.mp4, poster.png, subtitles.srt */
async function finalExtras(id: string, timeline: Timeline) {
  if (exists(pp(id, LAYOUT.mixNoMusic))) {
    await ffmpeg(['-i', pp(id, LAYOUT.final), '-i', pp(id, LAYOUT.mixNoMusic), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', pp(id, LAYOUT.finalNoMusic)]);
    registerAsset({ assetId: `${id}:final-no-music`, projectId: id, sceneId: null, kind: 'render', path: LAYOUT.finalNoMusic, provider: 'ffmpeg', model: 'remux', prompt: '', durationSec: timeline.durationInFrames / timeline.fps, width: timeline.width, height: timeline.height, status: 'draft', license: 'project output', costUsd: 0, sha256: sha256File(pp(id, LAYOUT.finalNoMusic)) });
    log.ok('final-no-music.mp4 (voice + SFX only — add a trending sound in the Instagram app)');
  }
  await renderPoster(id, timeline);
  const pages = paginateWords(timeline.captions.words, { maxWords: Math.max(5, timeline.brand.captions.maxWordsPerPage), cutsMs: timeline.scenes.map((s) => (s.cutFrame / timeline.fps) * 1000) });
  writeText(pp(id, LAYOUT.srt), pagesToSrt(pages));
  registerAsset({ assetId: `${id}:srt`, projectId: id, sceneId: null, kind: 'subtitles', path: LAYOUT.srt, provider: 'make-reels', model: 'paginate', prompt: '', durationSec: null, width: null, height: null, status: 'draft', license: 'project output', costUsd: 0, sha256: sha256File(pp(id, LAYOUT.srt)) });
  log.ok(`subtitles.srt (${pages.length} cues)`);
}

export async function renderPoster(id: string, timeline?: Timeline) {
  const t = timeline ? { ...timeline, mode: 'poster' as const } : loadTimeline(id, 'poster');
  const shotListPoster = (JSON.parse(fs.readFileSync(pp(id, LAYOUT.shotList), 'utf8')) as { posterSceneId?: string }).posterSceneId ?? 's01';
  const scene = t.scenes.find((s) => s.sceneId === shotListPoster) ?? t.scenes[0];
  const frame = Math.min(t.durationInFrames - 1, scene.cutFrame + Math.min(scene.durationInFrames - 1, Math.round(Math.max(45, scene.durationInFrames * 0.6))));
  const serveUrl = await serveUrlFor(id);
  const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: t });
  await renderStill({ composition, serveUrl, inputProps: t, frame, output: pp(id, LAYOUT.poster), imageFormat: 'png', overwrite: true });
  registerAsset({ assetId: `${id}:poster`, projectId: id, sceneId: scene.sceneId, kind: 'poster', path: LAYOUT.poster, provider: 'remotion', model: 'renderStill', prompt: `frame ${frame}`, durationSec: null, width: t.width, height: t.height, status: 'draft', license: 'project output', costUsd: 0, sha256: sha256File(pp(id, LAYOUT.poster)) });
  log.ok(`poster.png (scene ${scene.sceneId}, frame ${frame}) — key content kept inside the central 3:4 area for the profile grid`);
}

/** Render every SVG in assets/illustrations as the engine draws it (fully drawn + mid-draw) → reports/illustrations/. */
export async function illustrationPreviews(id: string) {
  assertProject(id);
  const dir = pp(id, LAYOUT.illustrations);
  const svgs = exists(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.svg')) : [];
  if (!svgs.length) return log.warn(`no SVG files in ${LAYOUT.illustrations}`);
  log.step(`Illustration previews for ${id}`);
  const brand = loadBrand(id);
  const out = pp(id, 'reports/illustrations');
  ensureDir(out);
  const serveUrl = await serveUrlFor(id);
  const files: string[] = [];
  for (const f of svgs) {
    const inputProps = { src: `${LAYOUT.illustrations}/${f}`, brand, safeZone: safeZoneOf(brand) };
    const composition = await selectComposition({ serveUrl, id: 'IllustrationPreview', inputProps });
    for (const [tag, frame] of [['mid', 20], ['final', 89]] as const) {
      const file = path.join(out, `${f.replace(/\.svg$/, '')}-${tag}.png`);
      await renderStill({ composition, serveUrl, inputProps, frame, output: file, imageFormat: 'png', overwrite: true });
      files.push(file);
    }
  }
  log.ok(`${files.length} previews → reports/illustrations/ (…-mid.png = drawing in progress, …-final.png = finished)`);
}

/** Animatic stills for Stage B approval: one frame per scene + contact sheet. */
export async function storyboardFrames(id: string) {
  assertProject(id);
  const t = loadTimeline(id, 'poster');
  log.step(`Storyboard frames for ${id}`);
  const dir = pp(id, LAYOUT.storyboardFrames);
  ensureDir(dir);
  const serveUrl = await serveUrlFor(id);
  const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: t });
  const files: string[] = [];
  for (const s of t.scenes) {
    const local = Math.min(s.durationInFrames - 1, Math.max(Math.round(s.durationInFrames * 0.65), 40));
    const frame = Math.min(t.durationInFrames - 1, s.from + local);
    const file = path.join(dir, `${s.sceneId}.png`);
    await renderStill({ composition, serveUrl, inputProps: { ...t, mode: 'final' }, frame, output: file, imageFormat: 'png', overwrite: true, scale: 0.5 });
    files.push(file);
  }
  const cols = Math.min(files.length, 5), rows = Math.ceil(files.length / cols);
  const inputs = files.flatMap((f) => ['-i', f]);
  const pads = files.map((_, i) => `[${i}:v]scale=360:640,pad=376:656:8:8:color=0x111111[f${i}]`);
  const blanks = cols * rows - files.length;
  const blankInputs = blanks > 0 ? ['-f', 'lavfi', '-i', `color=c=0x111111:s=376x656:d=1`] : [];
  const blankLabels = Array.from({ length: blanks }, (_, k) => `[b${k}]`);
  const blankSplit = blanks > 0 ? [`[${files.length}:v]split=${blanks}${blankLabels.join('')}`] : [];
  const all = [...files.map((_, i) => `[f${i}]`), ...blankLabels].join('');
  await ffmpeg([...inputs, ...blankInputs, '-filter_complex', [...pads, ...blankSplit, `${all}xstack=inputs=${cols * rows}:layout=${Array.from({ length: cols * rows }, (_, i) => `${(i % cols) * 376}_${Math.floor(i / cols) * 656}`).join('|')}[out]`].join(';'), '-map', '[out]', '-frames:v', '1', pp(id, LAYOUT.storyboardSheet)]);
  setStage(id, 'storyboard-frames', 'done', { output: LAYOUT.storyboardSheet });
  log.ok(`${files.length} frames → ${LAYOUT.storyboardSheet}`);
}
