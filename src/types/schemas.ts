/**
 * Shared data contracts between agents, the node pipeline and the Remotion engine.
 * Every hand-off file is validated against these schemas (`npm run reel -- validate <id>`).
 * Browser-safe: no node imports (Remotion bundles this file).
 *
 * FREE / LOCAL MODE: no paid APIs. Visuals = Remotion motion graphics + SVG illustrations
 * written by the agents + the user's local footage. Voice = Piper / Windows SAPI (offline).
 * Music & SFX = procedural synthesis (pipeline/audio) or user tracks with a recorded licence.
 */
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'hex colour like #112233');

// ───────────────────────────── Brand ─────────────────────────────
/** Latin/Cyrillic families + Armenian-capable ones. Every family automatically falls back to
 *  Noto Sans Armenian for Armenian glyphs (src/utils/fonts.ts), so all brands render Armenian. */
export const FONT_FAMILIES = ['Manrope', 'Unbounded', 'Inter', 'Montserrat', 'GolosText', 'Onest', 'NotoSansArmenian', 'GoogleSans'] as const;
export const LANGUAGES = ['hy', 'ru', 'en'] as const;
export const MUSIC_PRESETS = ['cinematic-pulse', 'uplifting-corporate', 'lofi-chill', 'ambient-tech'] as const;

export const SafeZoneSchema = z.object({
  top: z.number().int().min(0),
  bottom: z.number().int().min(0),
  left: z.number().int().min(0),
  right: z.number().int().min(0),
});
export type SafeZone = z.infer<typeof SafeZoneSchema>;

export const BrandConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  instagramHandle: z.string().default(''),
  logo: z.string().default('').describe('SVG/PNG path relative to brands/<id>/'),
  colors: z.object({
    primary: hex,
    secondary: hex,
    accent: hex,
    background: hex,
    text: hex,
    textMuted: hex,
  }),
  typography: z.object({
    headingFont: z.enum(FONT_FAMILIES),
    bodyFont: z.enum(FONT_FAMILIES),
    headingWeight: z.number().int().min(400).max(800).default(800),
    bodyWeight: z.number().int().min(400).max(800).default(500),
    headingCase: z.enum(['none', 'uppercase']).default('none'),
    letterSpacingEm: z.number().default(-0.02),
  }),
  motion: z.object({
    style: z.enum(['calm', 'dynamic', 'punchy']).default('dynamic'),
    defaultTransition: z.enum(['fade', 'slide', 'wipe', 'zoom', 'blur-slide', 'none']).default('blur-slide'),
    transitionFrames: z.number().int().min(0).max(30).default(10),
    grain: z.number().min(0).max(0.3).default(0.06),
    vignette: z.number().min(0).max(1).default(0.4),
  }),
  captions: z.object({
    enabled: z.boolean().default(true),
    font: z.enum(FONT_FAMILIES),
    fontSize: z.number().int().min(44).max(110).default(70),
    color: hex,
    highlightColor: hex,
    keywordColor: hex,
    strokeColor: hex,
    strokeWidth: z.number().min(0).max(16).default(10),
    position: z.enum(['lower-third', 'center', 'upper-third']).default('lower-third'),
    maxWordsPerPage: z.number().int().min(1).max(8).default(3),
    uppercase: z.boolean().default(false),
    highlightStyle: z.enum(['color', 'pill']).default('pill').describe('pill = spoken word sits on a highlightColor pill'),
    hideWhenOnScreen: z.boolean().default(true).describe('skip a caption page that repeats the headline already on screen'),
  }),
  voice: z.object({
    engine: z.enum(['piper', 'windows-sapi', 'recorded']).default('piper').describe('recorded = your own voice, one file per scene in audio/voice/recorded/'),
    piperVoice: z.string().default('hy_AM-gor-medium').describe('fallback when the language has no entry below'),
    piperVoiceByLanguage: z.record(z.string(), z.string()).default({ hy: 'hy_AM-gor-medium', ru: 'ru_RU-dmitri-medium' }),
    sapiVoice: z.string().default('Microsoft Irina Desktop'),
    lengthScale: z.number().min(0.7).max(1.4).default(1.0).describe('>1 = slower speech (piper)'),
    sapiRate: z.number().int().min(-10).max(10).default(1),
    scenePauseSec: z.number().min(0).max(1.5).default(0.22),
  }),
  music: z.object({
    preset: z.enum(MUSIC_PRESETS).default('cinematic-pulse'),
    bpm: z.number().min(60).max(160).default(100),
    bedGainDb: z.number().max(0).default(-15).describe('music level before ducking'),
    libraryTrack: z.string().default('').describe('optional file in public/music (needs licenses.json entry)'),
  }),
  visual: z.object({
    mood: z.string(),
    backgroundPreset: z.enum(['aurora', 'particles', 'grid', 'solid']).default('aurora'),
  }),
  safeZone: SafeZoneSchema.optional(),
});
export type BrandConfig = z.infer<typeof BrandConfigSchema>;

