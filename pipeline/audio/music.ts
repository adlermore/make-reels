/**
 * Procedural background music. Original, deterministic (seeded), royalty-free by construction.
 * Not a replacement for a composer — a clean, unobtrusive bed that sits under a voiceover.
 */
import {
  SR, buf, rng, midiToHz, oscNote, fmNote, pluck, kick, snare, hat, filterSweep, reverb, mixInto, fade, master, pan,
} from './dsp.js';
import type { BrandConfig } from '../../src/types/schemas.js';

export type MusicPreset = BrandConfig['music']['preset'];

interface PresetDef {
  key: string;
  chords: number[][]; // midi notes, one chord per bar
  bass: number[];     // midi root per bar
  defaultBpm: number;
}

const PRESETS: Record<MusicPreset, PresetDef> = {
  'cinematic-pulse': { key: 'A minor', chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]], bass: [33, 29, 36, 31], defaultBpm: 100 },
  'uplifting-corporate': { key: 'C major', chords: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]], bass: [36, 31, 33, 29], defaultBpm: 112 },
  'lofi-chill': { key: 'D minor', chords: [[50, 57, 60, 65], [48, 55, 60, 64], [46, 53, 57, 62], [48, 55, 58, 64]], bass: [38, 33, 34, 36], defaultBpm: 82 },
  'ambient-tech': { key: 'E minor', chords: [[52, 59, 64, 67], [48, 55, 59, 64], [55, 59, 62, 67], [50, 57, 62, 66]], bass: [40, 36, 43, 38], defaultBpm: 90 },
};

export interface MusicResult {
  channels: [Float32Array, Float32Array];
  meta: { preset: MusicPreset; bpm: number; key: string; seed: number; durationSec: number; bars: number; license: string; generator: string };
}

