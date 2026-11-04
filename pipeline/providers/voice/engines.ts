import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../../lib/proc.js';
import { PIPER_VOICES_DIR, VENV_PYTHON, ROOT } from '../../lib/paths.js';
import { ffmpeg as ffmpegRun, ffmpegAnalyze, mediaDuration } from '../../lib/ffmpeg.js';
import { ensureDir, writeJson } from '../../lib/io.js';
import { log, PipelineError } from '../../lib/log.js';
import type { BrandConfig } from '../../../src/types/schemas.js';
import type { SceneSpeech, SpeechRequest, VoiceEngine } from '../interfaces.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Piper: offline neural TTS with phoneme alignments → exact word timing. Primary engine. */
export class PiperEngine implements VoiceEngine {
  readonly id = 'piper' as const;
  constructor(readonly voice: string) {}

  get modelPath() { return path.join(PIPER_VOICES_DIR, `${this.voice}.onnx`); }

  async check(): Promise<string | null> {
    if (!fs.existsSync(VENV_PYTHON)) return 'Python venv not found (.venv). Run: npm run setup:voice';
    if (!fs.existsSync(this.modelPath)) return `Piper voice model missing: ${this.modelPath}. Run: npm run setup:voice -- ${this.voice}`;
    const r = await run(VENV_PYTHON, ['-c', 'import piper, onnx; print("ok")'], { allowFail: true, timeoutMs: 60_000 });
    if (r.code !== 0) return 'piper-tts[alignment] not installed in .venv. Run: npm run setup:voice';
    return null;
  }

  async synthesize(reqs: SpeechRequest[], outDir: string, opts: { lengthScale: number }): Promise<SceneSpeech[]> {
    ensureDir(outDir);
    const jobFile = path.join(outDir, 'piper-job.json');
    writeJson(jobFile, {
      model: this.modelPath,
      lengthScale: opts.lengthScale,
      scenes: reqs.map((r) => ({ sceneId: r.sceneId, text: r.ttsText, out: path.join(outDir, `${r.sceneId}.raw.wav`) })),
    });
    const res = await run(VENV_PYTHON, [path.join(HERE, 'piper_tts.py'), jobFile], { cwd: ROOT, timeoutMs: 10 * 60_000 });
    const out = JSON.parse(res.stdout) as { scenes: Array<{ sceneId: string; out: string; durationSec: number; segments: { start: number; end: number }[]; alignments: boolean }> };
    return out.scenes.map((s) => ({ sceneId: s.sceneId, file: s.out, durationSec: s.durationSec, segments: s.segments, exactTiming: s.alignments }));
  }
}

/** Windows SAPI: built-in fallback. Word timing is estimated from the detected speech span. */
export class SapiEngine implements VoiceEngine {
  readonly id = 'windows-sapi' as const;
  constructor(readonly voice: string, private rate: number) {}

  async check(): Promise<string | null> {
    if (process.platform !== 'win32') return 'Windows SAPI is only available on Windows';
    return null;
  }

  async synthesize(reqs: SpeechRequest[], outDir: string): Promise<SceneSpeech[]> {
    ensureDir(outDir);
    const jobFile = path.join(outDir, 'sapi-job.json');
    writeJson(jobFile, { voice: this.voice, rate: this.rate, scenes: reqs.map((r) => ({ sceneId: r.sceneId, text: r.ttsText, out: path.join(outDir, `${r.sceneId}.raw.wav`) })) });
    await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, 'sapi_tts.ps1'), '-JobFile', jobFile], { timeoutMs: 10 * 60_000 });
    const result: SceneSpeech[] = [];
    for (const r of reqs) {
      const file = path.join(outDir, `${r.sceneId}.raw.wav`);
      const dur = await mediaDuration(file);
      const span = await speechSpan(file, dur);
      result.push({ sceneId: r.sceneId, file, durationSec: dur, segments: [span], exactTiming: false });
    }
    return result;
  }
}

/**
 * Recorded: the user's own voice — cleanest rights. One file per narrated scene in
 * projects/<id>/audio/voice/recorded/<sceneId>.(wav|mp3|m4a). Word timing is estimated from the speech span.
 */