// ───────────────────────────── Brief ─────────────────────────────
export const BriefSchema = z.object({
  projectId: z.string().regex(/^[a-z0-9-]+$/),
  topic: z.string().min(3),
  platform: z.string().default('Instagram Reels'),
  language: z.enum(LANGUAGES).default('hy').describe('hy = Eastern Armenian (reformed orthography)'),
  durationSec: z.number().min(5).max(180),
  targetAudience: z.string(),
  style: z.string(),
  format: z.string(),
  voice: z.string(),
  cta: z.string(),
  brand: z.string(),
  notes: z.string().default(''),
});
export type Brief = z.infer<typeof BriefSchema>;

// ───────────────────────────── Script ────────────────────────────
export const ScriptSceneSchema = z.object({
  sceneId: z.string().regex(/^s\d{2}$/, 'scene ids look like s01'),
  timestamp: z.string().describe('planned, e.g. 0:00-0:03; real timing comes from the voiceover'),
  visualDescription: z.string(),
  narration: z.string().describe('exact words the narrator says in this scene (can be empty)'),
  onScreenText: z.string().default(''),
  soundDirection: z.string().default(''),
  transition: z.string().default(''),
  emotionalIntent: z.string().default(''),
  pronunciation: z.string().default('').describe('optional TTS spelling override for narration, e.g. "Эй-Ай"'),
});
export type ScriptScene = z.infer<typeof ScriptSceneSchema>;
export const ScriptSchema = z.object({
  projectId: z.string(),
  language: z.string(),
  targetDurationSec: z.number(),
  wordsPerSecond: z.number().default(2.3),
  hook: z.string(),
  cta: z.string(),
  scenes: z.array(ScriptSceneSchema).min(1),
});
export type Script = z.infer<typeof ScriptSchema>;

// ─────────────────────────── Shot list ───────────────────────────
export const LAYOUTS = ['hook', 'hook-stat', 'kinetic-title', 'fullbleed', 'stat', 'list', 'quote', 'split-reveal', 'cta'] as const;
export const TRANSITIONS = ['fade', 'slide', 'wipe', 'zoom', 'blur-slide', 'none'] as const;
export const BACKGROUND_SOURCES = ['motion', 'illustration', 'local-video', 'local-image'] as const;
export const MOTION_BACKGROUNDS = ['aurora', 'particles', 'grid', 'solid'] as const;
export const SFX_KINDS = ['whoosh', 'impact', 'riser', 'click', 'pop', 'shimmer'] as const;
export const KEN_BURNS = ['in', 'out', 'left', 'right', 'none'] as const;

export const SfxCueSchema = z.object({
  kind: z.enum(SFX_KINDS),
  offsetSec: z.number().default(0).describe('relative to the scene cut'),
  gainDb: z.number().max(6).default(-10),
});
export type SfxCue = z.infer<typeof SfxCueSchema>;

export const ShotSchema = z.object({
  sceneId: z.string().regex(/^s\d{2}$/),
  plannedDurationSec: z.number().min(0.5),
  layout: z.enum(LAYOUTS),
  shotType: z.string(),
  cameraAngle: z.string(),
  cameraMovement: z.string(),
  subject: z.string(),
  environment: z.string(),
  lighting: z.string(),
  composition: z.string(),
  visualStyle: z.string(),
  motionDescription: z.string(),
  background: z.object({
    source: z.enum(BACKGROUND_SOURCES).default('motion'),
    motionPreset: z.enum(MOTION_BACKGROUNDS).default('aurora'),
    path: z.string().default('').describe('relative to project dir; svg for illustration, mp4/png/jpg for local-*'),
    kenBurns: z.enum(KEN_BURNS).default('in'),
    dim: z.number().min(0).max(0.9).default(0.35),
  }),
  illustration: z.string().default('').describe('optional SVG overlay (relative to project dir), drawn on'),
  imagePrompt: z.string().default('').describe('for optional manual generation in external free tools'),
  videoPrompt: z.string().default(''),
  negativePrompt: z.string().default(''),
  text: z.object({
    headline: z.string().default(''),
    subline: z.string().default(''),
    items: z.array(z.string()).default([]),
    stat: z
      .object({ value: z.number(), prefix: z.string().default(''), suffix: z.string().default(''), label: z.string().default(''), decimals: z.number().int().min(0).max(2).default(0) })
      .optional(),
    keywords: z.array(z.string()).default([]).describe('highlighted in headline and captions'),
    source: z.string().max(90).default('').describe('small on-screen source footnote, e.g. "Источник: Stanford AI Index 2026"'),
  }),
  transitionIn: z.enum(TRANSITIONS).default('blur-slide'),
  sfx: z.array(SfxCueSchema).default([]),
  continuityNotes: z.string().default(''),
});
export type Shot = z.infer<typeof ShotSchema>;

