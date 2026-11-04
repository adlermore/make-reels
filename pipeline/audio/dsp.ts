/**
 * Minimal DSP toolkit for procedural music & sound design (pure TypeScript, no deps).
 * All buffers are Float32Array in [-1, 1] at SR Hz.
 */
import fs from 'node:fs';
import path from 'node:path';

export const SR = 48000;

// ───────────── randomness (deterministic: same seed → same audio) ─────────────
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const buf = (sec: number) => new Float32Array(Math.max(1, Math.ceil(sec * SR)));

// ───────────── band-limited wavetables ─────────────
const TABLE = 4096;
function makeTable(harmonics: (n: number) => number, count: number) {
  const t = new Float32Array(TABLE + 1);
  for (let i = 0; i <= TABLE; i++) {
    let v = 0;
    for (let n = 1; n <= count; n++) v += harmonics(n) * Math.sin((2 * Math.PI * n * i) / TABLE);
    t[i] = v;
  }
  let peak = 0;
  for (const v of t) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i <= TABLE; i++) t[i] /= peak;
  return t;
}
export const WAVES = {
  sine: makeTable((n) => (n === 1 ? 1 : 0), 1),
  saw: makeTable((n) => 1 / n, 24),
  square: makeTable((n) => (n % 2 ? 1 / n : 0), 23),
  warm: makeTable((n) => 1 / (n * n * 0.6 + 0.4), 12), // soft, string-like
};
export type Wave = keyof typeof WAVES;

/** Render an oscillator note into dst (additive). Envelope: attack/decay/sustain/release in seconds. */
export function oscNote(
  dst: Float32Array, startSec: number, durSec: number, freq: number,
  o: { wave?: Wave; gain?: number; a?: number; d?: number; s?: number; r?: number; detuneCents?: number; vibrato?: number },
) {
  const table = WAVES[o.wave ?? 'sine'];
  const gain = o.gain ?? 0.2, a = o.a ?? 0.01, d = o.d ?? 0.1, s = o.s ?? 0.7, r = o.r ?? 0.2;
  const f = freq * Math.pow(2, (o.detuneCents ?? 0) / 1200);
  const start = Math.floor(startSec * SR);
  const total = Math.floor((durSec + r) * SR);
  let phase = ((f * 7.919) % 1) * TABLE; // deterministic per-frequency start phase
  for (let i = 0; i < total; i++) {
    const idx = start + i;
    if (idx >= dst.length) break;
    if (idx < 0) continue;
    const t = i / SR;
    let env: number;
    if (t < a) env = t / a;
    else if (t < a + d) env = 1 - (1 - s) * ((t - a) / d);
    else if (t < durSec) env = s;
    else env = s * Math.max(0, 1 - (t - durSec) / r);
    const vib = o.vibrato ? 1 + o.vibrato * Math.sin(2 * Math.PI * 5 * t) : 1;
    phase += (f * vib * TABLE) / SR;
    if (phase >= TABLE) phase -= TABLE * Math.floor(phase / TABLE);
    const ip = Math.floor(phase), frac = phase - ip;
    const v = table[ip] + (table[ip + 1] - table[ip]) * frac;
    dst[idx] += v * env * gain;
  }
}

/** Two-operator FM "electric piano / bell". */
export function fmNote(dst: Float32Array, startSec: number, freq: number, o: { gain?: number; decay?: number; ratio?: number; index?: number }) {
  const gain = o.gain ?? 0.15, decay = o.decay ?? 1.2, ratio = o.ratio ?? 1, index = o.index ?? 2;
  const start = Math.floor(startSec * SR);
  const total = Math.floor(decay * 3 * SR);
  for (let i = 0; i < total; i++) {
    const idx = start + i;
    if (idx >= dst.length) break;
    const t = i / SR;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.004);
    const modEnv = Math.exp(-t / (decay * 0.3));
    const m = Math.sin(2 * Math.PI * freq * ratio * t) * index * modEnv;
    dst[idx] += Math.sin(2 * Math.PI * freq * t + m) * env * gain;
  }
}

/** Karplus–Strong plucked string. */
export function pluck(dst: Float32Array, startSec: number, freq: number, o: { gain?: number; decay?: number; brightness?: number; rand: () => number }) {
  const n = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(n);
  for (let i = 0; i < n; i++) line[i] = o.rand() * 2 - 1;
  const total = Math.floor((o.decay ?? 1.5) * SR);
  const start = Math.floor(startSec * SR);
  const w = 0.5 - 0.3 * (o.brightness ?? 0.5); // less smoothing = brighter
  let p = 0;
  for (let i = 0; i < total; i++) {
    const idx = start + i;
    if (idx >= dst.length) break;
    const next = (p + 1) % n;
    const v = line[p];
    line[p] = 0.996 * ((1 - w) * v + w * line[next]);
    const fade = i > total - 2000 ? (total - i) / 2000 : 1;
    dst[idx] += v * (o.gain ?? 0.2) * fade;
    p = next;
  }
}

// ───────────── drums ─────────────
export function kick(dst: Float32Array, at: number, gain = 0.8) {
  const s = Math.floor(at * SR), len = Math.floor(0.45 * SR);
  let ph = 0;
  for (let i = 0; i < len && s + i < dst.length; i++) {
    const t = i / SR;
    const f = 45 + 95 * Math.exp(-t / 0.035);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t / 0.16);
    const click = i < 90 ? (1 - i / 90) * 0.3 : 0;
    dst[s + i] += (Math.tanh(Math.sin(ph) * 1.6) * env + click) * gain;
  }
}

