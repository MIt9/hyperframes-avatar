import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareTalkingPortrait, resolvePortraitState, createTalkingPortrait } from '../src/portrait.js';
import { resolveAudioState } from '../src/state.js';
import { bodyBeat } from '../src/motion.js';

const pack = { kind: 'talking-portrait', id: 'test-cat', base: 'cat.png', mouthlessBase: true, size: [1024,1536],
  mouth: {style:'cat',x:0.415,y:0.287,width:0.17,height:0.068,ink:'#493027',teeth:'#FFF9EE',tongue:'#D97D83'} };
const props = { pack, audioFps: 3, audioEnvelope: [0,0,0,0.15,0.15,0.15,0.55,0.55,0.55], accentKeyframes:[{time:1}] };

test('portrait lip-sync matches the shared RMS resolver on arbitrary seeks', () => {
  const config = prepareTalkingPortrait(props);
  for (const [time, mouth] of [[8/3,'open'],[0,'closed'],[4/3,'half'],[3,'closed']]) {
    const actual = resolvePortraitState(config,time);
    assert.equal(actual.mouth,mouth);
    assert.equal(actual.mouth,resolveAudioState(config.audioEnvelope,config.audioFps,time).mouth);
  }
  assert.deepEqual(resolvePortraitState(config,1.1),resolvePortraitState(config,1.1));
});

test('portrait renderer exposes exactly one actual mouth group for each speech state', async () => {
  const groups = [];
  const document = {
    createElement(name) { return { style:{}, attrs:{}, children:[], naturalWidth:1024,naturalHeight:1536,
      setAttribute(key,value) {this.attrs[key]=value}, append(...children){this.children.push(...children)}, decode(){return Promise.resolve()} }; },
    createElementNS(namespace,name) { const node=this.createElement(name); if(name==='g') groups.push(node); return node; },
  };
  const portrait = createTalkingPortrait(props,document);
  await portrait.ready;
  for (const [time, mouth] of [[0,'closed'],[4/3,'half'],[8/3,'open'],[0,'closed']]) {
    portrait.renderAt(time);
    const visible = groups.filter((group)=>group.attrs.opacity==='1');
    assert.equal(visible.length,1);
    assert.equal(visible[0].attrs['data-lip-state'],mouth);
    assert.equal(portrait.element.attrs['data-mouth'],mouth);
  }
});

test('portrait validation rejects a painted-mouth base, invalid placement and invalid RMS', () => {
  for (const change of [{pack:{...pack,mouthlessBase:false}}, {audioEnvelope:[NaN]}, {width:0},
    {pack:{...pack,mouth:{...pack.mouth,x:0.95}}}, {pack:{...pack,mouth:{...pack.mouth,style:'unknown'}}}]) {
    assert.throws(()=>prepareTalkingPortrait({...props,...change}));
  }
  assert.throws(()=>resolvePortraitState(prepareTalkingPortrait(props),-1));
});

test('portrait disables whole-body bounce by default and supports layered tail rotation', async () => {
  const config = prepareTalkingPortrait(props);
  assert.equal(config.enableBounce, false);
  const stateNoBounce = resolvePortraitState(config, 1.1);
  assert.equal(stateNoBounce.translateY, 0);
  assert.ok(Math.abs(stateNoBounce.scaleY - 1) < 0.01);

  const configBounce = prepareTalkingPortrait({ ...props, enableBounce: true });
  const stateBounce = resolvePortraitState(configBounce, 1.1);
  assert.ok(stateBounce.translateY < -1);

  const packWithTail = {
    ...pack,
    layers: [{ id: 'tail', src: 'tail.png', placement: 'behind', origin: [310, 1260], motion: { type: 'sway', amplitude: 7.5, period: 1.8 } }],
  };
  const layers = [];
  const document = {
    createElement(name) { return { style:{}, attrs:{}, children:[], naturalWidth:1024,naturalHeight:1536,
      setAttribute(key,value) {this.attrs[key]=value}, append(...children){this.children.push(...children)}, decode(){return Promise.resolve()} }; },
    createElementNS(namespace,name) {
      const node = this.createElement(name);
      if (name === 'g') layers.push(node);
      return node;
    },
  };
  const portrait = createTalkingPortrait({ pack: packWithTail, audioEnvelope: [0] }, document);
  await portrait.ready;
  const rendered = portrait.renderAt(1.5);
  assert.ok(typeof rendered.layerAngles.tail === 'number');
  const tailGroup = layers.find((l) => l.attrs['data-layer'] === 'tail');
  assert.ok(tailGroup);
  assert.equal(tailGroup.style.transform, `rotate(${rendered.layerAngles.tail}deg)`);
});

