import fs from 'node:fs';
import path from 'node:path';
import { BriefSchema, type Brief } from '../../src/types/schemas.js';
import { LAYOUT, pp, projectDir, ROOT, BRANDS_DIR } from '../lib/paths.js';
import { ensureDir, exists, readText, writeJson, writeText, sha256 } from '../lib/io.js';
import { log, PipelineError } from '../lib/log.js';
import { upsertProject, setStage, exportState, getStage, invalidateAfter } from '../lib/db.js';
import { loadBrandFromLibrary, assertProject } from '../lib/project.js';

const FOLDERS = ['brief', 'brand', 'references', 'research', 'creative', 'script', 'storyboard', 'assets/illustrations', 'assets/local', 'audio', 'renders', 'reports'];

/** Create a project skeleton. Never overwrites existing files. */
export async function init(id: string, opts: { brand?: string; topic?: string }) {
  const dir = projectDir(id);
  const brandId = opts.brand ?? 'default';
  const brand = loadBrandFromLibrary(brandId);
  log.step(`Init project ${id} (brand: ${brand.name})`);
  for (const f of FOLDERS) ensureDir(path.join(dir, f));

  const briefPath = pp(id, LAYOUT.brief);
  if (!exists(briefPath)) {
    const tpl = readText(path.join(ROOT, 'templates', 'content-brief.md'));
    writeText(briefPath, tpl.replace(/\{\{PROJECT_ID\}\}/g, id).replace(/\{\{BRAND\}\}/g, brandId).replace(/\{\{TOPIC\}\}/g, opts.topic ?? ''));
    log.ok(`brief template → ${path.relative(ROOT, briefPath)}`);
  } else log.info('brief already exists — kept');

  snapshotBrand(id, brandId);

  const refReadme = path.join(dir, 'references', 'README.md');
  if (!exists(refReadme)) writeText(refReadme, '# References\n\nПоложите сюда ссылки (links.md), скриншоты и примеры Reels, которые нравятся.\nTrend Researcher и Creative Director используют эту папку как источник реальных референсов.\n');

  upsertProject(id, brandId, opts.topic ?? '');
  exportState(id);
  log.ok(`project ready: projects/${id}`);
}

/** Copy brand config + logo into the project, so later brand edits never leak into old projects. */
export function snapshotBrand(id: string, brandId: string) {
  const brand = loadBrandFromLibrary(brandId);
  writeJson(pp(id, LAYOUT.brandSnapshot), brand);
  if (brand.logo) {
    const src = path.join(BRANDS_DIR, brandId, brand.logo);
    if (exists(src)) fs.copyFileSync(src, pp(id, path.join('brand', path.basename(brand.logo))));
    else log.warn(`brand logo not found: ${src}`);
  }
  log.ok(`brand snapshot → projects/${id}/${LAYOUT.brandSnapshot}`);
}

const KEY_MAP: Record<string, keyof Brief> = {
  'TOPIC': 'topic', 'PLATFORM': 'platform', 'LANGUAGE': 'language', 'DURATION': 'durationSec',
  'TARGET AUDIENCE': 'targetAudience', 'STYLE': 'style', 'FORMAT': 'format', 'VOICE': 'voice',
  'CTA': 'cta', 'BRAND': 'brand', 'NOTES': 'notes', 'PROJECT ID': 'projectId',
};
const LANG: Record<string, string> = {
  russian: 'ru', 'русский': 'ru', english: 'en', 'английский': 'en',
  armenian: 'hy', 'armenian (eastern)': 'hy', 'eastern armenian': 'hy', 'армянский': 'hy', 'восточноармянский': 'hy', 'հայերեն': 'hy', hy: 'hy', ru: 'ru', en: 'en',
};

/** Parse brief/brief.md ("KEY:" blocks) into a validated brief.json. */
export async function parseBrief(id: string) {
  assertProject(id);
  log.step(`Parse brief for ${id}`);
  const md = readText(pp(id, LAYOUT.brief));
  const fields: Record<string, string> = {};
  let key: string | null = null;
  for (const line of md.split(/\r?\n/)) {
    if (/^\s*(#|>|<!--)/.test(line)) continue;
    const m = line.match(/^([A-Z][A-Z ]+):\s*(.*)$/);
    if (m && KEY_MAP[m[1].trim()]) { key = m[1].trim(); fields[key] = m[2].trim(); continue; }
    if (key && line.trim()) fields[key] = `${fields[key]} ${line.trim()}`.trim();
  }
  const raw: Record<string, unknown> = { projectId: id };
  for (const [k, v] of Object.entries(fields)) raw[KEY_MAP[k]] = v;
  if (typeof raw.durationSec === 'string') raw.durationSec = Number((raw.durationSec.match(/\d+(\.\d+)?/) ?? ['0'])[0]);
  if (typeof raw.language === 'string') raw.language = LANG[raw.language.toLowerCase()] ?? raw.language.toLowerCase();
  const parsed = BriefSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PipelineError(`brief.md is incomplete:\n${parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`, `Edit projects/${id}/${LAYOUT.brief}`);
  }
  const brief = parsed.data;
  const hash = sha256(brief);
  const prev = getStage(id, 'brief');
  writeJson(pp(id, LAYOUT.briefJson), brief);
  if (brief.brand && exists(path.join(BRANDS_DIR, brief.brand))) snapshotBrand(id, brief.brand);
  if (prev?.status === 'done' && prev.input_hash !== hash) invalidateAfter(id, 'brief');
  upsertProject(id, brief.brand, brief.topic);
  setStage(id, 'brief', 'done', { inputHash: hash, output: LAYOUT.briefJson });
  log.ok(`brief.json: «${brief.topic}», ${brief.durationSec}s, ${brief.language}, brand=${brief.brand}`);
  return brief;
}