export function snare(dst: Float32Array, at: number, rand: () => number, gain = 0.35) {
  const s = Math.floor(at * SR), len = Math.floor(0.25 * SR);
  const bp = new Biquad('bandpass', 1800, 0.8);
  for (let i = 0; i < len && s + i < dst.length; i++) {
    const t = i / SR;
    const noise = bp.process(rand() * 2 - 1) * Math.exp(-t / 0.07);
    const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t / 0.05) * 0.5;
    dst[s + i] += (noise * 1.6 + tone) * gain;
  }
}

export function hat(dst: Float32Array, at: number, rand: () => number, gain = 0.12, open = false) {
  const s = Math.floor(at * SR), dec = open ? 0.16 : 0.035, len = Math.floor(dec * 5 * SR);
  const hp = new Biquad('highpass', 7500, 0.7);
  for (let i = 0; i < len && s + i < dst.length; i++) {
    dst[s + i] += hp.process(rand() * 2 - 1) * Math.exp(-i / SR / dec) * gain;
  }
}

// ───────────── filters ─────────────
export class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(private type: 'lowpass' | 'highpass' | 'bandpass', freq: number, q = 0.707) {
    this.set(freq, q);
  }
  set(freq: number, q = 0.707) {
    const w = (2 * Math.PI * Math.min(freq, SR * 0.45)) / SR;
    const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (this.type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
    else if (this.type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cos) / a0; this.a2 = (1 - alpha) / a0;
  }
  process(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** In-place filter with a cutoff that can change over time (recomputed every 64 samples). */
export function filterSweep(b: Float32Array, type: 'lowpass' | 'highpass' | 'bandpass', cutoffAt: (sec: number) => number, q = 0.707) {
  const f = new Biquad(type, cutoffAt(0), q);
  for (let i = 0; i < b.length; i++) {
    if (i % 64 === 0) f.set(cutoffAt(i / SR), q);
    b[i] = f.process(b[i]);
  }
}

// ───────────── reverb (Schroeder/Freeverb-lite) ─────────────
export function reverb(input: Float32Array, o: { room?: number; damp?: number; seedOffset?: number } = {}): Float32Array {
  const room = o.room ?? 0.82, damp = o.damp ?? 0.35, off = o.seedOffset ?? 0;
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => d + off);
  const allp = [556, 441, 341].map((d) => d + Math.floor(off / 2));
  const out = new Float32Array(input.length);
  for (const d of combs) {
    const line = new Float32Array(d);
    let p = 0, store = 0;
    for (let i = 0; i < input.length; i++) {
      const y = line[p];
      store = y * (1 - damp) + store * damp;
      line[p] = input[i] + store * room;
      out[i] += y / combs.length;
      p = (p + 1) % d;
    }
  }
  for (const d of allp) {
    const line = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < out.length; i++) {
      const bufv = line[p];
      const y = -out[i] + bufv;
      line[p] = out[i] + bufv * 0.5;
      out[i] = y;
      p = (p + 1) % d;
    }
  }
  return out;
}

// ───────────── utilities ─────────────
export function mixInto(dst: Float32Array, src: Float32Array, gain = 1, offsetSamples = 0) {
  for (let i = 0; i < src.length; i++) {
    const j = i + offsetSamples;
    if (j < 0) continue;
    if (j >= dst.length) break;
    dst[j] += src[i] * gain;
  }
}

export function fade(b: Float32Array, inSec: number, outSec: number) {
  const fi = Math.floor(inSec * SR), fo = Math.floor(outSec * SR);
  for (let i = 0; i < fi && i < b.length; i++) b[i] *= i / fi;
  for (let i = 0; i < fo && i < b.length; i++) b[b.length - 1 - i] *= i / fo;
}

export function peak(...bs: Float32Array[]) {
  let p = 0;
  for (const b of bs) for (let i = 0; i < b.length; i++) { const v = Math.abs(b[i]); if (v > p) p = v; }
  return p;
}

/** Soft-clip then normalise all channels together to the given peak dBFS. */
export function master(chs: Float32Array[], peakDb = -3, drive = 1.1) {
  const k = Math.tanh(drive);
  for (const b of chs) for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * drive) / k;
  const p = peak(...chs);
  if (p > 0) {
    const g = dbToGain(peakDb) / p;
    for (const b of chs) for (let i = 0; i < b.length; i++) b[i] *= g;
  }
}

export function pan(mono: Float32Array, p: number): [Float32Array, Float32Array] {
  const a = ((p + 1) * Math.PI) / 4;
  const l = new Float32Array(mono.length), r = new Float32Array(mono.length);
  const gl = Math.cos(a), gr = Math.sin(a);
  for (let i = 0; i < mono.length; i++) { l[i] = mono[i] * gl; r[i] = mono[i] * gr; }
  return [l, r];
}

/** Write 16-bit PCM WAV (interleaved). */
export function writeWav(file: string, chs: Float32Array[], sampleRate = SR) {
  const n = chs[0].length, c = chs.length;
  const data = Buffer.alloc(n * c * 2);
  let o = 0;
  for (let i = 0; i < n; i++) for (let ch = 0; ch < c; ch++) {
    const v = Math.max(-1, Math.min(1, chs[ch][i]));
    data.writeInt16LE(Math.round(v * 32767), o);
    o += 2;
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(c, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * c * 2, 28); h.writeUInt16LE(c * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
