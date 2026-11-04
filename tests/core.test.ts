import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sequenceLayout, seriesLength } from '../src/utils/timing.js';
import { paginateWords, pagesToSrt, isKeyword, displayWord } from '../src/utils/captions.js';
import { mapWords } from '../pipeline/providers/voice/engines.js';
import { BrandConfigSchema, ShotListSchema, TimelineSchema } from '../src/types/schemas.js';
import { prepareSvgCheck } from '../pipeline/lib/svg.js';
import { generateMusic } from '../pipeline/audio/music.js';
import { synthSfx } from '../pipeline/audio/sfx.js';
import { peak } from '../pipeline/audio/dsp.js';
import { ROOT } from '../pipeline/lib/paths.js';

test('sequenceLayout keeps total length exact for any transition mix', () => {
  const cuts = [0, 95, 180, 300, 420, 515].map((c, i) => ({ cutFrame: c, transitionFrames: i === 0 ? 0 : [10, 0, 12, 8, 10][i - 1] }));
  const total = 600;
  const layout = sequenceLayout(cuts, total);
  assert.equal(seriesLength(layout), total);
  layout.forEach((l, i) => {
    assert.ok(l.durationInFrames >= l.transitionFrames, `scene ${i} shorter than its transition`);
    if (i + 1 < layout.length) assert.ok(l.durationInFrames >= layout[i + 1].transitionFrames);
  });
});

test('sequenceLayout clamps transitions on very short scenes', () => {
  const layout = sequenceLayout([{ cutFrame: 0, transitionFrames: 0 }, { cutFrame: 12, transitionFrames: 20 }, { cutFrame: 30, transitionFrames: 20 }], 60);
  assert.equal(seriesLength(layout), 60);
  assert.ok(layout[1].transitionFrames <= 3);
});

test('caption paging respects max words, sentence ends and scene cuts', () => {
  const w = (text: string, s: number) => ({ text, startMs: s, endMs: s + 250 });
  const words = [w('ИИ', 0), w('меняет', 300), w('бизнес.', 600), w('Вопрос', 1000), w('в', 1300), w('том,', 1500), w('успеете', 1800), w('ли', 2100), w('вы?', 2300)];
  const pages = paginateWords(words, { maxWords: 3, cutsMs: [1750] });
  assert.deepEqual(pages.map((p) => p.words.map((x) => x.text).join(' ')), ['ИИ меняет бизнес.', 'Вопрос в том,', 'успеете ли вы?']);
  const srt = pagesToSrt(pages);
  assert.match(srt, /^1\n00:00:00,000 --> /);
  assert.match(srt, /ИИ меняет бизнес\.\n/); // SRT keeps punctuation (only on-screen captions strip it)
});

test('keyword matching handles Russian inflection and ё', () => {
  assert.ok(isKeyword('бизнеса,', ['бизнес']));
  assert.ok(isKeyword('ИИ', ['ии']));
  assert.ok(isKeyword('ещё', ['еще']));
  assert.ok(!isKeyword('в', ['вопрос']));
  assert.equal(displayWord('том,'), 'том');
  assert.equal(displayWord('вы?'), 'вы?');
});

test('mapWords: exact 1:1 when counts match, monotonic proportional otherwise', () => {
  const segs = [{ start: 0.05, end: 0.6 }, { start: 0.7, end: 1.1 }, { start: 1.15, end: 1.6 }];
  assert.deepEqual(mapWords('Раз два три', segs).map((w) => w.start), [0.05, 0.7, 1.15]);
  const est = mapWords('Сорок процентов рабочего времени', [{ start: 0.1, end: 2.1 }]);
  assert.equal(est.length, 4);
  for (let i = 1; i < est.length; i++) assert.ok(est[i].start >= est[i - 1].end - 1e-9);
  assert.ok(Math.abs(est[3].end - 2.1) < 1e-9);
});

test('default brand config and demo shot list validate', () => {
  const brand = BrandConfigSchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'brands/default/brand-config.json'), 'utf8')));
  assert.equal(brand.id, 'default');
  const tpl = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/shot-list.example.json'), 'utf8'));
  assert.ok(ShotListSchema.safeParse(tpl).success);
});

