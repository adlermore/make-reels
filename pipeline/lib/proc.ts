import { spawn } from 'node:child_process';
import { PipelineError } from './log.js';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  allowFail?: boolean;
}

/** Spawn a process without a shell (no quoting/injection issues), capture output, enforce a timeout. */
export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', ...opts.env },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d) => (stderr += d));
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill();
          reject(new PipelineError(`${cmd} timed out after ${opts.timeoutMs} ms`));
        }, opts.timeoutMs)
      : null;
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(new PipelineError(`Cannot start ${cmd}: ${err.message}`, 'Is it installed and on PATH? See docs/SETUP.md'));
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      const res = { code: code ?? -1, stdout, stderr };
      if (code !== 0 && !opts.allowFail) {
        reject(new PipelineError(`${cmd} exited with ${code}\n${stderr.split('\n').slice(-15).join('\n')}`));
      } else resolve(res);
    });
    if (opts.input !== undefined) child.stdin.end(opts.input, 'utf8');
    else child.stdin.end();
  });
}
