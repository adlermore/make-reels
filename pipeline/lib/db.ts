/**
 * Local studio database (built-in node:sqlite, no extra dependency, no server).
 * Source of truth for production state, asset registry, job history, costs and QC runs.
 * JSON mirrors (production-state.json, asset-manifest.json, production-cost-report.json)
 * are exported into each project folder for agents and deliverables.
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { DATA_DIR, LAYOUT, pp } from './paths.js';
import { ensureDir, writeJson } from './io.js';
import type { Asset } from '../../src/types/schemas.js';

export const STAGES = [
  'brief', 'research', 'creative', 'script', 'storyboard',
  'approval-a', // creative approval (user)
  'voice', 'music', 'sfx', 'mix', 'timeline', 'storyboard-frames',
  'approval-b', // assets / animatic approval (user)
  'preview',
  'approval-c', // preview approval (user)
  'final', 'qc',
  'approval-d', // final approval (user)
  'deliver',
] as const;
export type Stage = (typeof STAGES)[number];
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'stale';

let _db: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (_db) return _db;
  ensureDir(DATA_DIR);
  _db = new DatabaseSync(process.env.REELS_DB_PATH || path.join(DATA_DIR, 'studio.db'));
  _db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, brand TEXT NOT NULL, topic TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stages (
      project_id TEXT NOT NULL, stage TEXT NOT NULL, status TEXT NOT NULL,
      input_hash TEXT NOT NULL DEFAULT '', output TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '',
      attempts INTEGER NOT NULL DEFAULT 0, started_at TEXT, finished_at TEXT,
      PRIMARY KEY (project_id, stage)
    );
    CREATE TABLE IF NOT EXISTS assets (
      asset_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, scene_id TEXT, kind TEXT NOT NULL, path TEXT NOT NULL,
      provider TEXT NOT NULL, model TEXT NOT NULL DEFAULT '', prompt TEXT NOT NULL DEFAULT '',
      duration_sec REAL, width INTEGER, height INTEGER, status TEXT NOT NULL DEFAULT 'draft',
      license TEXT NOT NULL DEFAULT 'unknown', cost_usd REAL NOT NULL DEFAULT 0, sha256 TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, stage TEXT NOT NULL,
      provider TEXT NOT NULL, operation TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
      duration_ms INTEGER, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
      operation TEXT NOT NULL, units REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT '',
      estimate_usd REAL NOT NULL DEFAULT 0, actual_usd REAL, asset_id TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qc_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, file TEXT NOT NULL, score REAL,
      auto_score REAL NOT NULL, verdict TEXT NOT NULL, critical INTEGER NOT NULL, created_at TEXT NOT NULL
    );
  `);
  return _db;
}

const now = () => new Date().toISOString();

export function upsertProject(id: string, brand: string, topic: string) {
  db().prepare(
    `INSERT INTO projects (id, brand, topic, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET brand=excluded.brand, topic=excluded.topic, updated_at=excluded.updated_at`,
  ).run(id, brand, topic, now(), now());
}

export function listProjects() {
  return db().prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Array<{ id: string; brand: string; topic: string; updated_at: string }>;
}

export interface StageRow {
  project_id: string; stage: Stage; status: StageStatus; input_hash: string; output: string; error: string;
  attempts: number; started_at: string | null; finished_at: string | null;
}

export function getStage(projectId: string, stage: Stage): StageRow | undefined {
  return db().prepare('SELECT * FROM stages WHERE project_id=? AND stage=?').get(projectId, stage) as StageRow | undefined;
}

export function setStage(projectId: string, stage: Stage, status: StageStatus, extra: { inputHash?: string; output?: string; error?: string } = {}) {
  const prev = getStage(projectId, stage);
  const attempts = (prev?.attempts ?? 0) + (status === 'running' ? 1 : 0);
  db().prepare(
    `INSERT INTO stages (project_id, stage, status, input_hash, output, error, attempts, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, stage) DO UPDATE SET status=excluded.status, input_hash=excluded.input_hash,
       output=excluded.output, error=excluded.error, attempts=excluded.attempts,
       started_at=COALESCE(excluded.started_at, stages.started_at), finished_at=excluded.finished_at`,
  ).run(
    projectId, stage, status,
    extra.inputHash ?? prev?.input_hash ?? '', extra.output ?? prev?.output ?? '', extra.error ?? '',
    attempts, status === 'running' ? now() : null, status === 'running' ? null : now(),
  );
  exportState(projectId);
}

/** Mark downstream stages stale when an upstream artifact changes (keeps approvals honest). */
export function invalidateAfter(projectId: string, stage: Stage) {
  const idx = STAGES.indexOf(stage);
  const later = STAGES.slice(idx + 1);
  const stmt = db().prepare(`UPDATE stages SET status='stale' WHERE project_id=? AND stage=? AND status='done'`);
  for (const s of later) stmt.run(projectId, s);
  exportState(projectId);
}

export function listStages(projectId: string): StageRow[] {
  const rows = db().prepare('SELECT * FROM stages WHERE project_id=?').all(projectId) as unknown as StageRow[];
  const byStage = new Map(rows.map((r) => [r.stage, r]));
  return STAGES.map((s) => byStage.get(s) ?? ({ project_id: projectId, stage: s, status: 'pending', input_hash: '', output: '', error: '', attempts: 0, started_at: null, finished_at: null } as StageRow));
}

