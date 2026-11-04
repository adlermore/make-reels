import fs from 'node:fs';
import path from 'node:path';
import { LAYOUT, pp, PUBLIC_DIR } from '../lib/paths.js';
import { exists, readText, sha256, sha256File, writeJson, ensureDir } from '../lib/io.js';
import { ffmpeg, ffmpegAnalyze } from '../lib/ffmpeg.js';
import { log, PipelineError } from '../lib/log.js';
import { getStage, setStage, registerAsset, recordJob, exportAssets, invalidateAfter } from '../lib/db.js';
import { loadBrand, loadShotList, loadVoiceTiming, sceneWindows, assertProject } from '../lib/project.js';
import { generateMusic } from '../audio/music.js';
import { synthSfx, synthAmbient } from '../audio/sfx.js';
import { writeWav } from '../audio/dsp.js';
import { ProductionStandards, type SfxCue } from '../../src/types/schemas.js';

const seedOf = (s: string) => parseInt(sha256(s).slice(0, 8), 16);

// ───────────────────────────── music ─────────────────────────────
export async function music(id: string, opts: { force?: boolean; preset?: string } = {}) {
  assertProject(id);
  const brand = loadBrand(id);
  const { totalSec } = sceneWindows(loadVoiceTiming(id), brand.motion.transitionFrames / 30);
  const preset = (opts.preset ?? brand.music.preset) as typeof brand.music.preset;
  const hash = sha256(preset, brand.music, totalSec.toFixed(2));
  const prev = getStage(id, 'music');
  if (!opts.force && (prev?.status === 'done' || prev?.status === 'stale') && prev.input_hash === hash && exists(pp(id, LAYOUT.music))) { setStage(id, 'music', 'done', { inputHash: hash }); return log.ok('music up to date'); }
  log.step(`Music for ${id}`);
  setStage(id, 'music', 'running', { inputHash: hash });
  const out = pp(id, LAYOUT.music);
  ensureDir(path.dirname(out));
  let meta: Record<string, unknown>;
  if (brand.music.libraryTrack) {
    // user-supplied track: must have a licence record
    const src = path.join(PUBLIC_DIR, 'music', brand.music.libraryTrack);
    const licFile = path.join(PUBLIC_DIR, 'music', 'licenses.json');
    const lic = exists(licFile) ? (JSON.parse(readText(licFile)) as Record<string, { source: string; license: string; url?: string }>)[brand.music.libraryTrack] : undefined;
    if (!exists(src)) throw new PipelineError(`music track not found: ${src}`);
    if (!lic) throw new PipelineError(`no licence record for ${brand.music.libraryTrack} in public/music/licenses.json — unlicensed music is never used`);
    await ffmpeg(['-i', src, '-t', (totalSec + 0.5).toFixed(2), '-af', `afade=t=out:st=${Math.max(0, totalSec - 2).toFixed(2)}:d=2`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', out]);
    meta = { ...lic, source: 'library', file: brand.music.libraryTrack, origin: lic.source };
  } else {
    const t0 = Date.now();
    const r = generateMusic({ preset, bpm: brand.music.bpm, durationSec: totalSec + 0.5, seed: seedOf(id) });
    writeWav(out, r.channels);
    meta = { source: 'procedural', ...r.meta, renderMs: Date.now() - t0 };
  }
  writeJson(pp(id, LAYOUT.musicMeta), meta);
  registerAsset({ assetId: `${id}:music`, projectId: id, sceneId: null, kind: 'music', path: LAYOUT.music, provider: String(meta.source), model: preset, prompt: brand.music.preset, durationSec: totalSec + 0.5, width: null, height: null, status: 'draft', license: String(meta.license ?? ''), costUsd: 0, sha256: sha256File(out) });
  exportAssets(id);
  if (prev?.status === 'done') invalidateAfter(id, 'music');
  setStage(id, 'music', 'done', { inputHash: hash, output: LAYOUT.music });
  recordJob(id, 'music', String(meta.source), 'generate', 'ok', JSON.stringify(meta).slice(0, 300));
  log.ok(`music: ${meta.source} ${preset} ${(totalSec + 0.5).toFixed(1)}s`);
}

// ───────────────────────────── sfx ─────────────────────────────
interface PlannedCue { sceneId: string; kind: SfxCue['kind']; atSec: number; gainDb: number; file: string; reason: string }

export async function sfx(id: string, opts: { force?: boolean } = {}) {
  assertProject(id);
  const shots = loadShotList(id).shots;
  const vt = loadVoiceTiming(id);
  const { windows, totalSec } = sceneWindows(vt, loadBrand(id).motion.transitionFrames / 30);
  const hash = sha256('sfx-rules-v2', vt.words.length, shots.map((s) => [s.sceneId, s.layout, s.transitionIn, s.sfx]), windows);
  const prev = getStage(id, 'sfx');
  if (!opts.force && (prev?.status === 'done' || prev?.status === 'stale') && prev.input_hash === hash && exists(pp(id, LAYOUT.sfxPlan))) { setStage(id, 'sfx', 'done', { inputHash: hash }); return log.ok('sfx up to date'); }
  log.step(`Sound effects for ${id}`);
  setStage(id, 'sfx', 'running', { inputHash: hash });
  const dir = pp(id, LAYOUT.sfxDir);
  ensureDir(dir);
  const cues: PlannedCue[] = [];
  const add = (c: Omit<PlannedCue, 'file'>) => {
    if (c.atSec < 0 || c.atSec > totalSec) return;
    if (cues.some((x) => x.kind === c.kind && Math.abs(x.atSec - c.atSec) < 0.25)) return; // de-duplicate
    cues.push({ ...c, file: `${LAYOUT.sfxDir}/${c.kind}.wav` });
  };
  shots.forEach((s, i) => {
    const cut = windows[i].startSec;
    if (s.layout === 'hook' || s.layout === 'hook-stat') add({ sceneId: s.sceneId, kind: 'impact', atSec: 0.02, gainDb: -9, reason: 'hook impact' });
    // whoosh only on "special" transitions (wipe/zoom/slide); blur-slide and fade stay quiet
    if (i > 0 && ['wipe', 'zoom', 'slide'].includes(s.transitionIn)) add({ sceneId: s.sceneId, kind: 'whoosh', atSec: cut - 0.36, gainDb: -14, reason: `transition ${s.transitionIn}` });
    if (s.layout === 'list') s.text.items.forEach((_, k) => add({ sceneId: s.sceneId, kind: 'click', atSec: cut + (12 + k * Math.max(8, Math.min(30, Math.floor(((windows[i].endSec - cut) * 30 * 0.6) / Math.max(1, s.text.items.length))))) / 30, gainDb: -16, reason: `list item ${k + 1}` }));
    if (s.layout === 'stat' && shots.findIndex((x) => x.layout === 'stat') === i) add({ sceneId: s.sceneId, kind: 'shimmer', atSec: cut + 1.3, gainDb: -18, reason: 'stat lands' });
    if (s.layout === 'cta') add({ sceneId: s.sceneId, kind: 'pop', atSec: cut + 0.55, gainDb: -12, reason: 'CTA button' });
    for (const c of s.sfx) add({ sceneId: s.sceneId, kind: c.kind, atSec: cut + c.offsetSec, gainDb: c.gainDb, reason: 'storyboard cue' });
  });
  // accent cues must not sit on top of a word: move them into the next gap (<= 0.6 s) or duck them
  for (const c of cues) {
    if (c.kind === 'whoosh' || c.kind === 'impact' || c.kind === 'click') continue;
    const ms = c.atSec * 1000;
    const hit = vt.words.find((w) => ms >= w.startMs - 40 && ms < w.endMs);
    if (!hit) continue;
    const gap = vt.words.find((w, k) => w.endMs >= ms && (vt.words[k + 1]?.startMs ?? Infinity) - w.endMs >= 120);
    if (gap && gap.endMs - ms <= 600) { c.atSec = (gap.endMs + 20) / 1000; c.reason += ' (moved off speech)'; }
    else { c.gainDb -= 4; c.reason += ' (ducked: on speech)'; }
  }
  const kinds = [...new Set(cues.map((c) => c.kind))];
  for (const k of kinds) writeWav(path.join(dir, `${k}.wav`), synthSfx(k, seedOf(`${id}-${k}`)));
  writeWav(path.join(dir, 'ambient.wav'), synthAmbient(totalSec + 0.5, seedOf(`${id}-amb`)));
  cues.sort((a, b) => a.atSec - b.atSec);
  writeJson(pp(id, LAYOUT.sfxPlan), { projectId: id, totalSec, ambient: `${LAYOUT.sfxDir}/ambient.wav`, cues });
  for (const k of [...kinds, 'ambient']) {
    const rel = `${LAYOUT.sfxDir}/${k}.wav`;
    registerAsset({ assetId: `${id}:sfx:${k}`, projectId: id, sceneId: null, kind: 'sfx', path: rel, provider: 'procedural', model: `synth-${k}`, prompt: k, durationSec: null, width: null, height: null, status: 'draft', license: 'Original procedural sound generated locally by make-reels. Free for commercial use.', costUsd: 0, sha256: sha256File(pp(id, rel)) });
  }
  exportAssets(id);
  if (prev?.status === 'done') invalidateAfter(id, 'sfx');
  setStage(id, 'sfx', 'done', { inputHash: hash, output: LAYOUT.sfxPlan });
  log.ok(`${cues.length} cues (${kinds.join(', ')}) + ambient bed`);
}

// ───────────────────────────── mix ─────────────────────────────
export interface LoudnessReport { integratedLufs: number; truePeakDb: number; lra: number }

export async function measureLoudness(file: string): Promise<LoudnessReport> {
  const err = await ffmpegAnalyze(file, ['-af', 'ebur128=peak=true', '-vn']);
  const summary = err.slice(err.lastIndexOf('Summary:'));
  const num = (re: RegExp) => Number((summary.match(re) ?? [])[1]);
  return { integratedLufs: num(/I:\s+(-?[\d.]+) LUFS/), truePeakDb: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/) };
}

async function loudnorm2pass(input: string, output: string) {
  const target = `I=${ProductionStandards.targetLufs}:TP=-1.5:LRA=11`;
  const err = await ffmpegAnalyze(input, ['-af', `loudnorm=${target}:print_format=json`]);
  const json = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1)) as Record<string, string>;
  const measured = `measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}`;
  await ffmpeg(['-i', input, '-af', `loudnorm=${target}:${measured}:linear=true,aresample=48000`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', output]);
}

export async function mix(id: string, opts: { force?: boolean } = {}) {
  assertProject(id);
  const brand = loadBrand(id);
  const { totalSec } = sceneWindows(loadVoiceTiming(id), brand.motion.transitionFrames / 30);
  const plan = JSON.parse(readText(pp(id, LAYOUT.sfxPlan))) as { ambient: string; cues: PlannedCue[] };
  const inputsForHash = [LAYOUT.voiceTrack, LAYOUT.music, LAYOUT.sfxPlan].map((f) => (exists(pp(id, f)) ? sha256File(pp(id, f)) : 'none'));
  const hash = sha256(inputsForHash, brand.music.bedGainDb, totalSec.toFixed(2));
  const prev = getStage(id, 'mix');
  if (!opts.force && (prev?.status === 'done' || prev?.status === 'stale') && prev.input_hash === hash && exists(pp(id, LAYOUT.mixFull))) { setStage(id, 'mix', 'done', { inputHash: hash }); return log.ok('mix up to date'); }
  log.step(`Mix for ${id}`);
  setStage(id, 'mix', 'running', { inputHash: hash });
  const T = totalSec.toFixed(3);
  ensureDir(path.dirname(pp(id, LAYOUT.mixFull)));

  const build = async (withMusic: boolean, out: string) => {
    const args: string[] = ['-i', pp(id, LAYOUT.voiceTrack)];
    const f: string[] = [`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${T},atrim=0:${T},asplit=2[voice][vkey]`];
    const bus: string[] = ['[voice]'];
    let n = 1;
    if (withMusic) {
      args.push('-i', pp(id, LAYOUT.music));
      f.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${brand.music.bedGainDb}dB,apad=whole_dur=${T},atrim=0:${T},afade=t=out:st=${Math.max(0, totalSec - 2.2).toFixed(2)}:d=2.2[mus]`);
      f.push('[mus][vkey]sidechaincompress=threshold=0.025:ratio=5:attack=25:release=420:makeup=1[duck]');
      bus.push('[duck]');
      n++;
    } else f.push('[vkey]anullsink');
    args.push('-i', pp(id, plan.ambient));
    f.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=-32dB,atrim=0:${T}[amb]`);
    bus.push('[amb]');
    n++;
    for (const c of plan.cues) {
      args.push('-i', pp(id, c.file));
      const ms = Math.max(0, Math.round(c.atSec * 1000));
      f.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${c.gainDb}dB,adelay=${ms}|${ms}[c${n}]`);
      bus.push(`[c${n}]`);
      n++;
    }
    f.push(`${bus.join('')}amix=inputs=${bus.length}:normalize=0:duration=first,atrim=0:${T}[pre]`);
    const pre = out.replace(/\.wav$/, '.pre.wav');
    await ffmpeg([...args, '-filter_complex', f.join(';'), '-map', '[pre]', '-ar', '48000', '-c:a', 'pcm_s16le', pre]);
    await loudnorm2pass(pre, out);
    fs.rmSync(pre, { force: true });
    return measureLoudness(out);
  };

  const full = await build(true, pp(id, LAYOUT.mixFull));
  const noMusic = await build(false, pp(id, LAYOUT.mixNoMusic));
  writeJson(pp(id, LAYOUT.mixReport), { target: { lufs: ProductionStandards.targetLufs, truePeakMaxDb: ProductionStandards.maxTruePeakDb }, full, noMusic, durationSec: totalSec, musicBedGainDb: brand.music.bedGainDb, ducking: 'sidechaincompress threshold 0.025 ratio 5 attack 25ms release 420ms' });
  for (const [k, rel] of [['mix-full', LAYOUT.mixFull], ['mix-no-music', LAYOUT.mixNoMusic]] as const) {
    registerAsset({ assetId: `${id}:${k}`, projectId: id, sceneId: null, kind: 'mix', path: rel, provider: 'ffmpeg', model: 'loudnorm-2pass', prompt: '', durationSec: totalSec, width: null, height: null, status: 'draft', license: 'derived from project assets', costUsd: 0, sha256: sha256File(pp(id, rel)) });
  }
  exportAssets(id);
  if (prev?.status === 'done') invalidateAfter(id, 'mix');
  setStage(id, 'mix', 'done', { inputHash: hash, output: LAYOUT.mixFull });
  recordJob(id, 'mix', 'ffmpeg', 'mix+loudnorm', 'ok', JSON.stringify({ full, noMusic }));
  log.ok(`mix-full: ${full.integratedLufs} LUFS, TP ${full.truePeakDb} dB · no-music: ${noMusic.integratedLufs} LUFS`);
}