export class RecordedEngine implements VoiceEngine {
  readonly id = 'recorded' as const;
  readonly voice = 'user recording';
  constructor(private recordedDir: string) {}
  async check(): Promise<string | null> {
    return fs.existsSync(this.recordedDir) ? null : `put one recording per scene into ${this.recordedDir} (s01.wav, s02.wav…)`;
  }
  async synthesize(reqs: SpeechRequest[], outDir: string): Promise<SceneSpeech[]> {
    ensureDir(outDir);
    const out: SceneSpeech[] = [];
    for (const r of reqs) {
      const src = ['wav', 'mp3', 'm4a', 'flac', 'ogg'].map((e) => path.join(this.recordedDir, `${r.sceneId}.${e}`)).find((f) => fs.existsSync(f));
      if (!src) throw new PipelineError(`recording missing for ${r.sceneId}`, `record "${r.displayText}" and save it as ${path.join(this.recordedDir, r.sceneId + '.wav')}`);
      const file = path.join(outDir, `${r.sceneId}.raw.wav`);
      // trim leading/trailing silence, normalise to 48 kHz mono
      await ffmpegRun(['-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse', '-ar', '48000', '-ac', '1', file]);
      const dur = await mediaDuration(file);
      out.push({ sceneId: r.sceneId, file, durationSec: dur, segments: [await speechSpan(file, dur)], exactTiming: false });
    }
    return out;
  }
}

/** First/last non-silent moment of a file (silencedetect). */
export async function speechSpan(file: string, dur: number): Promise<{ start: number; end: number }> {
  const err = await ffmpegAnalyze(file, ['-af', 'silencedetect=n=-40dB:d=0.06']);
  let start = 0, end = dur;
  const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  if (starts[0] === 0 && ends[0] !== undefined) start = ends[0];
  const lastStart = starts[starts.length - 1];
  if (lastStart !== undefined && lastStart > start && (ends.length < starts.length || Math.abs(ends[ends.length - 1] - dur) < 0.05)) end = lastStart;
  return { start, end };
}

/** Piper voice for a language: brand.voice.piperVoiceByLanguage[lang] → brand.voice.piperVoice. */
export const piperVoiceFor = (brand: BrandConfig, language: string) => brand.voice.piperVoiceByLanguage[language] ?? brand.voice.piperVoice;

export async function pickVoiceEngine(brand: BrandConfig, override?: string, recordedDir?: string, language = 'hy'): Promise<VoiceEngine> {
  const want = override ?? brand.voice.engine;
  if (want === 'recorded') {
    const rec = new RecordedEngine(recordedDir ?? '');
    const problem = await rec.check();
    if (problem) throw new PipelineError(problem);
    return rec;
  }
  if (want === 'piper') {
    const piper = new PiperEngine(piperVoiceFor(brand, language));
    const problem = await piper.check();
    if (!problem) return piper;
    if (override) throw new PipelineError(problem);
    log.warn(`Piper unavailable (${problem}). Falling back to Windows SAPI — captions timing will be estimated.`);
  }
  if (language === 'hy') throw new PipelineError('No offline Armenian voice available: Piper hy_AM voice is not installed and Windows has no Armenian SAPI voice.', 'Run: npm run setup:voice -- hy_AM-gor-medium   (or set voice.engine = "recorded" and record the narration)');
  const sapi = new SapiEngine(brand.voice.sapiVoice, brand.voice.sapiRate);
  const problem = await sapi.check();
  if (problem) throw new PipelineError(`No voice engine available: ${problem}`, 'Run npm run setup:voice');
  return sapi;
}

// ───────────── word timing mapping ─────────────

export interface TimedWord { text: string; start: number; end: number }

/**
 * Map display words (captions) onto engine segments.
 * Equal counts → 1:1 (exact). Otherwise distribute by character weight across the speech span
 * and snap boundaries to the nearest real segment boundary within 0.25 s.
 */
export function mapWords(displayText: string, segments: { start: number; end: number }[]): TimedWord[] {
  const words = displayText.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!words.length || !segments.length) return [];
  if (words.length === segments.length) return words.map((w, i) => ({ text: w, start: segments[i].start, end: segments[i].end }));

  const spanStart = segments[0].start, spanEnd = segments[segments.length - 1].end;
  const weights = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5);
  const total = weights.reduce((a, b) => a + b, 0);
  const bounds = segments.flatMap((s) => [s.start, s.end]);
  const snap = (t: number) => {
    let best = t, dist = 0.25;
    for (const b of bounds) if (Math.abs(b - t) < dist) { dist = Math.abs(b - t); best = b; }
    return best;
  };
  const out: TimedWord[] = [];
  let acc = 0, prevEnd = spanStart;
  words.forEach((w, i) => {
    const s = i === 0 ? spanStart : Math.max(prevEnd, snap(spanStart + (acc / total) * (spanEnd - spanStart)));
    acc += weights[i];
    const e = i === words.length - 1 ? spanEnd : Math.max(s + 0.06, snap(spanStart + (acc / total) * (spanEnd - spanStart)));
    out.push({ text: w, start: s, end: e });
    prevEnd = e;
  });
  return out;
}
