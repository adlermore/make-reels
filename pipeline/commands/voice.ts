import { LAYOUT, pp, relPosix, projectDir } from '../lib/paths.js';
import { exists, sha256, sha256File, writeJson } from '../lib/io.js';
import { ffmpeg, mediaDuration } from '../lib/ffmpeg.js';
import { log } from '../lib/log.js';
import { getStage, setStage, invalidateAfter, registerAsset, recordJob, recordCost, exportAssets } from '../lib/db.js';
import { loadBrand, loadBrief, loadScript, loadShotList, assertProject, TAIL_SEC } from '../lib/project.js';
import { pickVoiceEngine, mapWords } from '../providers/voice/engines.js';
import type { SceneSpeech, SpeechRequest } from '../providers/interfaces.js';
import { VoiceTimingSchema, type VoiceTiming, type Word } from '../../src/types/schemas.js';
import { requireApproval } from './admin.js';

const LEAD_IN_SEC = 0.35;

/**
 * Voiceover (audio-first): synthesise per scene, fit pacing to the brief's duration,
 * assemble one 48 kHz track and export exact per-word timing for captions + scene cuts.
 */
export async function voice(id: string, opts: { engine?: string; force?: boolean; noFit?: boolean } = {}) {
  assertProject(id);
  requireApproval(id, 'approval-a', 'voice');
  const brand = loadBrand(id), brief = loadBrief(id), script = loadScript(id);
  const shots = exists(pp(id, LAYOUT.shotList)) ? loadShotList(id) : null;
  const FIT_POLICY = 'pace-v2'; // bump when the fitting logic changes so cached voice is invalidated
  const inputHash = sha256(FIT_POLICY, script.scenes.map((s) => [s.sceneId, s.narration, s.pronunciation]), brand.voice, opts.engine ?? '', brief.durationSec);
  const prev = getStage(id, 'voice');
  if (!opts.force && (prev?.status === 'done' || prev?.status === 'stale') && prev.input_hash === inputHash && exists(pp(id, LAYOUT.voiceTiming))) {
    setStage(id, 'voice', 'done', { inputHash });
    log.ok('voice is up to date (same script + voice settings) — reusing approved audio');
    return;
  }
  log.step(`Voiceover for ${id}`);
  setStage(id, 'voice', 'running', { inputHash });
  const t0 = Date.now();
  try {
    const engine = await pickVoiceEngine(brand, opts.engine, pp(id, `${LAYOUT.voiceDir}/recorded`), brief.language);
    log.info(`engine: ${engine.id} · voice: ${engine.voice}`);
    const reqs: SpeechRequest[] = script.scenes.filter((s) => s.narration.trim()).map((s) => ({ sceneId: s.sceneId, ttsText: (s.pronunciation || s.narration).trim(), displayText: s.narration.trim() }));
    const outDir = pp(id, LAYOUT.voiceDir);
    const silentDur = (sid: string) => shots?.shots.find((x) => x.sceneId === sid)?.plannedDurationSec ?? 1.5;
    const pauses = brand.voice.scenePauseSec * Math.max(0, script.scenes.length - 1);
    const silentTotal = script.scenes.filter((s) => !s.narration.trim()).reduce((n, s) => n + silentDur(s.sceneId), 0);
    const fixed = LEAD_IN_SEC + pauses + silentTotal + TAIL_SEC;

    let ls = brand.voice.lengthScale;
    let res: SceneSpeech[] = await engine.synthesize(reqs, outDir, { lengthScale: ls });
    let speech = res.reduce((n, r) => n + r.durationSec, 0);
    const target = brief.durationSec;
    const deviation = (fixed + speech) / target - 1;
    log.info(`speech ${speech.toFixed(2)}s + structure ${fixed.toFixed(2)}s = ${(fixed + speech).toFixed(2)}s vs target ${target}s (${(deviation * 100).toFixed(1)}%)`);
    // Piper's length_scale stretches phonemes but not pauses, so the response is non-linear:
    // iterate (max 3 re-synths) until within ±3% of the target or the speed limit (0.88–1.06) is hit.
    if (engine.id === 'piper' && !opts.noFit) {
      for (let iter = 0; iter < 3; iter++) {
        const dev = (fixed + speech) / target - 1;
        if (Math.abs(dev) <= 0.03) break;
        const wanted = ls * ((target - fixed) / speech);
        // Never drag the voice: slowing beyond natural pace (1.06) sounds worse than a slightly shorter reel.
        const clamped = Math.max(0.88, Math.min(1.06, wanted));
        if (clamped === ls) { log.warn(`speed limit reached (lengthScale ${ls}) — script is ${(dev * 100).toFixed(0)}% off; edit the script for an exact fit`); break; }
        if (clamped !== wanted) log.warn(`script length is off by ${(dev * 100).toFixed(0)}% — speed limited to lengthScale ${clamped.toFixed(3)}; consider editing the script`);
        ls = Number(clamped.toFixed(3));
        log.info(`re-synthesising with lengthScale ${ls} (pass ${iter + 1})`);
        res = await engine.synthesize(reqs, outDir, { lengthScale: ls });
        speech = res.reduce((n, r) => n + r.durationSec, 0);
      }
    }

    // timeline of the voice track
    const byId = new Map(res.map((r) => [r.sceneId, r]));
    let t = LEAD_IN_SEC;
    const scenes: VoiceTiming['scenes'] = [];
    const words: Word[] = [];
    script.scenes.forEach((s, i) => {
      const r = byId.get(s.sceneId);
      if (i > 0) t += brand.voice.scenePauseSec;
      if (r) {
        for (const w of mapWords(s.narration, r.segments)) words.push({ text: w.text, startMs: Math.round((t + w.start) * 1000), endMs: Math.round((t + w.end) * 1000) });
        scenes.push({ sceneId: s.sceneId, startSec: t, endSec: t + r.durationSec, file: relPosix(projectDir(id), r.file) });
        t += r.durationSec;
      } else {
        scenes.push({ sceneId: s.sceneId, startSec: t, endSec: t + silentDur(s.sceneId), file: null });
        t += silentDur(s.sceneId);
      }
    });
    const totalSec = t;

    // assemble: silent base + each scene delayed to its slot
    const voicePath = pp(id, LAYOUT.voiceTrack);
    const inputs: string[] = ['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono:d=${(totalSec + TAIL_SEC).toFixed(3)}`];
    const filters: string[] = [];
    const labels: string[] = ['[0:a]'];
    scenes.filter((s) => s.file).forEach((s, k) => {
      inputs.push('-i', pp(id, s.file!));
      filters.push(`[${k + 1}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.round(s.startSec * 1000)}:all=1[v${k}]`);
      labels.push(`[v${k}]`);
    });
    filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first[out]`);
    await ffmpeg([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', voicePath]);

    const vt: VoiceTiming = VoiceTimingSchema.parse({ engine: engine.id, voice: engine.voice, totalSec, leadInSec: LEAD_IN_SEC, scenes, words });
    writeJson(pp(id, LAYOUT.voiceTiming), { ...vt, lengthScale: ls, exactWordTiming: res.every((r) => r.exactTiming) });

    const license = engine.id === 'piper'
      ? engine.voice.startsWith('hy_AM-gor')
        ? `Piper TTS engine (GPL-3.0) · voice ${engine.voice}: dataset GPL-2.0 (davit312/piper-TTS-Armenian), base en_US-bryce (public domain) — no research-only restriction found, see docs/SETUP.md`
        : `Piper TTS engine (GPL-3.0) · voice ${engine.voice}: fine-tuned from en_US-lessac (Blizzard 2013 research licence) — commercial use NOT cleared, see docs/SETUP.md`
      : engine.id === 'recorded' ? 'user-recorded narration (rights held by the user)' : 'Windows SAPI built-in voice (Microsoft) — check Microsoft terms for commercial use';
    for (const s of scenes.filter((x) => x.file)) {
      registerAsset({ assetId: `${id}:voice:${s.sceneId}`, projectId: id, sceneId: s.sceneId, kind: 'voice-scene', path: s.file!, provider: engine.id, model: engine.voice, prompt: script.scenes.find((x) => x.sceneId === s.sceneId)!.narration, durationSec: s.endSec - s.startSec, width: null, height: null, status: 'draft', license, costUsd: 0, sha256: sha256File(pp(id, s.file!)) });
    }
    const dur = await mediaDuration(voicePath);
    registerAsset({ assetId: `${id}:voiceover`, projectId: id, sceneId: null, kind: 'voiceover', path: LAYOUT.voiceTrack, provider: engine.id, model: engine.voice, prompt: '', durationSec: dur, width: null, height: null, status: 'draft', license, costUsd: 0, sha256: sha256File(voicePath) });
    recordCost(id, { provider: engine.id, model: engine.voice, operation: 'tts', units: reqs.reduce((n, r) => n + r.ttsText.length, 0), unit: 'characters', estimateUsd: 0, actualUsd: 0, assetId: `${id}:voiceover` });
    exportAssets(id);

    if (prev?.status === 'done') invalidateAfter(id, 'voice');
    setStage(id, 'voice', 'done', { inputHash, output: LAYOUT.voiceTrack });
    recordJob(id, 'voice', engine.id, 'synthesize', 'ok', `${reqs.length} scenes, ${words.length} words, ${totalSec.toFixed(2)}s`, Date.now() - t0);
    for (const s of scenes) log.info(`${s.sceneId}: ${s.startSec.toFixed(2)}–${s.endSec.toFixed(2)}s${s.file ? '' : ' (silent)'}`);
    log.ok(`voiceover ${totalSec.toFixed(2)}s + tail ${TAIL_SEC}s → final length ≈ ${(totalSec + TAIL_SEC).toFixed(1)}s (target ${target}s) · ${words.length} timed words (${res.every((r) => r.exactTiming) ? 'exact alignment' : 'estimated'})`);
  } catch (e) {
    setStage(id, 'voice', 'failed', { error: (e as Error).message });
    recordJob(id, 'voice', opts.engine ?? brand.voice.engine, 'synthesize', 'error', (e as Error).message, Date.now() - t0);
    throw e;
  }
}

