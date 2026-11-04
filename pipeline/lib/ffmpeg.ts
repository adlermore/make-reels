import { run } from './proc.js';

export const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export async function ffmpeg(args: string[], timeoutMs = 10 * 60_000) {
  return run(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...args], { timeoutMs });
}

/** Runs ffmpeg for analysis filters (output to null); returns stderr where filters print. */
export async function ffmpegAnalyze(input: string, filterArgs: string[], timeoutMs = 5 * 60_000, inputArgs: string[] = []): Promise<string> {
  // inputArgs go BEFORE -i (e.g. ['-ss','9.1'] = input seek, so filters only see that part)
  const r = await run(FFMPEG, ['-hide_banner', '-nostdin', ...inputArgs, '-i', input, ...filterArgs, '-f', 'null', '-'], { timeoutMs, allowFail: true });
  return r.stderr;
}

export interface ProbeStream {
  index: number;
  codec_type: 'video' | 'audio' | string;
  codec_name: string;
  profile?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
  nb_frames?: string;
  bit_rate?: string;
}
export interface ProbeResult {
  streams: ProbeStream[];
  format: { format_name: string; duration: string; size: string; bit_rate: string };
}

export async function ffprobe(file: string): Promise<ProbeResult> {
  const r = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { timeoutMs: 60_000 });
  return JSON.parse(r.stdout) as ProbeResult;
}

export async function mediaDuration(file: string): Promise<number> {
  const p = await ffprobe(file);
  return Number(p.format.duration);
}

export const fraction = (s?: string) => {
  if (!s) return NaN;
  const [a, b] = s.split('/').map(Number);
  return b ? a / b : a;
};
