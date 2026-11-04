import fs from 'node:fs';
import path from 'node:path';
import { LAYOUT, pp, ROOT, VENV_PYTHON, PIPER_VOICES_DIR } from '../lib/paths.js';
import { exists, readText, writeText } from '../lib/io.js';
import { run } from '../lib/proc.js';
import { color, log, PipelineError } from '../lib/log.js';
import { getStage, listStages, listProjects, setStage, exportAssets, exportCosts, exportState, setAssetStatus, type Stage } from '../lib/db.js';
import { assertProject, loadBrief } from '../lib/project.js';
import { FFMPEG, FFPROBE } from '../lib/ffmpeg.js';

const GATES: Record<string, { stage: Stage; requires: Stage[]; label: string }> = {
  a: { stage: 'approval-a', requires: ['brief', 'research', 'creative', 'script', 'storyboard'], label: 'Creative approval (research, concept, script, storyboard)' },
  b: { stage: 'approval-b', requires: ['voice', 'music', 'sfx', 'mix', 'timeline', 'storyboard-frames'], label: 'Assets & animatic approval (voice, music, frames)' },
  c: { stage: 'approval-c', requires: ['preview'], label: 'Preview approval' },
  d: { stage: 'approval-d', requires: ['final', 'qc'], label: 'Final approval (QC passed)' },
};

/** Throws unless the user approval gate was recorded. */
export function requireApproval(id: string, gate: Stage, action: string) {
  const s = getStage(id, gate);
  if (s?.status !== 'done') {
    const letter = Object.entries(GATES).find(([, g]) => g.stage === gate)?.[0] ?? '?';
    throw new PipelineError(`Cannot run ${action}: ${gate} is not approved (status: ${s?.status ?? 'pending'}).`, `Show the user the materials, get explicit approval in chat, then: npm run reel -- approve ${id} ${letter} --note "<what the user approved>"`);
  }
}

/** Record a user approval. Only run this after the user explicitly approved in the conversation. */
export async function approve(id: string, letter: string, note: string) {
  assertProject(id);
  const g = GATES[letter?.toLowerCase()];
  if (!g) throw new PipelineError('Gate must be one of: a, b, c, d');
  if (!note.trim()) throw new PipelineError('An approval needs --note "<what the user approved>"');
  const missing = g.requires.filter((s) => getStage(id, s)?.status !== 'done');
  if (missing.length) throw new PipelineError(`Cannot approve ${g.stage}: not done yet → ${missing.join(', ')}`);
  setStage(id, g.stage, 'done', { output: `approved by user: ${note}` });
  if (letter === 'b') setAssetStatus(id, `${id}:`, 'approved');
  exportAssets(id);
  log.ok(`${g.label} recorded: "${note}"`);
}

const ICON: Record<string, string> = { done: color.green('●'), running: color.blue('◐'), failed: color.red('✖'), stale: color.yellow('◌'), pending: color.dim('○') };

export async function status(id: string) {
  assertProject(id);
  exportState(id);
  let topic = '';
  try { topic = loadBrief(id).topic; } catch { /* brief not parsed yet */ }
  console.log(`\n${color.bold(id)}${topic ? ` — ${topic}` : ''}`);
  for (const s of listStages(id)) {
    const extra = s.status === 'failed' ? color.red(` ${s.error.slice(0, 120)}`) : s.output ? color.dim(` ${s.output.slice(0, 90)}`) : '';
    console.log(`  ${ICON[s.status] ?? '?'} ${s.stage.padEnd(18)} ${s.status.padEnd(8)}${extra}`);
  }
  const next = listStages(id).find((s) => s.status !== 'done');
  console.log(next ? `\n  next: ${color.cyan(next.stage)}` : `\n  ${color.green('all stages done')}`);
}

export async function list() {
  const rows = listProjects();
  if (!rows.length) return log.info('no projects yet — npm run reel -- init <id>');
  for (const r of rows) console.log(`  ${r.id.padEnd(28)} ${r.brand.padEnd(14)} ${r.topic}`);
}

const DELIVERABLES = [
  LAYOUT.research, LAYOUT.creative, LAYOUT.scriptMd, LAYOUT.storyboardMd, LAYOUT.shotList, LAYOUT.assetManifest,
  LAYOUT.soundPlanMd, LAYOUT.costReport, LAYOUT.qcReport, LAYOUT.final, LAYOUT.preview, LAYOUT.poster, LAYOUT.srt, LAYOUT.readme,
];