export function recordJob(projectId: string, stage: string, provider: string, operation: string, status: 'ok' | 'error' | 'skipped', detail = '', durationMs?: number) {
  db().prepare('INSERT INTO jobs (project_id, stage, provider, operation, status, detail, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, stage, provider, operation, status, detail.slice(0, 2000), durationMs ?? null, now());
}

export function registerAsset(a: Omit<Asset, 'createdAt'> & { createdAt?: string }) {
  db().prepare(
    `INSERT INTO assets (asset_id, project_id, scene_id, kind, path, provider, model, prompt, duration_sec, width, height, status, license, cost_usd, sha256, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET path=excluded.path, provider=excluded.provider, model=excluded.model, prompt=excluded.prompt,
       duration_sec=excluded.duration_sec, width=excluded.width, height=excluded.height, license=excluded.license,
       cost_usd=excluded.cost_usd, sha256=excluded.sha256, created_at=excluded.created_at,
       status=CASE WHEN assets.sha256 = excluded.sha256 THEN assets.status ELSE excluded.status END`,
  ).run(
    a.assetId, a.projectId, a.sceneId ?? null, a.kind, a.path, a.provider, a.model ?? '', a.prompt ?? '',
    a.durationSec ?? null, a.width ?? null, a.height ?? null, a.status ?? 'draft', a.license ?? 'unknown',
    a.costUsd ?? 0, a.sha256 ?? '', a.createdAt ?? now(),
  );
}

export function setAssetStatus(projectId: string, assetIdPrefix: string, status: 'approved' | 'rejected' | 'draft') {
  return db().prepare(`UPDATE assets SET status=? WHERE project_id=? AND asset_id LIKE ?`).run(status, projectId, `${assetIdPrefix}%`).changes;
}

export function listAssets(projectId: string): Asset[] {
  const rows = db().prepare('SELECT * FROM assets WHERE project_id=? ORDER BY kind, asset_id').all(projectId) as Record<string, unknown>[];
  return rows.map((r) => ({
    assetId: r.asset_id as string, projectId: r.project_id as string, sceneId: (r.scene_id as string) ?? null,
    kind: r.kind as Asset['kind'], path: r.path as string, provider: r.provider as string, model: r.model as string,
    prompt: r.prompt as string, durationSec: (r.duration_sec as number) ?? null, width: (r.width as number) ?? null,
    height: (r.height as number) ?? null, status: r.status as Asset['status'], license: r.license as string,
    costUsd: r.cost_usd as number, sha256: r.sha256 as string, createdAt: r.created_at as string,
  }));
}

export function recordCost(projectId: string, c: { provider: string; model: string; operation: string; units: number; unit: string; estimateUsd: number; actualUsd?: number | null; assetId?: string }) {
  db().prepare('INSERT INTO costs (project_id, provider, model, operation, units, unit, estimate_usd, actual_usd, asset_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, c.provider, c.model, c.operation, c.units, c.unit, c.estimateUsd, c.actualUsd ?? null, c.assetId ?? null, now());
}

export function recordQc(projectId: string, file: string, score: number | null, autoScore: number, verdict: string, critical: number) {
  db().prepare('INSERT INTO qc_runs (project_id, file, score, auto_score, verdict, critical, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, file, score, autoScore, verdict, critical, now());
}

// ───────────── JSON mirrors written into the project folder ─────────────
export function exportState(projectId: string) {
  const stages = listStages(projectId);
  const jobs = db().prepare('SELECT stage, provider, operation, status, detail, duration_ms, created_at FROM jobs WHERE project_id=? ORDER BY id DESC LIMIT 50').all(projectId);
  writeJson(pp(projectId, LAYOUT.productionState), {
    projectId,
    updatedAt: now(),
    nextStage: stages.find((s) => s.status !== 'done')?.stage ?? null,
    stages: stages.map((s) => ({ stage: s.stage, status: s.status, attempts: s.attempts, output: s.output, error: s.error, finishedAt: s.finished_at })),
    recentJobs: jobs,
  });
}

export function exportAssets(projectId: string) {
  writeJson(pp(projectId, LAYOUT.assetManifest), { projectId, generatedAt: now(), assets: listAssets(projectId) });
}

export function exportCosts(projectId: string) {
  const rows = db().prepare('SELECT provider, model, operation, units, unit, estimate_usd, actual_usd, asset_id, created_at FROM costs WHERE project_id=? ORDER BY id').all(projectId) as Array<{ estimate_usd: number; actual_usd: number | null }>;
  const totalEstimate = rows.reduce((s, r) => s + r.estimate_usd, 0);
  const totalActual = rows.reduce((s, r) => s + (r.actual_usd ?? 0), 0);
  writeJson(pp(projectId, LAYOUT.costReport), {
    projectId,
    generatedAt: now(),
    mode: 'free-local',
    note: 'All generation runs locally (Remotion, Piper/SAPI, procedural audio, FFmpeg). No paid API calls are made by this system.',
    totals: { estimateUsd: Number(totalEstimate.toFixed(4)), actualUsd: Number(totalActual.toFixed(4)), operations: rows.length },
    entries: rows,
  });
}