export function generateMusic(o: { preset: MusicPreset; bpm?: number; durationSec: number; seed?: number }): MusicResult {
  const def = PRESETS[o.preset];
  const bpm = o.bpm ?? def.defaultBpm;
  const seed = o.seed ?? 7;
  const rand = rng(seed);
  const beat = 60 / bpm;
  const bar = beat * 4;
  const dur = o.durationSec;
  const bars = Math.ceil(dur / bar) + 1;

  // mono busses
  const pad = buf(dur + 3), padR = buf(dur + 3);
  const bass = buf(dur + 3);
  const drums = buf(dur + 3);
  const lead = buf(dur + 3);
  const air = buf(dur + 3);

  const intensity = (b: number) => (b < 1 ? 0.35 : b < 2 ? 0.7 : b >= bars - 2 ? 0.75 : 1);

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    if (t0 > dur) break;
    const chord = def.chords[b % def.chords.length];
    const root = def.bass[b % def.bass.length];
    const lvl = intensity(b);

    switch (o.preset) {
      case 'cinematic-pulse': {
        for (const n of chord) {
          oscNote(pad, t0, bar, midiToHz(n), { wave: 'warm', gain: 0.05, a: 0.5, d: 0.3, s: 0.85, r: 0.9, detuneCents: -7 });
          oscNote(padR, t0, bar, midiToHz(n), { wave: 'warm', gain: 0.05, a: 0.5, d: 0.3, s: 0.85, r: 0.9, detuneCents: 7 });
          oscNote(pad, t0, bar, midiToHz(n - 12), { wave: 'saw', gain: 0.018, a: 0.8, s: 0.8, r: 0.9 });
        }
        if (b >= 1) for (let e = 0; e < 8; e++) oscNote(bass, t0 + e * beat * 0.5, beat * 0.32, midiToHz(root + 12), { wave: 'saw', gain: 0.11 * lvl, a: 0.004, d: 0.12, s: 0.35, r: 0.06 });
        if (b >= 1) { kick(drums, t0, 0.55 * lvl); kick(drums, t0 + 2 * beat, 0.5 * lvl); }
        if (b >= 2) for (let e = 0; e < 4; e++) hat(drums, t0 + e * beat + beat / 2, rand, 0.045 * lvl);
        if (b >= 2) for (let e = 0; e < 8; e++) pluck(lead, t0 + e * beat * 0.5, midiToHz(chord[e % chord.length] + 12), { gain: 0.05 * lvl, decay: 0.9, brightness: 0.3, rand });
        break;
      }
      case 'uplifting-corporate': {
        for (const n of chord) {
          oscNote(pad, t0, bar, midiToHz(n), { wave: 'warm', gain: 0.03, a: 0.3, s: 0.8, r: 0.6, detuneCents: -5 });
          oscNote(padR, t0, bar, midiToHz(n), { wave: 'warm', gain: 0.03, a: 0.3, s: 0.8, r: 0.6, detuneCents: 5 });
        }
        const arp = [0, 1, 2, 1, 0, 2, 1, 2];
        for (let e = 0; e < 8; e++) pluck(lead, t0 + e * beat * 0.5, midiToHz(chord[arp[e] % chord.length] + 12), { gain: 0.11 * lvl, decay: 1.0, brightness: 0.6, rand });
        if (b >= 1) for (let e = 0; e < 8; e++) oscNote(bass, t0 + e * beat * 0.5, beat * 0.4, midiToHz(root + 12), { wave: 'square', gain: 0.07 * lvl, a: 0.005, d: 0.1, s: 0.5, r: 0.05 });
        if (b >= 1) {
          for (let e = 0; e < 4; e++) kick(drums, t0 + e * beat, 0.45 * lvl);
          snare(drums, t0 + beat, rand, 0.25 * lvl); snare(drums, t0 + 3 * beat, rand, 0.25 * lvl);
          for (let e = 0; e < 4; e++) hat(drums, t0 + e * beat + beat / 2, rand, 0.05 * lvl, true);
        }
        break;
      }
      case 'lofi-chill': {
        fmNote(pad, t0, midiToHz(chord[0]), { gain: 0.06, decay: 1.6, index: 1.4 });
        for (const n of chord.slice(1)) { fmNote(pad, t0 + 0.02, midiToHz(n), { gain: 0.05, decay: 1.6, index: 1.2 }); fmNote(padR, t0 + 2.5 * beat, midiToHz(n), { gain: 0.035, decay: 1.0, index: 1 }); }
        oscNote(bass, t0, beat * 1.5, midiToHz(root), { wave: 'sine', gain: 0.22, a: 0.01, d: 0.3, s: 0.6, r: 0.15 });
        oscNote(bass, t0 + 2 * beat, beat * 1.2, midiToHz(root), { wave: 'sine', gain: 0.18, a: 0.01, d: 0.3, s: 0.6, r: 0.15 });
        if (b >= 1) {
          kick(drums, t0, 0.45 * lvl); kick(drums, t0 + 2.75 * beat, 0.35 * lvl);
          snare(drums, t0 + beat, rand, 0.16 * lvl); snare(drums, t0 + 3 * beat, rand, 0.16 * lvl);
          for (let e = 0; e < 8; e++) hat(drums, t0 + e * beat * 0.5 + (e % 2 ? beat * 0.08 : 0), rand, 0.03 * lvl);
        }
        break;
      }
      case 'ambient-tech': {
        for (const n of chord) {
          oscNote(pad, t0, bar, midiToHz(n), { wave: 'warm', gain: 0.045, a: 1.2, s: 0.9, r: 1.4, detuneCents: -9, vibrato: 0.002 });
          oscNote(padR, t0, bar, midiToHz(n), { wave: 'warm', gain: 0.045, a: 1.2, s: 0.9, r: 1.4, detuneCents: 9, vibrato: 0.002 });
        }
        oscNote(bass, t0, bar, midiToHz(root - 12), { wave: 'sine', gain: 0.12, a: 0.8, s: 0.9, r: 1.0 });
        if (b >= 1) for (let e = 0; e < 8; e++) {
          const n = chord[(e * 2 + b) % chord.length] + 24;
          fmNote(lead, t0 + e * beat * 0.5, midiToHz(n), { gain: 0.035 * lvl, decay: 0.5, ratio: 2, index: 0.8 });
          fmNote(lead, t0 + e * beat * 0.5 + beat * 0.75, midiToHz(n), { gain: 0.014 * lvl, decay: 0.5, ratio: 2, index: 0.8 }); // echo
        }
        break;
      }
    }
  }

  // tone shaping
  filterSweep(bass, 'lowpass', () => (o.preset === 'lofi-chill' ? 300 : 650), 0.9);
  filterSweep(pad, 'lowpass', (t) => Math.min(4200, 700 + (t / Math.max(1, bar * 2)) * 2500), 0.6);
  filterSweep(padR, 'lowpass', (t) => Math.min(4200, 700 + (t / Math.max(1, bar * 2)) * 2500), 0.6);
  filterSweep(lead, 'highpass', () => 180, 0.7);

  // subtle air / vinyl texture
  for (let i = 0; i < air.length; i++) air[i] = (rand() * 2 - 1) * (o.preset === 'lofi-chill' ? 0.012 : 0.004);
  filterSweep(air, 'lowpass', () => 2500);
  if (o.preset === 'lofi-chill') for (let k = 0; k < dur * 6; k++) air[Math.floor(rand() * air.length)] += (rand() - 0.5) * 0.25;

  // stereo bus
  const L = buf(dur), R = buf(dur);
  const add = (l: Float32Array, r: Float32Array, g = 1) => { mixInto(L, l, g); mixInto(R, r, g); };
  add(...pan(pad, -0.35)); add(...pan(padR, 0.35));
  add(...pan(bass, 0)); add(...pan(drums, 0)); add(...pan(lead, 0.15)); add(...pan(air, 0));

  const send = buf(dur + 3);
  mixInto(send, pad, 0.6); mixInto(send, padR, 0.6); mixInto(send, lead, 0.8); mixInto(send, drums, 0.08);
  const revL = reverb(send, { room: 0.84, damp: 0.4 });
  const revR = reverb(send, { room: 0.84, damp: 0.4, seedOffset: 23 });
  mixInto(L, revL, 0.35); mixInto(R, revR, 0.35);

  fade(L, 0.05, Math.min(2.0, dur * 0.15)); fade(R, 0.05, Math.min(2.0, dur * 0.15));
  master([L, R], -3, 1.15);

  return {
    channels: [L, R],
    meta: {
      preset: o.preset, bpm, key: def.key, seed, durationSec: dur, bars,
      license: 'Original procedural composition generated locally by make-reels (pipeline/audio/music.ts). No third-party samples. Free for commercial use.',
      generator: `make-reels procedural synth @ ${SR} Hz`,
    },
  };
}