export async function deliver(id: string) {
  assertProject(id);
  requireApproval(id, 'approval-d', 'deliver');
  log.step(`Deliver ${id}`);
  exportAssets(id);
  exportCosts(id);
  if (!exists(pp(id, LAYOUT.publishKit))) {
    writeText(pp(id, LAYOUT.publishKit), readText(path.join(ROOT, 'templates', 'publish-kit.md')));
    log.warn('publish-kit.md was missing — template created; the orchestrator must fill caption & hashtags');
  }
  writeProjectReadme(id);
  const missing = DELIVERABLES.filter((f) => !exists(pp(id, f)));
  if (missing.length) {
    missing.forEach((m) => log.fail(`missing deliverable: ${m}`));
    setStage(id, 'deliver', 'failed', { error: `missing: ${missing.join(', ')}` });
    throw new PipelineError('Delivery incomplete');
  }
  setStage(id, 'deliver', 'done', { output: LAYOUT.readme });
  log.ok(`all ${DELIVERABLES.length} deliverables present — projects/${id}/README.md`);
}

function writeProjectReadme(id: string) {
  const brief = loadBrief(id);
  const qc = exists(pp(id, LAYOUT.qcReportJson)) ? (JSON.parse(readText(pp(id, LAYOUT.qcReportJson))) as { verdict: string; score: number | null; autoScore: number }) : null;
  const vt = exists(pp(id, LAYOUT.voiceTiming)) ? (JSON.parse(readText(pp(id, LAYOUT.voiceTiming))) as { engine: string; voice: string }) : null;
  const music = exists(pp(id, LAYOUT.musicMeta)) ? (JSON.parse(readText(pp(id, LAYOUT.musicMeta))) as { source: string; preset?: string; license?: string }) : null;
  const sizeMb = (f: string) => (exists(pp(id, f)) ? `${(fs.statSync(pp(id, f)).size / 1e6).toFixed(1)} MB` : '—');
  if (brief.language === 'hy') {
    writeText(pp(id, LAYOUT.readme), `# ${brief.topic}

Նախագիծ՝ \`${id}\` · բրենդ՝ \`${brief.brand}\` · լեզու՝ հայերեն · նպատակային տևողություն՝ ${brief.durationSec} վ

## Պատրաստի ֆայլեր

| Ֆայլ | Նշանակություն |
|---|---|
| [renders/final.mp4](renders/final.mp4) (${sizeMb(LAYOUT.final)}) | Վերջնական Reels՝ 1080×1920, 30 կ/վ, H.264/AAC 48 կՀց, −14 LUFS |
| [renders/final-no-music.mp4](renders/final-no-music.mp4) | Ձայն և էֆեկտներ՝ առանց երաժշտության, Instagram-ի հավելվածում թրենդային ձայն ավելացնելու համար |
| [renders/preview.mp4](renders/preview.mp4) | Նախադիտում՝ 540×960, ջրանիշով |
| [renders/poster.png](renders/poster.png) | Շապիկ (հիմնական բովանդակությունը կենտրոնական 3:4 գոտում է) |
| [renders/subtitles.srt](renders/subtitles.srt) | Ենթագրեր՝ առանձին վերբեռնման համար |
| [publish-kit.md](publish-kit.md) | Գրառման տեքստ, հեշթեգեր, alt-տեքստ |
| [reports/quality-report.md](reports/quality-report.md) | Որակի վերահսկում՝ **${qc?.verdict ?? '—'}**${qc?.score != null ? `, ${qc.score}/100` : ''} |

## Արտադրություն

- Հետազոտություն → [research/research-report.md](research/research-report.md)
- Կրեատիվ ուղղություն → [creative/creative-direction.md](creative/creative-direction.md)
- Սցենար → [script/script.md](script/script.md) · Սթորիբորդ → [storyboard/storyboard.md](storyboard/storyboard.md), [shot-list.json](storyboard/shot-list.json)
- Ձայն → [audio/sound-design-plan.md](audio/sound-design-plan.md) · դիկտոր՝ ${vt ? `${vt.engine} / ${vt.voice}` : '—'} · երաժշտություն՝ ${music ? `${music.source} ${music.preset ?? ''}` : '—'}
- Նյութեր և լիցենզիաներ → [asset-manifest.json](asset-manifest.json) · Ծախսեր → [production-cost-report.json](production-cost-report.json) (տեղային անվճար ռեժիմ՝ $0)
- Արտադրության վիճակ → [production-state.json](production-state.json)

## Հրապարակում

Հրապարակումը կատարվում է ձեռքով։ Համակարգը երբեք ինքնաշխատ չի հրապարակում տեսանյութը։
`);
    return;
  }
  writeText(pp(id, LAYOUT.readme), `# ${brief.topic}

Проект: \`${id}\` · бренд: \`${brief.brand}\` · язык: ${brief.language} · целевая длительность: ${brief.durationSec} c

## Готовые файлы

| Файл | Назначение |
|---|---|
| [renders/final.mp4](renders/final.mp4) (${sizeMb(LAYOUT.final)}) | Итоговый Reels 1080×1920, 30 fps, H.264/AAC 48 kHz, −14 LUFS |
| [renders/final-no-music.mp4](renders/final-no-music.mp4) | Голос + эффекты без музыки — для трендового звука в приложении Instagram |
| [renders/preview.mp4](renders/preview.mp4) | Превью 540×960 с водяным знаком |
| [renders/poster.png](renders/poster.png) | Обложка (ключевое содержимое в центральной зоне 3:4) |
| [renders/subtitles.srt](renders/subtitles.srt) | Субтитры (на случай загрузки отдельно) |
| [publish-kit.md](publish-kit.md) | Текст поста, хештеги, alt-текст |
| [reports/quality-report.md](reports/quality-report.md) | Контроль качества: **${qc?.verdict ?? '—'}**${qc?.score != null ? `, ${qc.score}/100` : ''} |

## Производство

- Исследование → [research/research-report.md](research/research-report.md)
- Креативная концепция → [creative/creative-direction.md](creative/creative-direction.md)
- Сценарий → [script/script.md](script/script.md) · Раскадровка → [storyboard/storyboard.md](storyboard/storyboard.md), [shot-list.json](storyboard/shot-list.json)
- Звук → [audio/sound-design-plan.md](audio/sound-design-plan.md) · голос: ${vt ? `${vt.engine} / ${vt.voice}` : '—'} · музыка: ${music ? `${music.source} ${music.preset ?? ''}` : '—'}
- Ассеты и лицензии → [asset-manifest.json](asset-manifest.json) · Расходы → [production-cost-report.json](production-cost-report.json) (локальный бесплатный режим: $0)
- Состояние производства → [production-state.json](production-state.json)

## Публикация

Публикация выполняется вручную. Система никогда не публикует ролик автоматически.
`);
}