test('demo timeline is a valid Timeline', async () => {
  const { demoTimeline } = await import('../src/demo/demoTimeline.js');
  assert.ok(TimelineSchema.safeParse(demoTimeline).success);
});

test('SVG linter rejects scripts, handlers and external refs', () => {
  assert.equal(prepareSvgCheck('<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>'), null);
  assert.match(String(prepareSvgCheck('<svg viewBox="0 0 1 1"><script>x()</script></svg>')), /script/);
  assert.match(String(prepareSvgCheck('<svg viewBox="0 0 1 1"><rect onclick="x()"/></svg>')), /event/);
  assert.match(String(prepareSvgCheck('<svg viewBox="0 0 1 1"><image href="https://x/y.png"/></svg>')), /external/);
  assert.match(String(prepareSvgCheck('<svg><path/></svg>')), /viewBox/);
  assert.match(String(prepareSvgCheck('<svg viewBox="0 0 1 1"><path style="stroke:red" d="M0 0"/></svg>')), /presentation attributes/);
});

test('procedural music: deterministic, non-silent, headroom kept', () => {
  const a = generateMusic({ preset: 'cinematic-pulse', bpm: 100, durationSec: 6, seed: 42 });
  const b = generateMusic({ preset: 'cinematic-pulse', bpm: 100, durationSec: 6, seed: 42 });
  assert.equal(a.channels[0].length, b.channels[0].length);
  let diff = 0;
  for (let i = 0; i < a.channels[0].length; i += 997) diff += Math.abs(a.channels[0][i] - b.channels[0][i]);
  assert.equal(diff, 0, 'same seed must give identical audio');
  const p = peak(...a.channels);
  assert.ok(p > 0.5 && p <= 0.71, `peak ${p} should be normalised to −3 dBFS`);
  for (const preset of ['uplifting-corporate', 'lofi-chill', 'ambient-tech'] as const) {
    const r = generateMusic({ preset, durationSec: 4, seed: 1 });
    assert.ok(peak(...r.channels) > 0.5, `${preset} is silent`);
  }
});

test('procedural SFX: every kind renders stereo audio below 0 dBFS', () => {
  for (const kind of ['whoosh', 'impact', 'riser', 'click', 'pop', 'shimmer'] as const) {
    const [l, r] = synthSfx(kind, 3);
    assert.equal(l.length, r.length);
    const p = peak(l, r);
    assert.ok(p > 0.3 && p < 1, `${kind} peak ${p}`);
  }
});

test('Russian typography: no line starting with a dash, no hanging short words', async () => {
  const { wrapUnits } = await import('../src/utils/typography.js');
  assert.deepEqual(wrapUnits('Решает не сервис, а управление', 'ru'), ['Решает', 'не сервис,', 'а управление']);
  assert.deepEqual(wrapUnits('Управление важнее навыков — вдвое', 'ru'), ['Управление', 'важнее', 'навыков —', 'вдвое']);
});

test('scene cuts never start before the previous scene stops speaking', async () => {
  const { sceneWindows } = await import('../pipeline/lib/project.js');
  const vt = {
    engine: 'piper', voice: 'x', totalSec: 4, leadInSec: 0.35,
    scenes: [{ sceneId: 's01', startSec: 0.35, endSec: 2.0, file: 'a' }, { sceneId: 's02', startSec: 2.1, endSec: 4.0, file: 'b' }],
    words: [{ text: 'раз', startMs: 400, endMs: 1000 }, { text: 'два', startMs: 1100, endMs: 1980 }, { text: 'три', startMs: 2150, endMs: 3000 }],
  };
  const { windows } = sceneWindows(vt, 10 / 30);
  assert.ok(windows[1].startSec >= 1.98 + 5 / 30, `cut at ${windows[1].startSec} overlaps the last word`);
});

