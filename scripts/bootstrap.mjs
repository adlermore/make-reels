// New computer after `git clone` / `git pull`:  npm install && npm run bootstrap
// 1) offline voices (Piper + hy_AM / ru_RU) into .venv and tools/   2) environment check
// 3) production state: data/studio.db is rebuilt automatically from projects/*/production-state.json
import { spawnSync } from 'node:child_process';
const run = (cmd, args) => { console.log(`\n> ${cmd} ${args.join(' ')}`); const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' }); if (r.status !== 0) process.exit(r.status ?? 1); };
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) { console.error(`Node ${process.versions.node} is too old: node:sqlite needs Node >= 22.13`); process.exit(1); }
run('node', ['scripts/setup-voice.mjs']);
run('npm', ['run', 'reel', '--', 'doctor']);
run('npm', ['run', 'reel', '--', 'sync-state']);
run('npm', ['run', 'reel', '--', 'list']);
console.log('\nReady. Open Claude Code in this folder and say: «Продолжи по PROGRESS.md»');
