// Remotion CLI config (used by `npx remotion studio` / `npx remotion render`).
// Programmatic renders (pipeline/commands/render.ts) set the same options explicitly.
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(18);
Config.setOverwriteOutput(true);
Config.setEntryPoint('src/index.ts');
