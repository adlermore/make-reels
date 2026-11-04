import fs from 'node:fs';
import path from 'node:path';
import {
  BrandConfigSchema, BriefSchema, ScriptSchema, ShotListSchema, VoiceTimingSchema, ProductionStandards,
  type BrandConfig, type Brief, type Script, type ShotList, type VoiceTiming,
} from '../../src/types/schemas.js';
import { LAYOUT, pp, projectDir, BRANDS_DIR } from './paths.js';
import { exists, readJson } from './io.js';
import { PipelineError } from './log.js';

export const loadBrief = (id: string): Brief => readJson(pp(id, LAYOUT.briefJson), BriefSchema);
export const loadBrand = (id: string): BrandConfig => readJson(pp(id, LAYOUT.brandSnapshot), BrandConfigSchema);
export const loadScript = (id: string): Script => readJson(pp(id, LAYOUT.scriptJson), ScriptSchema);
export const loadShotList = (id: string): ShotList => readJson(pp(id, LAYOUT.shotList), ShotListSchema);
export const loadVoiceTiming = (id: string): VoiceTiming => readJson(pp(id, LAYOUT.voiceTiming), VoiceTimingSchema);

export function loadBrandFromLibrary(brandId: string): BrandConfig {
  const p = path.join(BRANDS_DIR, brandId, 'brand-config.json');
  if (!exists(p)) throw new PipelineError(`Brand "${brandId}" not found at ${p}`, `Available: ${fs.readdirSync(BRANDS_DIR).filter((d) => !d.startsWith('_')).join(', ')}`);
  return readJson(p, BrandConfigSchema);
}

export function assertProject(id: string) {
  if (!exists(projectDir(id))) throw new PipelineError(`Project "${id}" does not exist`, `Create it: npm run reel -- init ${id}`);
}

export const safeZoneOf = (brand: BrandConfig) => brand.safeZone ?? ProductionStandards.defaultSafeZone;

/** Tail after the last spoken word so the CTA can breathe. */
export const TAIL_SEC = 1.6;
/** Visual cut happens slightly before the narration of the next scene starts. */
export const CUT_LEAD_SEC = 0.12;

export interface SceneWindow { sceneId: string; startSec: number; endSec: number }

/**
 * Scene windows derived from the REAL voiceover timing (audio-first editing).
 * Scene i spans from (its narration start − lead) to the next scene's cut; the last scene holds TAIL_SEC.
 */
export function sceneWindows(vt: VoiceTiming, transitionSec = 10 / 30): { windows: SceneWindow[]; totalSec: number } {
  const totalSec = vt.totalSec + TAIL_SEC;
  // The incoming scene starts transitionSec/2 BEFORE the cut, so the cut must sit at least that far
  // (+50 ms) after the previous scene's last spoken word — otherwise the next visual steps on the voice.
  const lastWordEnd = (s: VoiceTiming['scenes'][number]) => {
    const inScene = vt.words.filter((w) => w.startMs / 1000 >= s.startSec - 0.01 && w.startMs / 1000 < s.endSec);
    return inScene.length ? inScene[inScene.length - 1].endMs / 1000 : s.endSec;
  };
  const starts = vt.scenes.map((s, i) => (i === 0 ? 0 : Math.max(0, s.startSec - CUT_LEAD_SEC, lastWordEnd(vt.scenes[i - 1]) + transitionSec / 2 + 0.05)));
  const windows = vt.scenes.map((s, i) => ({ sceneId: s.sceneId, startSec: starts[i], endSec: i + 1 < starts.length ? starts[i + 1] : totalSec }));
  return { windows, totalSec };
}