test('secondary motion is deterministic, continuous, speech-aware and keeps the body still by default', () => {
  const cfg = prepareTalkingPortrait({ ...props, pack: { ...pack, layers: [{ id: 'tail', src: 't.png', origin: [1, 1],
    motion: { type: 'sway', amplitude: 7.5, period: 1.8 } }], eyes: { color: '#D98F55', line: '#3A2418', boxes: [{ x: .3, y: .2, width: .1, height: .05 }] } } });
  // seeking is order-independent
  const a = resolvePortraitState(cfg, 12.3); resolvePortraitState(cfg, 3); assert.deepEqual(resolvePortraitState(cfg, 12.3), a);
  // no jump across the sway cycle boundary (5.4 s)
  const before = resolvePortraitState(cfg, 5.4 - 1e-4).layerAngles.tail, after = resolvePortraitState(cfg, 5.4 + 1e-4).layerAngles.tail;
  assert.ok(Math.abs(after - before) < 0.1, `${before} -> ${after}`);
  assert.ok(Math.abs(resolvePortraitState(cfg, 4.5).layerAngles.tail) < 2, 'rests between swings');
  // blinks happen, are brief, and stay in [0,1]
  const blinks = Array.from({ length: 600 }, (_, i) => resolvePortraitState(cfg, i / 30).blink);
  assert.ok(blinks.every((b) => b >= 0 && b <= 1));
  const closed = blinks.filter((b) => b > 0.5).length;
  assert.ok(closed > 0 && closed < 60, `closed frames: ${closed}`);
  // body beats are small and no bounce
  for (let i = 0; i < 600; i++) {
    const s = resolvePortraitState(cfg, i / 30);
    assert.ok(Math.abs(s.rotation) <= 1 && Math.abs(s.translateX) <= 0.01 && s.translateY === 0);
  }
});

test('body beats wait for a pause in speech', () => {
  const loud = new Array(30 * 40).fill(0.5);
  const quiet = new Array(30 * 40).fill(0);
  const first = (env) => Array.from({ length: 1200 }, (_, i) => i / 30).find((t) => Math.abs(bodyBeat(t, env, 30).lean) > 0.05);
  const gap = new Array(30 * 40).fill(0.5).fill(0, 30 * 3.5, 30 * 6); // speech with a pause at 3.5–6 s
  assert.ok(first(quiet) > 0);
  assert.ok(first(loud) - first(quiet) >= 1.9, 'continuous speech pushes the beat to the 2 s search limit');
  assert.ok(first(gap) >= 3.5 && first(gap) < first(loud), 'beat lands in the pause');
});

test('portrait validation rejects bad eyes and layer motion', () => {
  const bad = [{ eyes: { color: 'red', line: '#000000', boxes: [{ x: 0, y: 0, width: .1, height: .1 }] } },
    { eyes: { color: '#000000', line: '#000000', boxes: [] } }];
  for (const eyes of bad) assert.throws(() => prepareTalkingPortrait({ ...props, pack: { ...pack, ...eyes } }));
  assert.throws(() => prepareTalkingPortrait({ ...props, pack: { ...pack, layers: [{ id: 'x', src: 'x.png', motion: { type: 'sway', amplitude: 5, period: 1 } }] } }));
});
