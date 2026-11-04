/**
 * Provider interfaces. Every engine is swappable: the pipeline only talks to these contracts.
 * Current implementations are all FREE and LOCAL. A future paid provider (ElevenLabs, Runway, fal…)
 * would implement the same interface — see docs/API-INTEGRATIONS.md for the verified facts and the
 * rules (approval gate, budget guard) that must be added before any paid call.
 */
export interface SpeechRequest {
  sceneId: string;
  /** Text sent to the TTS engine (may contain pronunciation overrides). */
  ttsText: string;
  /** Text shown in captions (the script's narration). */
  displayText: string;
}

export interface SpeechSegment { start: number; end: number }

export interface SceneSpeech {
  sceneId: string;
  file: string; // absolute path to the engine's wav
  durationSec: number;
  /** Word-like segments in seconds relative to the file start. */
  segments: SpeechSegment[];
  /** true when segments are real word alignments (Piper), false when estimated. */
  exactTiming: boolean;
}

export interface VoiceEngine {
  readonly id: 'piper' | 'windows-sapi' | 'recorded';
  readonly voice: string;
  /** null when ready, otherwise a human-readable reason + how to fix. */
  check(): Promise<string | null>;
  synthesize(requests: SpeechRequest[], outDir: string, opts: { lengthScale: number }): Promise<SceneSpeech[]>;
}

export interface Provenance {
  provider: string;
  model: string;
  license: string;
}
