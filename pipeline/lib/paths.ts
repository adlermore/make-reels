import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJECTS_DIR = path.join(ROOT, 'projects');
export const BRANDS_DIR = path.join(ROOT, 'brands');
export const DATA_DIR = path.join(ROOT, 'data');
export const TOOLS_DIR = path.join(ROOT, 'tools');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const VENV_PYTHON = path.join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const PIPER_VOICES_DIR = path.join(TOOLS_DIR, 'piper-voices');

/** Relative layout of a project folder. All paths are relative to the project dir. */
export const LAYOUT = {
  brief: 'brief/brief.md',
  briefJson: 'brief/brief.json',
  brandSnapshot: 'brand/brand-config.json',
  references: 'references',
  research: 'research/research-report.md',
  creative: 'creative/creative-direction.md',
  scriptMd: 'script/script.md',
  scriptJson: 'script/script.json',
  storyboardMd: 'storyboard/storyboard.md',
  shotList: 'storyboard/shot-list.json',
  illustrations: 'assets/illustrations',
  localMedia: 'assets/local',
  soundPlanMd: 'audio/sound-design-plan.md',
  voiceDir: 'audio/voice',
  voiceTrack: 'audio/voice/voiceover.wav',
  voiceTiming: 'audio/voice/voice-timing.json',
  music: 'audio/music/music.wav',
  musicMeta: 'audio/music/music.json',
  sfxDir: 'audio/sfx',
  sfxPlan: 'audio/sfx/sfx-plan.json',
  mixFull: 'audio/mix/mix-full.wav',
  mixNoMusic: 'audio/mix/mix-no-music.wav',
  mixReport: 'audio/mix/mix-report.json',
  timeline: 'timeline.json',
  renders: 'renders',
  preview: 'renders/preview.mp4',
  final: 'renders/final.mp4',
  finalNoMusic: 'renders/final-no-music.mp4',
  poster: 'renders/poster.png',
  srt: 'renders/subtitles.srt',
  storyboardFrames: 'reports/storyboard-frames',
  storyboardSheet: 'reports/storyboard-contact-sheet.png',
  qcFrames: 'reports/frames',
  qcAuto: 'reports/qc-auto.json',
  qcReview: 'reports/qc-review.json',
  qcReport: 'reports/quality-report.md',
  qcReportJson: 'reports/quality-report.json',
  assetManifest: 'asset-manifest.json',
  productionState: 'production-state.json',
  costReport: 'production-cost-report.json',
  publishKit: 'publish-kit.md',
  readme: 'README.md',
} as const;

export function projectDir(projectId: string): string {
  if (!/^[a-z0-9-]+$/.test(projectId)) throw new Error(`Invalid project id "${projectId}" (use a-z, 0-9, -)`);
  return path.join(PROJECTS_DIR, projectId);
}

export function pp(projectId: string, rel: string): string {
  return path.join(projectDir(projectId), rel);
}

/** Forward-slash relative path (used inside JSON and for Remotion staticFile). */
export function relPosix(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join('/');
}