/** Environment check (also used by PHASE 1 audit). */
export async function doctor() {
  log.step('Environment');
  const check = async (label: string, cmd: string, args: string[], re: RegExp) => {
    try {
      const r = await run(cmd, args, { allowFail: true, timeoutMs: 30_000 });
      const m = (r.stdout + r.stderr).match(re);
      if (r.code === 0 && m) log.ok(`${label}: ${m[1] ?? m[0]}`); else log.fail(`${label}: not working (${(r.stderr || r.stdout).slice(0, 120)})`);
    } catch (e) { log.fail(`${label}: ${(e as Error).message}`); }
  };
  log.ok(`node: ${process.version}`);
  await check('ffmpeg', FFMPEG, ['-version'], /ffmpeg version (\S+)/);
  await check('ffprobe', FFPROBE, ['-version'], /ffprobe version (\S+)/);
  const pkg = JSON.parse(readText(path.join(ROOT, 'node_modules', 'remotion', 'package.json'))) as { version: string };
  log.ok(`remotion: ${pkg.version}`);
  if (exists(VENV_PYTHON)) await check('piper-tts (.venv)', VENV_PYTHON, ['-c', 'import importlib.metadata as m, onnx; print(m.version("piper-tts"))'], /(\d+\.\d+\.\d+)/);
  else log.warn('piper-tts: .venv missing — run npm run setup:voice (Windows SAPI fallback will be used)');
  const voices = exists(PIPER_VOICES_DIR) ? fs.readdirSync(PIPER_VOICES_DIR).filter((f) => f.endsWith('.onnx')) : [];
  voices.length ? log.ok(`piper voices: ${voices.map((v) => v.replace('.onnx', '')).join(', ')}`) : log.warn('no piper voices downloaded');
  if (process.platform === 'win32') await check('windows SAPI voices', 'powershell', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | % { $_.VoiceInfo.Name } | Out-String'], /([\s\S]+)/);
  log.ok(`database: data/studio.db (node:sqlite)`);
}
