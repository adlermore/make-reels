/**
 * Stage gates for agent-produced artifacts. A stage is marked done ONLY when its artifact passes.
 * Errors block the pipeline; warnings are reported to the orchestrator.
 */
import fs from 'node:fs';
import { LAYOUT, pp } from '../lib/paths.js';
import { exists, readText, sha256File } from '../lib/io.js';
import { log, PipelineError } from '../lib/log.js';
import { setStage, getStage, invalidateAfter, type Stage } from '../lib/db.js';
import { loadBrief, loadScript, loadShotList, assertProject } from '../lib/project.js';
import { prepareSvgCheck } from '../lib/svg.js';
import { lintArmenian } from '../lib/lint-hy.js';

export type ValidationResult = { stage: Stage; errors: string[]; warnings: string[] };

const countWords = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

function requireMarkdown(id: string, rel: string, headings: string[], minChars: number): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const p = pp(id, rel);
  if (!exists(p)) return { errors: [`missing ${rel}`], warnings };
  const md = readText(p);
  if (md.trim().length < minChars) errors.push(`${rel} is too short (${md.trim().length} chars, need ≥ ${minChars})`);
  for (const h of headings) if (!new RegExp(h, 'i').test(md)) errors.push(`${rel}: missing section matching /${h}/`);
  return { errors, warnings };
}

export function validateResearch(id: string): ValidationResult {
  const r = requireMarkdown(id, LAYOUT.research, ['hook|հուք|կեռիկ', 'audience|аудитор|լսարան', 'source|источник|աղբյուր'], 800);
  const md = exists(pp(id, LAYOUT.research)) ? readText(pp(id, LAYOUT.research)) : '';
  if (/\d[\d\s]*(views|просмотр)/i.test(md) && !/(источник|source|http)/i.test(md)) r.warnings.push('view counts mentioned without a source — Trend Researcher must not invent statistics');
  return { stage: 'research', ...r };
}

export function validateCreative(id: string): ValidationResult {
  return { stage: 'creative', ...requireMarkdown(id, LAYOUT.creative, ['palette|палитр|colou?r|գույն|գունապնակ', 'typograph|типограф|font|տառատեսակ|տիպոգրաֆ', 'camera|камер|motion|движ|տեսախցիկ|շարժ'], 600) };
}

export function validateScript(id: string): ValidationResult {
  const errors: string[] = [], warnings: string[] = [];
  if (!exists(pp(id, LAYOUT.scriptMd))) errors.push(`missing ${LAYOUT.scriptMd}`);
  let script;
  try { script = loadScript(id); } catch (e) { return { stage: 'script', errors: [...errors, (e as Error).message], warnings }; }
  const brief = loadBrief(id);
  const ids = script.scenes.map((s) => s.sceneId);
  ids.forEach((sid, i) => { if (sid !== `s${String(i + 1).padStart(2, '0')}`) errors.push(`scene ids must be sequential s01, s02…; got ${sid} at position ${i + 1}`); });
  if (!script.scenes[0].narration.trim()) errors.push('s01 must contain narration — the hook has to be spoken in the first seconds');
  const words = script.scenes.reduce((n, s) => n + countWords(s.narration), 0);
  const speakSec = brief.durationSec - 1.6 - 0.35 - 0.22 * (script.scenes.length - 1);
  const expectedWords = speakSec * script.wordsPerSecond;
  const ratio = words / expectedWords;
  if (ratio > 1.2) errors.push(`narration too long: ${words} words ≈ ${(words / script.wordsPerSecond).toFixed(1)}s of speech, but only ≈${speakSec.toFixed(1)}s available for ${brief.durationSec}s (cut ~${Math.round(words - expectedWords)} words)`);
  else if (ratio < 0.7) errors.push(`narration too short: ${words} words for ${brief.durationSec}s (≈${Math.round(expectedWords)} expected) — the video would be padded with silence`);
  else if (Math.abs(ratio - 1) > 0.1) warnings.push(`narration length ${words} words vs ≈${Math.round(expectedWords)} ideal — voice step will adjust speed within ±15%`);
  if (brief.language === 'hy' && script.wordsPerSecond > 2.25) warnings.push(`wordsPerSecond ${script.wordsPerSecond} is too high for Armenian — the hy_AM voice measured ≈2.05 words/s; use 2.1`);
  if (script.language !== brief.language) errors.push(`script.language "${script.language}" ≠ brief language "${brief.language}"`);
  if (brief.language === 'hy') {
    for (const s of script.scenes) {
      for (const [field, kind] of [['narration', 'narration'], ['onScreenText', 'screen']] as const) {
        const l = lintArmenian(s[field], `${s.sceneId}.${field}`, kind);
        errors.push(...l.errors); warnings.push(...l.warnings.filter((w) => !(field === 'narration' && s.pronunciation && /Latin letters/.test(w))));
      }
    }
  }
  for (const s of script.scenes) {
    if (/\d/.test(s.narration) && !s.pronunciation) warnings.push(`${s.sceneId}: digits in narration — write numbers as words (captions follow the narration exactly)`);
    if (countWords(s.narration) > 0 && countWords(s.narration) / script.wordsPerSecond < 1.0) warnings.push(`${s.sceneId}: very short narration (<1s) — fast cut, make sure it is intentional`);
  }
  if (!script.cta.trim()) errors.push('cta is empty');
  return { stage: 'script', errors, warnings };
}

