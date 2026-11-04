const c = (code: number) => (s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
export const color = { dim: c(2), red: c(31), green: c(32), yellow: c(33), blue: c(34), magenta: c(35), cyan: c(36), bold: c(1) };

/** Redact anything that looks like a secret before it reaches logs. */
export function redact(s: string): string {
  return s
    .replace(/((?:api[_-]?key|token|secret|password|authorization|xi-api-key)["']?\s*[:=]\s*["']?)([^\s"',]{6,})/gi, '$1***')
    .replace(/(Bearer|Key)\s+[A-Za-z0-9._\-]{12,}/g, '$1 ***');
}

export const log = {
  step: (msg: string) => console.log(`\n${color.bold(color.cyan('▶'))} ${color.bold(msg)}`),
  info: (msg: string) => console.log(`  ${redact(msg)}`),
  ok: (msg: string) => console.log(`  ${color.green('✔')} ${redact(msg)}`),
  warn: (msg: string) => console.log(`  ${color.yellow('⚠')} ${redact(msg)}`),
  fail: (msg: string) => console.error(`  ${color.red('✖')} ${redact(msg)}`),
};

export class PipelineError extends Error {
  constructor(message: string, public readonly hint = '') {
    super(message);
    this.name = 'PipelineError';
  }
}
