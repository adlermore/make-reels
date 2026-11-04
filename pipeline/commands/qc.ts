/**
 * Independent quality control. Automated checks (85 pts) are measured with ffprobe/ffmpeg —
 * never assumed. Perceptual checks (15 pts) come from the quality-controller agent's review of
 * extracted frames (reports/qc-review.json) and are labelled as such. Pass = ≥ 90 and no critical.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LAYOUT, pp, ROOT } from '../lib/paths.js';
import { ensureDir, exists, readJson, readText, sha256File, writeJson, writeText } from '../lib/io.js';
import { ffmpeg, ffmpegAnalyze, ffprobe, fraction } from '../lib/ffmpeg.js';
import { log } from '../lib/log.js';
import { recordQc, setStage } from '../lib/db.js';
import { assertProject } from '../lib/project.js';
import { measureLoudness } from './audio.js';
import { CHECK_LABELS_HY, qcText } from '../lib/report-i18n.js';
import { TimelineSchema, ProductionStandards as PS } from '../../src/types/schemas.js';
const CAPTION_BAND_HEIGHT_PX = PS.captionBandHeight;

type Category = 'technical' | 'audio' | 'visual' | 'content' | 'review';
interface Check { id: string; category: Category; label: string; points: number; score: number; passed: boolean | null; critical: boolean; detail: string; owner: string; method: 'auto' | 'agent-review' }

export const ReviewSchema = z.object({
  reviewer: z.string(),
  file: z.string(),
  renderSha256: z.string(),
  scores: z.object({ visual: z.number().min(0).max(5), motion: z.number().min(0).max(4), content: z.number().min(0).max(3), hook: z.number().min(0).max(3) }),
  issues: z.array(z.object({ severity: z.enum(['critical', 'major', 'minor']), category: z.string(), sceneId: z.string().default(''), description: z.string(), owner: z.string() })).default([]),
  notes: z.string().default(''),
});

function moovBeforeMdat(file: string): boolean | null {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    let pos = 0;
    const h = Buffer.alloc(16);
    while (pos < size) {
      fs.readSync(fd, h, 0, 16, pos);
      let len = h.readUInt32BE(0);
      const type = h.toString('latin1', 4, 8);
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      if (len === 1) len = Number(h.readBigUInt64BE(8));
      if (len < 8) return null;
      pos += len;
    }
    return null;
  } finally { fs.closeSync(fd); }
}

export async function qc(id: string, opts: { target?: 'final' | 'preview' } = {}) {
  assertProject(id);
  const target = opts.target ?? 'final';
  const rel = target === 'final' ? LAYOUT.final : LAYOUT.preview;
  const file = pp(id, rel);
  const timeline = readJson(pp(id, LAYOUT.timeline), TimelineSchema);
  const expW = target === 'final' ? PS.width : PS.width / 2, expH = target === 'final' ? PS.height : PS.height / 2;
  const expDur = timeline.durationInFrames / timeline.fps;
  log.step(`Quality control: ${rel}`);
  const checks: Check[] = [];
  const add = (c: Omit<Check, 'score' | 'method'> & { method?: Check['method'] }) => checks.push({ ...c, method: c.method ?? 'auto', score: c.passed ? c.points : 0 });

  // ───── technical ─────
  if (!exists(file) || fs.statSync(file).size < 10_000) {
    add({ id: 'T1', category: 'technical', label: 'File exists and is readable', points: 3, passed: false, critical: true, detail: `${rel} missing or empty`, owner: 'orchestrator (render)' });
    return finish(id, target, rel, checks, null, timeline.language);
  }
  let probe;
  try { probe = await ffprobe(file); } catch (e) {
    add({ id: 'T1', category: 'technical', label: 'File exists and is readable', points: 3, passed: false, critical: true, detail: (e as Error).message, owner: 'orchestrator (render)' });
    return finish(id, target, rel, checks, null, timeline.language);
  }
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  add({ id: 'T1', category: 'technical', label: 'File exists and is readable', points: 3, passed: !!v, critical: true, detail: `${(fs.statSync(file).size / 1e6).toFixed(1)} MB`, owner: 'orchestrator (render)' });
  add({ id: 'T2', category: 'technical', label: 'Container MP4', points: 2, passed: /mp4/.test(probe.format.format_name), critical: false, detail: probe.format.format_name, owner: 'orchestrator (render)' });
  add({ id: 'T3', category: 'technical', label: 'Video codec H.264', points: 3, passed: v?.codec_name === 'h264', critical: false, detail: `${v?.codec_name} ${v?.profile ?? ''}`, owner: 'orchestrator (render)' });
  add({ id: 'T4', category: 'technical', label: 'Pixel format yuv420p', points: 3, passed: v?.pix_fmt === 'yuv420p', critical: false, detail: String(v?.pix_fmt), owner: 'orchestrator (render)' });
  add({ id: 'T5', category: 'technical', label: `Resolution ${expW}×${expH} (9:16)`, points: 5, passed: v?.width === expW && v?.height === expH, critical: true, detail: `${v?.width}×${v?.height}`, owner: 'motion-designer' });
  const rfr = fraction(v?.r_frame_rate), afr = fraction(v?.avg_frame_rate);
  add({ id: 'T6', category: 'technical', label: '30 fps constant frame rate', points: 4, passed: Math.abs(rfr - PS.fps) < 0.01 && Math.abs(afr - PS.fps) < 0.05, critical: true, detail: `r=${v?.r_frame_rate} avg=${v?.avg_frame_rate}`, owner: 'orchestrator (render)' });
  const dur = Number(probe.format.duration);
  add({ id: 'T7', category: 'technical', label: 'Duration matches timeline (±0.15 s)', points: 4, passed: Math.abs(dur - expDur) <= 0.15, critical: false, detail: `${dur.toFixed(3)}s vs ${expDur.toFixed(3)}s`, owner: 'orchestrator (render)' });
  add({ id: 'T8', category: 'technical', label: 'Audio AAC 48 kHz stereo', points: 4, passed: a?.codec_name === 'aac' && a?.sample_rate === '48000' && a?.channels === 2, critical: !a, detail: a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels}ch` : 'no audio stream', owner: 'sound-designer' });
  const fast = moovBeforeMdat(file);
  add({ id: 'T9', category: 'technical', label: 'Fast start (moov before mdat)', points: 3, passed: fast === true, critical: false, detail: fast === null ? 'could not parse atoms' : fast ? 'moov first' : 'mdat first', owner: 'orchestrator (render)' });
  const decodeErr = (await ffmpegAnalyze(file, ['-v', 'error'])).split('\n').filter((l) => l.trim() && !/^\s*(Input|Stream|Output|Duration|Metadata|encoder|\[)/.test(l)).slice(0, 5);
  add({ id: 'T10', category: 'technical', label: 'Full decode without errors', points: 4, passed: decodeErr.length === 0, critical: true, detail: decodeErr.length ? decodeErr.join(' | ') : 'clean', owner: 'orchestrator (render)' });

  // ───── audio ─────
  if (a) {
    const loud = await measureLoudness(file);
    add({ id: 'A1', category: 'audio', label: `Integrated loudness ${PS.targetLufs} ±${PS.lufsTolerance} LUFS`, points: 6, passed: Math.abs(loud.integratedLufs - PS.targetLufs) <= PS.lufsTolerance, critical: false, detail: `${loud.integratedLufs} LUFS (LRA ${loud.lra})`, owner: 'sound-designer' });
    add({ id: 'A2', category: 'audio', label: `True peak ≤ ${PS.maxTruePeakDb} dBTP`, points: 5, passed: loud.truePeakDb <= PS.maxTruePeakDb, critical: loud.truePeakDb > 0, detail: `${loud.truePeakDb} dBTP`, owner: 'sound-designer' });
    const astats = await ffmpegAnalyze(file, ['-vn', '-af', 'astats=metadata=0:reset=0']);
    const peakLevel = Math.max(...[...astats.matchAll(/Peak level dB:\s+(-?[\d.]+|-inf)/g)].map((m) => Number(m[1])).filter(Number.isFinite));
    add({ id: 'A3', category: 'audio', label: 'No digital clipping (sample peak < −0.3 dBFS)', points: 3, passed: peakLevel < -0.3, critical: peakLevel >= 0, detail: `sample peak ${peakLevel.toFixed(2)} dBFS`, owner: 'sound-designer' });
    const sil = await ffmpegAnalyze(file, ['-vn', '-af', 'silencedetect=n=-50dB:d=1.2']);
    const silences = [...sil.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]).filter(([s, e]) => s > 0.5 && e < dur - 2);
    add({ id: 'A4', category: 'audio', label: 'No unintended silence > 1.2 s', points: 4, passed: silences.length === 0, critical: false, detail: silences.length ? silences.map(([s, e]) => `${s.toFixed(1)}–${e.toFixed(1)}s`).join(', ') : 'none', owner: 'sound-designer' });
    const ad = Number(a.duration ?? dur), vd = Number(v?.duration ?? dur);
    add({ id: 'A5', category: 'audio', label: 'Audio/video stream lengths match (≤ 0.1 s)', points: 3, passed: Math.abs(ad - vd) <= 0.1, critical: false, detail: `audio ${ad.toFixed(3)}s, video ${vd.toFixed(3)}s`, owner: 'orchestrator (render)' });
    const voiceVol = exists(pp(id, LAYOUT.voiceTrack)) ? (await ffmpegAnalyze(pp(id, LAYOUT.voiceTrack), ['-af', 'volumedetect'])).match(/mean_volume: (-?[\d.]+)/) : null;
    const meanVoice = voiceVol ? Number(voiceVol[1]) : -99;
    add({ id: 'A6', category: 'audio', label: 'Voiceover present', points: 2, passed: meanVoice > -40, critical: meanVoice <= -60, detail: `voice track mean ${meanVoice} dB`, owner: 'sound-designer' });
    const tail = await ffmpegAnalyze(file, ['-vn', '-af', 'volumedetect'], undefined, ['-ss', Math.max(0, dur - 0.15).toFixed(3)]);
    const tailMax = Number((tail.match(/max_volume: (-?[\d.]+)/) ?? [])[1] ?? -99);
    add({ id: 'A7', category: 'audio', label: 'No abrupt cut at the end (last 150 ms < −24 dB)', points: 2, passed: tailMax < -24, critical: false, detail: `tail max ${tailMax} dB`, owner: 'sound-designer' });
  } else {
    for (const [cid, label, pts] of [['A1', 'Loudness', 6], ['A2', 'True peak', 5], ['A3', 'Clipping', 3], ['A4', 'Silence', 4], ['A5', 'A/V length', 3], ['A6', 'Voice present', 2], ['A7', 'Ending', 2]] as const) add({ id: cid, category: 'audio', label, points: pts, passed: false, critical: cid === 'A6', detail: 'no audio stream', owner: 'sound-designer' });
  }

  // ───── visual (measured) ─────
  const black = await ffmpegAnalyze(file, ['-an', '-vf', 'blackdetect=d=0.25:pic_th=0.97', ]);
  const blacks = [...black.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  add({ id: 'V1', category: 'visual', label: 'No black frames/segments ≥ 0.25 s', points: 5, passed: blacks.length === 0, critical: blacks.some(([s]) => s < 0.5), detail: blacks.length ? blacks.map(([s, e]) => `${s.toFixed(2)}–${e.toFixed(2)}s`).join(', ') : 'none', owner: 'motion-designer' });
  const freeze = await ffmpegAnalyze(file, ['-an', '-vf', 'freezedetect=n=0.0008:d=2.5']);
  const freezes = [...freeze.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  add({ id: 'V2', category: 'visual', label: 'No frozen picture > 2.5 s', points: 4, passed: freezes.length === 0, critical: false, detail: freezes.length ? `freeze at ${freezes.map((f) => f.toFixed(1)).join(', ')}s` : 'none', owner: 'motion-designer' });
  const first = await ffmpegAnalyze(file, ['-an', '-frames:v', '1', '-vf', 'signalstats,metadata=print'], undefined, ['-ss', '0.1']);
  const ymax = Number((first.match(/YMAX=(\d+)/) ?? [])[1] ?? 0), ymin = Number((first.match(/YMIN=(\d+)/) ?? [])[1] ?? 0);
  add({ id: 'V3', category: 'visual', label: 'First frame is not blank', points: 3, passed: ymax - ymin > 40, critical: ymax - ymin <= 10, detail: `luma range ${ymin}–${ymax}`, owner: 'motion-designer' });
  const s1 = timeline.scenes[0];
  add({ id: 'V4', category: 'visual', label: 'Hook on screen from frame 0 with a headline', points: 3, passed: s1.cutFrame === 0 && s1.headline.trim().length > 0, critical: false, detail: `s01 layout=${s1.layout}, headline="${s1.headline}"`, owner: 'storyboard-director' });

  // ───── content / layout (deterministic) ─────
  const sz = timeline.safeZone, cap = timeline.brand.captions;
  const capTop = cap.position === 'lower-third' ? PS.height - sz.bottom - CAPTION_BAND_HEIGHT_PX : cap.position === 'upper-third' ? sz.top + 40 : PS.height / 2 - CAPTION_BAND_HEIGHT_PX / 2;
  const capInside = capTop >= sz.top && capTop + CAPTION_BAND_HEIGHT_PX <= PS.height - sz.bottom + 1;
  add({ id: 'C1', category: 'content', label: 'Captions inside Instagram safe zone', points: 3, passed: capInside, critical: false, detail: `band y=${capTop}–${capTop + CAPTION_BAND_HEIGHT_PX}, safe y=${sz.top}–${PS.height - sz.bottom}`, owner: 'motion-designer' });
  add({ id: 'C2', category: 'content', label: `Caption size ≥ ${PS.minCaptionFontPx}px`, points: 2, passed: cap.fontSize >= PS.minCaptionFontPx, critical: false, detail: `${cap.fontSize}px`, owner: 'motion-designer' });
  const short = timeline.scenes.filter((s) => (s.durationInFrames - s.transitionFrames) / timeline.fps < 1.0);
  add({ id: 'C3', category: 'content', label: 'Every scene visible ≥ 1 s', points: 2, passed: short.length === 0, critical: false, detail: short.length ? short.map((s) => s.sceneId).join(', ') : 'ok', owner: 'storyboard-director' });
  const srtOk = target === 'preview' ? true : exists(pp(id, LAYOUT.srt)) && (readText(pp(id, LAYOUT.srt)).match(/-->/g) ?? []).length > 0;
  const srtWords = exists(pp(id, LAYOUT.srt)) ? readText(pp(id, LAYOUT.srt)).split(/\n\n/).map((b) => b.split('\n').slice(2).join(' ')).join(' ').split(/\s+/).filter(Boolean).length : 0;
  add({ id: 'C4', category: 'content', label: 'subtitles.srt matches narration word count', points: 3, passed: srtOk && (target === 'preview' || srtWords === timeline.captions.words.length), critical: false, detail: target === 'preview' ? 'n/a for preview' : `${srtWords} srt words vs ${timeline.captions.words.length} narration words`, owner: 'orchestrator (render)' });

  await extractReviewFrames(id, file, dur, timeline);
  return finish(id, target, rel, checks, sha256File(file), timeline.language);
}

async function extractReviewFrames(id: string, file: string, dur: number, timeline: ReturnType<typeof TimelineSchema.parse>) {
  const dir = pp(id, LAYOUT.qcFrames);
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
  const times: Array<[string, number]> = [[ 'hook-0.1s', 0.1 ], [ 'hook-0.5s', 0.5 ], [ 'hook-1.0s', 1.0 ], [ 'hook-1.5s', 1.5 ], [ 'hook-2.0s', 2.0 ], [ 'hook-3.0s', 3.0 ]];
  for (const s of timeline.scenes) times.push([`${s.sceneId}-mid`, (s.from + s.durationInFrames * 0.6) / timeline.fps]);
  times.push(['end', Math.max(0, dur - 0.25)]);
  for (const [name, t] of times) await ffmpeg(['-ss', Math.min(t, dur - 0.05).toFixed(3), '-i', file, '-frames:v', '1', path.join(dir, `${name}.png`)]);
  // safe-zone overlay on the second scene, for visual verification
  const sz = timeline.safeZone;
  const probe = await ffprobe(file);
  const k = (probe.streams.find((s) => s.codec_type === 'video')?.width ?? PS.width) / PS.width;
  const ref = timeline.scenes[Math.min(1, timeline.scenes.length - 1)];
  await ffmpeg(['-ss', ((ref.from + ref.durationInFrames * 0.6) / timeline.fps).toFixed(3), '-i', file, '-frames:v', '1', '-vf',
    `drawbox=x=0:y=0:w=iw:h=${Math.round(sz.top * k)}:color=red@0.35:t=fill,drawbox=x=0:y=ih-${Math.round(sz.bottom * k)}:w=iw:h=${Math.round(sz.bottom * k)}:color=red@0.35:t=fill,drawbox=x=iw-${Math.round(sz.right * k)}:y=0:w=${Math.round(sz.right * k)}:h=ih:color=red@0.25:t=fill`,
    path.join(dir, 'safe-zone-overlay.png')]);
  // contact sheets
  const hook = times.filter(([n]) => n.startsWith('hook')).map(([n]) => path.join(dir, `${n}.png`));
  await hstack(hook, path.join(dir, 'sheet-first-3s.png'));
  const scenes = times.filter(([n]) => !n.startsWith('hook')).map(([n]) => path.join(dir, `${n}.png`));
  await hstack(scenes, path.join(dir, 'sheet-scenes.png'));
  log.ok(`review frames → ${path.relative(ROOT, dir)} (sheet-first-3s.png, sheet-scenes.png, safe-zone-overlay.png)`);
}

async function hstack(files: string[], out: string) {
  if (files.length === 1) { fs.copyFileSync(files[0], out); return; }
  const inputs = files.flatMap((f) => ['-i', f]);
  const scaled = files.map((_, i) => `[${i}:v]scale=270:480[s${i}]`).join(';');
  await ffmpeg([...inputs, '-filter_complex', `${scaled};${files.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${files.length}[o]`, '-map', '[o]', '-frames:v', '1', out]);
}

function finish(id: string, target: string, rel: string, checks: Check[], renderSha: string | null, lang = 'hy') {
  // merge agent review if it matches this exact render
  let review: z.infer<typeof ReviewSchema> | null = null;
  let reviewNote = 'not yet reviewed — run the quality-controller agent (it looks at reports/frames/*.png)';
  if (exists(pp(id, LAYOUT.qcReview))) {
    try {
      const r = readJson(pp(id, LAYOUT.qcReview), ReviewSchema);
      if (r.renderSha256 === renderSha && r.file === rel) review = r;
      else reviewNote = 'review exists but belongs to a different render — re-review required';
    } catch (e) { reviewNote = `invalid qc-review.json: ${(e as Error).message}`; }
  }
  const reviewItems: Array<[string, string, number, keyof z.infer<typeof ReviewSchema>['scores'], string]> = [
    ['R1', 'Visual quality & composition (frames)', 5, 'visual', 'motion-designer'],
    ['R2', 'Motion & typography quality', 4, 'motion', 'motion-designer'],
    ['R3', 'Content correctness (text, spelling, script match)', 3, 'content', 'scriptwriter'],
    ['R4', 'Hook strength (first 2 s) & logical ending', 3, 'hook', 'storyboard-director'],
  ];
  for (const [rid, label, pts, key, owner] of reviewItems) {
    const s = review ? Math.min(pts, review.scores[key]) : 0;
    checks.push({ id: rid, category: 'review', label, points: pts, score: s, passed: review ? s >= pts * 0.6 : null, critical: false, detail: review ? `${s}/${pts}` : 'pending', owner, method: 'agent-review' });
  }
  const criticalFails = checks.filter((c) => c.critical && c.passed === false);
  const reviewCritical = review?.issues.filter((i) => i.severity === 'critical') ?? [];
  const autoScore = checks.filter((c) => c.method === 'auto').reduce((n, c) => n + c.score, 0);
  const autoMax = checks.filter((c) => c.method === 'auto').reduce((n, c) => n + c.points, 0);
  const total = review ? checks.reduce((n, c) => n + c.score, 0) : null;
  const verdict = criticalFails.length || reviewCritical.length ? 'BLOCKED' : !review ? 'PENDING_REVIEW' : (total ?? 0) >= 90 ? 'PASS' : 'FAIL';

  const report = { projectId: id, language: lang, target, file: rel, renderSha256: renderSha, generatedAt: new Date().toISOString(), verdict, score: total, autoScore, autoMax, passMark: 90, criticalFailures: criticalFails.map((c) => c.id), checks, review, reviewNote };
  writeJson(pp(id, LAYOUT.qcAuto), report);
  writeJson(pp(id, LAYOUT.qcReportJson), report);
  writeText(pp(id, LAYOUT.qcReport), renderMarkdown(report, checks, review, reviewNote, lang));
  recordQc(id, rel, total, autoScore, verdict, criticalFails.length + reviewCritical.length);
  if (target === 'final') setStage(id, 'qc', verdict === 'PASS' ? 'done' : 'failed', { output: LAYOUT.qcReport, error: verdict === 'PASS' ? '' : verdict });

  const color = verdict === 'PASS' ? log.ok : verdict === 'PENDING_REVIEW' ? log.warn : log.fail;
  for (const c of checks.filter((x) => x.passed === false)) log.fail(`${c.id} ${c.label}: ${c.detail}${c.critical ? ' [CRITICAL]' : ''} → ${c.owner}`);
  color(`QC ${verdict}: auto ${autoScore}/${autoMax}${total !== null ? ` · total ${total}/100` : ` · ${reviewNote}`}`);
  if (verdict === 'BLOCKED' || verdict === 'FAIL') process.exitCode = 2;
  return report;
}

function renderMarkdown(r: { verdict: string; score: number | null; autoScore: number; autoMax: number; file: string; generatedAt: string; renderSha256: string | null }, checks: Check[], review: z.infer<typeof ReviewSchema> | null, reviewNote: string, lang: string) {
  const T = qcText(lang);
  const label = (c: Check) => (lang === 'hy' ? CHECK_LABELS_HY[c.id] ?? c.label : c.label);
  const icon = (c: Check) => (c.passed === null ? '⏳' : c.passed ? '✅' : c.critical ? '⛔' : '❌');
  const cats: Category[] = ['technical', 'audio', 'visual', 'content', 'review'];
  const note = reviewNote.startsWith('review exists') ? T.stale : reviewNote.startsWith('not yet') ? T.pending : reviewNote;
  const lines = [
    `# ${T.title}`,
    '',
    `- **${T.file}:** \`${r.file}\``,
    `- **SHA-256:** \`${r.renderSha256 ?? '—'}\``,
    `- **${T.date}:** ${r.generatedAt}`,
    `- **${T.verdict}:** **${r.verdict}**`,
    `- **${T.score}:** ${T.scoreLine(r.autoScore, r.autoMax, r.score)}`,
    '',
  ];
  for (const cat of cats) {
    lines.push(`## ${T.cats[cat]}`, '', T.tableHead, '|---|---|---|---|---|---|');
    for (const c of checks.filter((x) => x.category === cat)) lines.push(`| ${icon(c)} | ${c.id} | ${label(c)} | ${c.score}/${c.points} | ${c.detail.replace(/\|/g, '/')} | ${c.owner} |`);
    lines.push('');
  }
  lines.push(`## ${T.expert}`, '');
  if (review) {
    lines.push(`${T.reviewer}${lang === 'hy' ? '՝' : ':'} ${review.reviewer}`, '', review.notes || '', '');
    if (review.issues.length) {
      lines.push(T.issuesHead, '|---|---|---|---|---|');
      for (const i of review.issues) lines.push(`| ${i.severity} | ${i.sceneId} | ${i.category} | ${i.description.replace(/\|/g, '/')} | ${i.owner} |`);
    } else lines.push(T.noIssues);
  } else lines.push(`⏳ ${note}`);
  lines.push('', `## ${T.human}`, '', ...T.humanItems.map((h) => `- ${h}`), '');
  return lines.join('\n');
}