const LAYOUT_REQUIREMENTS: Record<string, (s: ReturnType<typeof loadShotList>['shots'][number]) => string | null> = {
  stat: (s) => (s.text.stat ? null : 'layout "stat" needs text.stat {value, suffix, label}'),
  list: (s) => (s.text.items.length >= 2 && s.text.items.length <= 5 ? null : 'layout "list" needs 2–5 text.items'),
  'split-reveal': (s) => (s.text.items.length === 2 ? null : 'layout "split-reveal" needs exactly 2 text.items [before, after]'),
  hook: (s) => (s.text.headline ? null : 'layout "hook" needs a headline'),
  'hook-stat': (s) => (s.text.stat && s.text.headline ? null : 'layout "hook-stat" needs text.stat {value, suffix} and a headline'),
  'kinetic-title': (s) => (s.text.headline ? null : 'layout "kinetic-title" needs a headline'),
  quote: (s) => (s.text.headline ? null : 'layout "quote" needs the quote in text.headline'),
  cta: (s) => (s.text.headline ? null : 'layout "cta" needs a headline'),
};

export function validateStoryboard(id: string): ValidationResult {
  const errors: string[] = [], warnings: string[] = [];
  if (!exists(pp(id, LAYOUT.storyboardMd))) errors.push(`missing ${LAYOUT.storyboardMd}`);
  let shots, script;
  try { shots = loadShotList(id); script = loadScript(id); } catch (e) { return { stage: 'storyboard', errors: [...errors, (e as Error).message], warnings }; }
  const scriptIds = script.scenes.map((s) => s.sceneId).join(',');
  const shotIds = shots.shots.map((s) => s.sceneId).join(',');
  if (scriptIds !== shotIds) errors.push(`shot-list scenes (${shotIds}) must match script scenes (${scriptIds}) one-to-one`);
  if (!['hook', 'hook-stat'].includes(shots.shots[0]?.layout ?? '')) warnings.push('first shot is not a "hook" layout — make sure the first 2 seconds stop the scroll');
  if (shots.shots[shots.shots.length - 1]?.layout !== 'cta') warnings.push('last shot is not a "cta" layout');
  const lang = loadBrief(id).language;
  if (lang === 'hy') {
    for (const s of shots.shots) {
      const texts: Array<[string, string]> = [['headline', s.text.headline], ['subline', s.text.subline], ['source', s.text.source], ['stat.label', s.text.stat?.label ?? ''], ...s.text.items.map((it, k): [string, string] => [`items[${k}]`, it])];
      for (const [f, t] of texts) { const l = lintArmenian(t, `${s.sceneId}.text.${f}`, 'screen'); errors.push(...l.errors); warnings.push(...l.warnings); }
    }
  }
  for (const s of shots.shots) {
    const req = LAYOUT_REQUIREMENTS[s.layout]?.(s);
    if (req) errors.push(`${s.sceneId}: ${req}`);
    if (s.text.headline.length > 70) warnings.push(`${s.sceneId}: headline is ${s.text.headline.length} chars — on-screen text should be short (≤ 60)`);
    const files = [s.background.source !== 'motion' ? s.background.path : '', s.illustration].filter(Boolean);
    if (s.background.source !== 'motion' && !s.background.path) errors.push(`${s.sceneId}: background.source=${s.background.source} needs background.path`);
    for (const f of files) {
      const abs = pp(id, f);
      if (!exists(abs)) { errors.push(`${s.sceneId}: missing asset ${f}`); continue; }
      if (f.endsWith('.svg')) { const problem = prepareSvgCheck(fs.readFileSync(abs, 'utf8')); if (problem) errors.push(`${s.sceneId}: ${f}: ${problem}`); }
    }
  }
  return { stage: 'storyboard', errors, warnings };
}

const VALIDATORS: Record<string, (id: string) => ValidationResult> = {
  research: validateResearch, creative: validateCreative, script: validateScript, storyboard: validateStoryboard,
};
const STAGE_FILES: Record<string, string[]> = {
  research: [LAYOUT.research], creative: [LAYOUT.creative], script: [LAYOUT.scriptMd, LAYOUT.scriptJson], storyboard: [LAYOUT.storyboardMd, LAYOUT.shotList],
};

/** Validate one stage (or all creative stages) and update production state. Throws if any errors. */
export async function validate(id: string, stage?: string) {
  assertProject(id);
  const stages = stage ? [stage] : Object.keys(VALIDATORS);
  let failed = false;
  for (const st of stages) {
    const fn = VALIDATORS[st];
    if (!fn) throw new PipelineError(`Unknown stage "${st}". Use one of: ${Object.keys(VALIDATORS).join(', ')}`);
    log.step(`Validate ${st}`);
    const r = fn(id);
    r.warnings.forEach((w) => log.warn(w));
    if (r.errors.length) {
      r.errors.forEach((e) => log.fail(e));
      setStage(id, r.stage, 'failed', { error: r.errors.join('; ') });
      failed = true;
      continue;
    }
    const hash = STAGE_FILES[st].map((f) => (exists(pp(id, f)) ? sha256File(pp(id, f)) : '')).join(':');
    const prev = getStage(id, r.stage);
    if (prev?.status === 'done' && prev.input_hash && prev.input_hash !== hash) {
      invalidateAfter(id, r.stage);
      log.warn(`${st} changed since last approval — downstream stages marked stale`);
    }
    setStage(id, r.stage, 'done', { inputHash: hash, output: STAGE_FILES[st].join(', ') });
    log.ok(`${st} OK`);
  }
  if (failed) throw new PipelineError('Validation failed — fix the artifacts above and re-run validate.');
}

