import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { z } from 'zod';
import { PipelineError } from './log.js';

export const exists = (p: string) => fs.existsSync(p);

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readText(p: string): string {
  if (!exists(p)) throw new PipelineError(`Missing file: ${p}`);
  return fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
}

/** Atomic write: temp file + rename, so an interrupted run never leaves half-written JSON. */
export function writeText(p: string, content: string) {
  ensureDir(path.dirname(p));
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, p);
}

export function writeJson(p: string, data: unknown) {
  writeText(p, JSON.stringify(data, null, 2) + '\n');
}

export function readJson<T extends z.ZodTypeAny>(p: string, schema: T): z.infer<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(readText(p));
  } catch (e) {
    if (e instanceof PipelineError) throw e;
    throw new PipelineError(`Invalid JSON in ${p}: ${(e as Error).message}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 12).map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new PipelineError(`Schema validation failed for ${p}:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

export function sha256File(p: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

export function sha256(...parts: unknown[]): string {
  const h = crypto.createHash('sha256');
  for (const part of parts) h.update(typeof part === 'string' ? part : JSON.stringify(part));
  return h.digest('hex').slice(0, 16);
}
