/**
 * Check an Armenian locale file against its source (JSON, nested objects allowed):
 * same keys, same placeholders per key, and Armenian lint on every value.
 * Usage: npm run lint:hy-strings -- <source.json> <target.json>
 */
import fs from 'node:fs';
import { lintArmenian } from '../pipeline/lib/lint-hy.js';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function flatten(obj: Json, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof obj === 'string') out[prefix] = obj;
  else if (Array.isArray(obj)) obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

// {name} {{count}} %s %d %1$s <tag> </tag> \n and ICU argument names
const PLACEHOLDER = /\{\{\s*[\w.]+\s*\}\}|\{\s*[\w.]+\s*(?:,[^{}]*)?\}|%(?:\d+\$)?[sdif]|<\/?[a-z][^>]*>|\\n/gi;
const placeholders = (s: string) => (s.match(PLACEHOLDER) ?? []).map((p) => p.replace(/\s+/g, '').replace(/,.*\}$/, '}')).sort();

export function lintStrings(source: Json, target: Json) {
  const src = flatten(source), tgt = flatten(target);
  const errors: string[] = [], warnings: string[] = [];
  for (const k of Object.keys(src)) if (!(k in tgt)) errors.push(`missing key: ${k}`);
  for (const k of Object.keys(tgt)) if (!(k in src)) errors.push(`extra key (not in source): ${k}`);
  for (const [k, v] of Object.entries(tgt)) {
    if (!(k in src)) continue;
    const a = placeholders(src[k]).join(' '), b = placeholders(v).join(' ');
    if (a !== b) errors.push(`${k}: placeholders differ — source [${a}] vs target [${b}]`);
    if (v.trim() === src[k].trim() && /[A-Za-zА-Яа-я]{3,}/.test(v)) warnings.push(`${k}: value is identical to the source (untranslated?)`);
    const l = lintArmenian(v, k, 'screen');
    errors.push(...l.errors);
    warnings.push(...l.warnings);
  }
  return { errors, warnings, keys: Object.keys(tgt).length };
}

if (process.argv[1] && /lint-hy-strings/.test(process.argv[1])) {
  const [srcPath, tgtPath] = process.argv.slice(2);
  if (!srcPath || !tgtPath) {
    console.error('usage: npm run lint:hy-strings -- <source.json> <target.json>');
    process.exit(1);
  }
  const r = lintStrings(JSON.parse(fs.readFileSync(srcPath, 'utf8')), JSON.parse(fs.readFileSync(tgtPath, 'utf8')));
  r.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  r.errors.forEach((e) => console.log(`  ✖ ${e}`));
  console.log(r.errors.length ? `✖ ${r.errors.length} error(s) in ${r.keys} strings` : `✔ ${r.keys} strings OK`);
  process.exitCode = r.errors.length ? 1 : 0;
}
