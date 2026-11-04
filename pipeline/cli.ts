#!/usr/bin/env node
/**
 * make-reels production CLI.   Usage: npm run reel -- <command> <projectId> [flags]
 * Run `npm run reel -- help` for the list of commands.
 */
import { spawn } from 'node:child_process';
import { log, PipelineError, color } from './lib/log.js';
import { LAYOUT, pp, projectDir, ROOT } from './lib/paths.js';
import { exists } from './lib/io.js';
import { init, parseBrief } from './commands/setup.js';
import { validate } from './commands/validate.js';
import { voice } from './commands/voice.js';
import { music, sfx, mix } from './commands/audio.js';
import { buildTimeline } from './commands/timeline.js';
import { renderVideo, renderPoster, storyboardFrames, illustrationPreviews } from './commands/render.js';
import { qc } from './commands/qc.js';
import { approve, deliver, doctor, list, status, requireApproval } from './commands/admin.js';

function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

const HELP = `
${color.bold('make-reels — free local Reels production pipeline')}

  ${color.cyan('Setup')}
    doctor                         check ffmpeg / remotion / piper / voices
    init <id> [--brand default] [--topic "..."]
    brief <id>                     parse brief/brief.md → brief.json
    list                           list projects
    sync-state [id]                rebuild DB rows from projects/*/production-state.json (new computer)
    status <id>                    stage-by-stage production state

  ${color.cyan('Creative gates (agents write the files, the CLI verifies)')}
    validate <id> [research|creative|script|storyboard]
    approve <id> <a|b|c|d> --note "..."   record the USER's approval (only after they approved in chat)

  ${color.cyan('Production (all free, local)')}
    voice <id> [--engine piper|windows-sapi] [--force] [--no-fit]
    music <id> [--preset cinematic-pulse|uplifting-corporate|lofi-chill|ambient-tech] [--force]
    sfx <id> [--force]
    mix <id> [--force]
    timeline <id>
    illustrations <id>             render every SVG as the engine draws it → reports/illustrations/
    frames <id>                    animatic stills + contact sheet (Stage B)
    render <id> --preview | --final
    poster <id>
    qc <id> [--preview]            automated QC + review frames → reports/
    deliver <id>                   README, cost report, deliverables check

  ${color.cyan('Batches')}
    produce <id> assets            validate → voice → music → sfx → mix → timeline → frames
    produce <id> preview           timeline → preview render → QC (preview)
    produce <id> final             final render → QC
    studio <id>                    open Remotion Studio with this project's timeline
`;

async function main() {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  const [cmd, id, arg] = pos;
  const force = flags.force === true;
  const need = () => { if (!id) throw new PipelineError(`"${cmd}" needs a project id`); return id; };

  switch (cmd) {
    case 'doctor': return doctor();
    case 'sync-state': { const { importMirrors, db: getDb } = await import('./lib/db.js'); const d = getDb(); const ids = importMirrors(d, id); return log.ok(`state imported from JSON mirrors: ${ids.join(', ') || 'nothing to import'}`); }
    case 'init': return init(need(), { brand: flags.brand as string | undefined, topic: flags.topic as string | undefined });
    case 'brief': return parseBrief(need());
    case 'list': return list();
    case 'status': return status(need());
    case 'validate': return validate(need(), arg);
    case 'approve': return approve(need(), arg, String(flags.note ?? ''));
    case 'voice': return voice(need(), { engine: flags.engine as string | undefined, force, noFit: flags['no-fit'] === true });
    case 'music': return music(need(), { force, preset: flags.preset as string | undefined });
    case 'sfx': return sfx(need(), { force });
    case 'mix': return mix(need(), { force });
    case 'timeline': return void (await buildTimeline(need()));
    case 'frames': return storyboardFrames(need());
    case 'illustrations': return illustrationPreviews(need());
    case 'render':
      if (flags.final) return renderVideo(need(), 'final');
      return renderVideo(need(), 'preview');
    case 'poster': return renderPoster(need());
    case 'qc': return void (await qc(need(), { target: flags.preview ? 'preview' : 'final' }));
    case 'deliver': return deliver(need());
    case 'produce': {
      const p = need();
      if (arg === 'assets') {
        await validate(p);
        requireApproval(p, 'approval-a', 'asset production');
        await voice(p, { force });
        await music(p, { force });
        await sfx(p, { force });
        await mix(p, { force });
        await buildTimeline(p);
        await storyboardFrames(p);
        log.ok(`assets ready → show the user ${LAYOUT.storyboardSheet} + listen to ${LAYOUT.mixFull} (Stage B)`);
        return;
      }
      if (arg === 'preview') {
        requireApproval(p, 'approval-b', 'preview render');
        await buildTimeline(p);
        await renderVideo(p, 'preview');
        await qc(p, { target: 'preview' });
        log.ok(`preview ready → ${LAYOUT.preview} (Stage C: show it to the user)`);
        return;
      }
      if (arg === 'final') {
        await renderVideo(p, 'final');
        await qc(p, { target: 'final' });
        return;
      }
      throw new PipelineError('produce needs a phase: assets | preview | final');
    }
    case 'studio': {
      const p = need();
      if (!exists(pp(p, LAYOUT.timeline))) await buildTimeline(p);
      const child = spawn('npx', ['remotion', 'studio', 'src/index.ts', '--public-dir', projectDir(p), '--props', pp(p, LAYOUT.timeline)], { cwd: ROOT, stdio: 'inherit', shell: true });
      await new Promise((r) => child.on('close', r));
      return;
    }
    case undefined: case 'help': case '--help':
      console.log(HELP);
      return;
    default:
      throw new PipelineError(`Unknown command "${cmd}"`, 'npm run reel -- help');
  }
}

main().catch((e: unknown) => {
  if (e instanceof PipelineError) {
    log.fail(e.message);
    if (e.hint) console.error(`  ${color.dim('hint:')} ${e.hint}`);
  } else {
    console.error(e);
  }
  process.exitCode = 1;
});