export const ShotListSchema = z.object({
  projectId: z.string(),
  posterSceneId: z.string().default('s01'),
  continuity: z.object({
    palette: z.string().default(''),
    recurringElements: z.string().default(''),
    lighting: z.string().default(''),
    typography: z.string().default(''),
  }),
  shots: z.array(ShotSchema).min(1),
});
export type ShotList = z.infer<typeof ShotListSchema>;

// ─────────────────────────── Assets ──────────────────────────────
export const ASSET_KINDS = ['voiceover', 'voice-scene', 'music', 'sfx', 'mix', 'illustration', 'local-video', 'local-image', 'render', 'poster', 'subtitles', 'frame'] as const;
export const AssetSchema = z.object({
  assetId: z.string(),
  projectId: z.string(),
  sceneId: z.string().nullable().default(null),
  kind: z.enum(ASSET_KINDS),
  path: z.string().describe('relative to project dir'),
  provider: z.string(),
  model: z.string().default(''),
  prompt: z.string().default(''),
  durationSec: z.number().nullable().default(null),
  width: z.number().nullable().default(null),
  height: z.number().nullable().default(null),
  status: z.enum(['draft', 'approved', 'rejected']).default('draft'),
  license: z.string().default('unknown'),
  costUsd: z.number().default(0),
  sha256: z.string().default(''),
  createdAt: z.string(),
});
export type Asset = z.infer<typeof AssetSchema>;

// ────────────────────────── Captions ─────────────────────────────
export const WordSchema = z.object({ text: z.string(), startMs: z.number(), endMs: z.number() });
export type Word = z.infer<typeof WordSchema>;

export const VoiceTimingSchema = z.object({
  engine: z.string(),
  voice: z.string(),
  totalSec: z.number(),
  leadInSec: z.number(),
  scenes: z.array(z.object({ sceneId: z.string(), startSec: z.number(), endSec: z.number(), file: z.string().nullable() })),
  words: z.array(WordSchema),
});
export type VoiceTiming = z.infer<typeof VoiceTimingSchema>;

// ────────────────────────── Timeline (Remotion input) ────────────
export const TimelineSceneSchema = z.object({
  sceneId: z.string(),
  from: z.number().int().min(0).describe('absolute start frame of the sequence'),
  cutFrame: z.number().int().min(0).describe('frame where this scene becomes the main scene'),
  durationInFrames: z.number().int().min(1).describe('includes transition overlap'),
  layout: z.enum(LAYOUTS),
  transitionIn: z.enum(TRANSITIONS),
  transitionFrames: z.number().int().min(0),
  background: z.object({
    type: z.enum(['video', 'image', 'motion', 'illustration']),
    src: z.string().default(''),
    motionPreset: z.enum(MOTION_BACKGROUNDS).default('aurora'),
    kenBurns: z.enum(KEN_BURNS).default('in'),
    dim: z.number().default(0.35),
  }),
  illustration: z.string().default(''),
  headline: z.string().default(''),
  subline: z.string().default(''),
  items: z.array(z.string()).default([]),
  stat: z.object({ value: z.number(), prefix: z.string(), suffix: z.string(), label: z.string(), decimals: z.number() }).optional(),
  keywords: z.array(z.string()).default([]),
  source: z.string().default(''),
  sceneIndex: z.number().int(),
});
export type TimelineScene = z.infer<typeof TimelineSceneSchema>;

export const TimelineSchema = z.object({
  version: z.literal(1),
  projectId: z.string(),
  fps: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  durationInFrames: z.number().int().min(1),
  brand: BrandConfigSchema,
  logoSrc: z.string().default(''),
  safeZone: SafeZoneSchema,
  scenes: z.array(TimelineSceneSchema).min(1),
  captions: z.object({ enabled: z.boolean(), words: z.array(WordSchema) }),
  audio: z.object({
    mix: z.string().default('').describe('pre-mixed, loudness-normalised track (preferred)'),
    voice: z.string().default(''),
    music: z.string().default(''),
    musicGainDb: z.number().default(-15),
  }),
  language: z.enum(LANGUAGES).default('hy'),
  mode: z.enum(['final', 'preview', 'poster']).default('final'),
});
export type Timeline = z.infer<typeof TimelineSchema>;

// ─────────────────────────── Production standards ────────────────
export const ProductionStandards = {
  width: 1080,
  height: 1920,
  fps: 30,
  videoCodec: 'h264',
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  audioSampleRate: 48000,
  audioChannels: 2,
  crf: 18,
  targetLufs: -14,
  lufsTolerance: 1,
  maxTruePeakDb: -1,
  defaultSafeZone: { top: 250, bottom: 420, left: 60, right: 140 } satisfies SafeZone,
  minCaptionFontPx: 48,
  /** Height of the caption band above the bottom safe zone (scene text never enters it). */
  captionBandHeight: 330,
} as const;
