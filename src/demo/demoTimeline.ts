/** Demo timeline: shows every layout, transition and caption style without any project assets. */
import brandJson from '../../brands/default/brand-config.json';
import { BrandConfigSchema, ProductionStandards, TimelineSchema, type Timeline, type TimelineScene } from '../types/schemas';
import { sequenceLayout } from '../utils/timing';

const brand = BrandConfigSchema.parse(brandJson);
const fps = 30;
const SCENE = 84;

type Partial = Omit<TimelineScene, 'from' | 'cutFrame' | 'durationInFrames' | 'transitionFrames' | 'sceneIndex' | 'background' | 'illustration' | 'items' | 'subline' | 'keywords' | 'source'> &
  { background?: TimelineScene['background']; items?: string[]; subline?: string; keywords?: string[]; source?: string };

const raw: Partial[] = [
  // Eastern Armenian (reformed orthography) — demo of every layout
  { sceneId: 's01', layout: 'hook-stat', transitionIn: 'none', headline: 'ընկերությունների արդեն օգտագործում է ԱԲ', stat: { value: 88, prefix: '', suffix: '%', label: '', decimals: 0 }, keywords: ['ԱԲ'], background: { type: 'motion', src: '', motionPreset: 'particles', kenBurns: 'none', dim: 0.3 }, source: 'Ցուցադրական թիվ' },
  { sceneId: 's02', layout: 'kinetic-title', transitionIn: 'blur-slide', headline: 'Առօրյա գործերն այլևս չեն խլում թիմի ժամանակը', subline: 'Հաշվետվություններ, պատասխաններ հաճախորդներին, փաստաթղթեր՝ րոպեների ընթացքում', keywords: ['առօրյա'] },
  { sceneId: 's03', layout: 'stat', transitionIn: 'zoom', headline: 'Ժամանակի խնայողություն', stat: { value: 40, prefix: '', suffix: '%', label: 'աշխատանքային ժամանակի', decimals: 0 }, source: 'Ցուցադրական թիվ՝ բաղադրիչի օրինակ' },
  { sceneId: 's04', layout: 'list', transitionIn: 'slide', headline: 'Որտեղի՞ց սկսել', items: ['Գտեք կրկնվող գործընթաց', 'Նկարագրեք այն քայլ առ քայլ', 'Ավտոմատացրեք ԱԲ-ով'], keywords: ['սկսել'] },
  { sceneId: 's05', layout: 'split-reveal', transitionIn: 'wipe', headline: 'Հայտերի մշակում', items: ['3 ժամ ձեռքով', '5 րոպե ԱԲ-ով'] },
  { sceneId: 's06', layout: 'quote', transitionIn: 'fade', headline: 'Հաղթում է ոչ թե ամենամեծը, այլ նա, ով ավելի արագ է սովորում', subline: 'շուկայի կանոն', keywords: ['արագ'], background: { type: 'motion', src: '', motionPreset: 'grid', kenBurns: 'none', dim: 0.3 } },
  { sceneId: 's07', layout: 'cta', transitionIn: 'zoom', headline: 'Հետևեք մեզ՝ ավելին ԱԲ-ի մասին', subline: '', keywords: ['ԱԲ'] },
];

const cuts = raw.map((r, i) => ({ cutFrame: i * SCENE, transitionFrames: r.transitionIn === 'none' ? 0 : brand.motion.transitionFrames }));
const total = raw.length * SCENE;
const layout = sequenceLayout(cuts, total);

const words = 'ԱԲ-ն արդեն փոխում է ձեր բիզնեսը։ Հարցն այն է՝ կհասցնե՞ք'.split(' ').map((w, i) => ({ text: w, startMs: 300 + i * 260, endMs: 300 + i * 260 + 230 }));

export const demoTimeline: Timeline = TimelineSchema.parse({
  version: 1,
  projectId: 'demo',
  fps,
  width: ProductionStandards.width,
  height: ProductionStandards.height,
  durationInFrames: total,
  brand,
  logoSrc: '',
  safeZone: brand.safeZone ?? ProductionStandards.defaultSafeZone,
  scenes: raw.map((r, i) => ({
    ...r,
    sceneIndex: i,
    cutFrame: cuts[i].cutFrame,
    from: layout[i].from,
    durationInFrames: layout[i].durationInFrames,
    transitionFrames: layout[i].transitionFrames,
    background: r.background ?? { type: 'motion', src: '', motionPreset: 'aurora', kenBurns: 'none', dim: 0.3 },
    illustration: '',
    items: r.items ?? [],
    subline: r.subline ?? '',
    keywords: r.keywords ?? [],
    source: r.source ?? '',
  })),
  captions: { enabled: true, words },
  audio: { mix: '', voice: '', music: '', musicGainDb: -15 },
  language: 'hy',
  mode: 'final',
});
