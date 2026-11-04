/**
 * Procedural sound effects (original, royalty-free, deterministic).
 * whoosh — transitions; impact — hook / reveals; riser — build into a key moment;
 * click / pop — list items, UI; shimmer — sparkle on stats/CTA; ambient — room-tone bed.
 */
import { SR, buf, rng, Biquad, reverb, mixInto, master, fade } from './dsp.js';
import type { SfxCue } from '../../src/types/schemas.js';

export type SfxKind = SfxCue['kind'];

export function synthSfx(kind: SfxKind, seed = 1): [Float32Array, Float32Array] {
  const rand = rng(seed * 977 + kind.length);
  switch (kind) {
    case 'whoosh': {
      const d = 0.75, L = buf(d), R = buf(d);
      const bp = new Biquad('bandpass', 400, 1.1), lp = new Biquad('lowpass', 250, 0.7);
      for (let i = 0; i < L.length; i++) {
        const t = i / L.length;
        if (i % 32 === 0) bp.set(300 + 3200 * Math.sin(Math.PI * Math.pow(t, 0.8)), 1.1);
        const n = rand() * 2 - 1;
        const env = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 2);
        const v = (bp.process(n) * 1.4 + lp.process(n) * 0.5) * env;
        const p = t; // pan left → right
        L[i] = v * Math.cos((p * Math.PI) / 2); R[i] = v * Math.sin((p * Math.PI) / 2);
      }
      master([L, R], -3, 1);
      return [L, R];
    }
    case 'impact': {
      const d = 1.8, M = buf(d);
      let ph = 0;
      const lp = new Biquad('lowpass', 1800, 0.7);
      for (let i = 0; i < M.length; i++) {
        const t = i / SR;
        ph += (2 * Math.PI * (32 + 70 * Math.exp(-t / 0.08))) / SR;
        const boom = Math.tanh(Math.sin(ph) * 2) * Math.exp(-t / 0.45);
        const crack = lp.process(rand() * 2 - 1) * Math.exp(-t / 0.05);
        M[i] = boom * 0.9 + crack * 0.6;
      }
      const tailL = reverb(M, { room: 0.88, damp: 0.5 }), tailR = reverb(M, { room: 0.88, damp: 0.5, seedOffset: 19 });
      const L = new Float32Array(M), R = new Float32Array(M);
      mixInto(L, tailL, 0.5); mixInto(R, tailR, 0.5);
      fade(L, 0, 0.4); fade(R, 0, 0.4);
      master([L, R], -2, 1.2);
      return [L, R];
    }
    case 'riser': {
      const d = 1.6, L = buf(d), R = buf(d);
      const hp = new Biquad('highpass', 200, 0.9);
      let ph = 0;
      for (let i = 0; i < L.length; i++) {
        const t = i / L.length;
        if (i % 32 === 0) hp.set(200 + 6000 * t * t, 0.9);
        ph += (2 * Math.PI * (180 + 1100 * t * t)) / SR;
        const env = Math.pow(t, 2.2) * (t > 0.97 ? (1 - t) / 0.03 : 1);
        const v = (hp.process(rand() * 2 - 1) * 0.8 + Math.sin(ph) * 0.35) * env;
        L[i] = v; R[i] = v * (0.85 + 0.15 * Math.sin(t * 40));
      }
      master([L, R], -3, 1);
      return [L, R];
    }
    case 'click': {
      const d = 0.09, M = buf(d);
      for (let i = 0; i < M.length; i++) { const t = i / SR; M[i] = (Math.sin(2 * Math.PI * 2300 * t) * 0.7 + (rand() * 2 - 1) * 0.3) * Math.exp(-t / 0.008); }
      master([M], -4, 1);
      return [M, new Float32Array(M)];
    }
    case 'pop': {
      const d = 0.22, M = buf(d);
      let ph = 0;
      for (let i = 0; i < M.length; i++) { const t = i / SR; ph += (2 * Math.PI * (320 + 700 * Math.exp(-t / 0.025))) / SR; M[i] = Math.sin(ph) * Math.exp(-t / 0.05); }
      master([M], -4, 1);
      return [M, new Float32Array(M)];
    }
    case 'shimmer': {
      const d = 1.6, M = buf(d);
      const notes = [2093, 2637, 3136, 3951, 4186, 5274];
      for (let k = 0; k < 14; k++) {
        const f = notes[Math.floor(rand() * notes.length)] * (1 + (rand() - 0.5) * 0.004);
        const start = Math.floor(rand() * 0.5 * SR);
        for (let i = 0; i < 0.6 * SR && start + i < M.length; i++) { const t = i / SR; M[start + i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.18) * 0.12; }
      }
      const L = reverb(M, { room: 0.86, damp: 0.25 }), R = reverb(M, { room: 0.86, damp: 0.25, seedOffset: 31 });
      mixInto(L, M, 0.6); mixInto(R, M, 0.6);
      fade(L, 0, 0.5); fade(R, 0, 0.5);
      master([L, R], -4, 1);
      return [L, R];
    }
  }
}

/** Quiet room-tone / air bed (separate "ambient" track). */
export function synthAmbient(durationSec: number, seed = 3): [Float32Array, Float32Array] {
  const rand = rng(seed);
  const L = buf(durationSec), R = buf(durationSec);
  let bl = 0, br = 0;
  const lpL = new Biquad('lowpass', 700, 0.5), lpR = new Biquad('lowpass', 700, 0.5);
  for (let i = 0; i < L.length; i++) {
    bl = (bl + 0.02 * (rand() * 2 - 1)) / 1.02; // brown noise
    br = (br + 0.02 * (rand() * 2 - 1)) / 1.02;
    const swell = 0.8 + 0.2 * Math.sin((2 * Math.PI * i) / SR / 7);
    L[i] = lpL.process(bl) * swell; R[i] = lpR.process(br) * swell;
  }
  fade(L, 1, 1.5); fade(R, 1, 1.5);
  master([L, R], -6, 1);
  return [L, R];
}