// ───────────── Armenian (Eastern, reformed orthography) ─────────────
test('Armenian typography keeps «և»/«ոչ» with the next word and the dash with the previous one', async () => {
  const { wrapUnits } = await import('../src/utils/typography.js');
  assert.deepEqual(wrapUnits('Որոշում է ոչ թե ծառայությունը, այլ կառավարումը'), ['Որոշում', 'է', 'ոչ թե ծառայությունը,', 'այլ', 'կառավարումը']);
  assert.deepEqual(wrapUnits('Արագություն և ճշգրտություն — միասին'), ['Արագություն', 'և ճշգրտություն —', 'միասին']);
});

test('Armenian captions break pages on «։» and strip it for display only', async () => {
  const w = (text: string, s: number) => ({ text, startMs: s, endMs: s + 250 });
  const pages = paginateWords([w('ԱԲ-ն', 0), w('փոխում', 300), w('է', 600), w('բիզնեսը։', 800), w('Հարցն', 1200), w('այն', 1500), w('է՝', 1700), w('կհասցնե՞ք', 2000)], { maxWords: 4 });
  assert.deepEqual(pages.map((p) => p.words.map((x) => x.text).join(' ')), ['ԱԲ-ն փոխում է բիզնեսը։', 'Հարցն այն է՝', 'կհասցնե՞ք']);
  assert.equal(displayWord('բիզնեսը։'), 'բիզնեսը');
  assert.equal(displayWord('կհասցնե՞ք'), 'կհասցնե՞ք');
});

test('Armenian keywords match inflected forms', () => {
  assert.ok(isKeyword('կառավարումը', ['կառավարում']));
  assert.ok(isKeyword('ընկերությունների', ['ընկերություն']));
  assert.ok(isKeyword('ԱԲ-ն', ['ԱԲ']) || isKeyword('ԱԲ-ն', ['ԱԲ-ն']));
});

test('Armenian lint catches «եւ», Latin punctuation and mixed alphabets', async () => {
  const { lintArmenian } = await import('../pipeline/lib/lint-hy.js');
  assert.equal(lintArmenian('Որոշում է կառավարումը։', 's01', 'screen').errors.length, 0);
  assert.match(lintArmenian('Երեւան', 's01', 'screen').errors.join(), /եւ/);
  assert.match(lintArmenian('Ինչու?', 's01', 'screen').errors.join(), /«\?»/);
  assert.match(lintArmenian('Բիզնեսը փոխվում է.', 's01', 'screen').errors.join(), /«։»/);
  assert.match(lintArmenian('բիզնեսo', 's01', 'screen').errors.join(), /mixed alphabets/);
  assert.equal(lintArmenian('2026 թ. զեկույցը։', 's01', 'screen').errors.length, 0, 'abbreviation «թ.» is legitimate');
  assert.match(lintArmenian('AI-ն փոխում է ամեն ինչ։', 's01', 'narration').warnings.join(), /Latin letters/);
});

test('Armenian number format and UI strings', async () => {
  const { strings } = await import('../src/utils/i18n.js');
  assert.equal((1234567.5).toLocaleString(strings('hy').locale, { maximumFractionDigits: 1 }).replace(/\s/g, ' '), '1 234 567,5'); // ICU uses a no-break space
  assert.equal(strings('hy').follow, 'Հետևել');
  assert.ok(!/եւ/.test(Object.values(strings('hy')).join(' ')));
});

test('UI string lint: keys, placeholders and Armenian rules', async () => {
  const { lintStrings } = await import('../scripts/lint-hy-strings.js');
  const src = { auth: { hello: 'Hello, {name}!', files: '{count, plural, one {# file} other {# files}}' }, save: 'Save' };
  const ok = lintStrings(src, { auth: { hello: 'Բարև, {name}', files: '{count, plural, one {# ֆայլ} other {# ֆայլ}}' }, save: 'Պահպանել' });
  assert.equal(ok.errors.length, 0, ok.errors.join('; '));
  const bad = lintStrings(src, { auth: { hello: 'Բարև, {username}', files: 'ֆայլեր' }, save: 'Պահպանել?', extra: 'x' });
  assert.ok(bad.errors.some((e) => /placeholders differ/.test(e)));
  assert.ok(bad.errors.some((e) => /extra key/.test(e)));
  assert.ok(bad.errors.some((e) => /Latin «\?»/.test(e)));
});
