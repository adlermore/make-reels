// Free offline voice setup: local Python venv + piper-tts[alignment] + Russian voices.
// Usage: npm run setup:voice [-- ru_RU-dmitri-medium ru_RU-irina-medium ...]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const win = process.platform === 'win32';
const py = path.join(root, '.venv', win ? 'Scripts/python.exe' : 'bin/python');
const voices = process.argv.slice(2).length ? process.argv.slice(2) : ['hy_AM-gor-medium', 'ru_RU-dmitri-medium', 'ru_RU-irina-medium'];
const sh = (cmd, args) => { console.log(`> ${cmd} ${args.join(' ')}`); const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root }); if (r.status !== 0) process.exit(r.status ?? 1); };

if (!existsSync(py)) sh(win ? 'py' : 'python3', [...(win ? ['-3'] : []), '-m', 'venv', '.venv']);
sh(py, ['-m', 'pip', 'install', '-q', 'piper-tts[alignment]']);
mkdirSync(path.join(root, 'tools', 'piper-voices'), { recursive: true });
sh(py, ['-m', 'piper.download_voices', '--data-dir', 'tools/piper-voices', ...voices]);
console.log('voice setup done');
