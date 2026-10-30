import { test } from 'node:test';
import assert from 'node:assert/strict';
import gsapModule from 'gsap/dist/gsap.js';
import { mountHyperframesAvatar, avatarPropsFromVariables } from '../src/hyperframes.js';
import { demoProps } from '../assets/avatar/demo-pack.js';
import { catalog } from '../assets/avatar/catalog.js';

const { gsap } = gsapModule;

// Minimal DOM for lifecycle tests; real layout/decoding is covered by HyperFrames check/snapshots.
function environment(decode = () => Promise.resolve()) {
  const target = new EventTarget();
  const document = {
    defaultView: target,
    createElement(tag) {
      return {
        tag, ownerDocument: document, style: {}, attributes: {}, children: [],
        naturalWidth: 96, naturalHeight: 96,
        setAttribute(key, value) { this.attributes[key] = String(value); },
        getAttribute(key) { return key === 'src' ? this.src ?? null : this.attributes[key] ?? null; },
        append(...elements) { for (const element of elements) { element.parent = this; this.children.push(element); } },
        remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; },
        decode() { return decode(this.src); },
      };
    },
    createElementNS(ns, tag) { return document.createElement(tag); },
  };
  return {
    target,
    root(id = 'presenter') {
      const root = document.createElement('div');
      root.setAttribute('data-composition-id', id);
      root.setAttribute('data-duration', 18);
      return root;
    },
    async seek() {
      const waits = [];
      target.dispatchEvent(new CustomEvent('hf-seek', { detail: { waitUntil: (promise) => waits.push(promise) } }));
      await Promise.all(waits);
    },
  };
}

test('editor variables resolve independent pack, animation and styling without mutation', () => {
  const props = avatarPropsFromVariables({ animation: 'idle', scale: 3, position: 'custom', x: 72, y: 80, outlineWidth: 0, shadowOpacity: 0 }, catalog);
  assert.equal(props.pack, catalog.packs['pixel-presenter']);
  assert.deepEqual(props.audioEnvelope, []);
  assert.deepEqual(props.position, { x: 72, y: 80 });
  assert.equal(props.scale, 3);
  assert.equal(props.stickerStyle.outlineWidth, 0);
  assert.equal(props.stickerStyle.shadowOpacity, 0);
  assert.throws(() => avatarPropsFromVariables({ pack: 'missing' }, catalog), /Unknown avatar pack/);
  assert.throws(() => avatarPropsFromVariables({ animation: 'missing' }, catalog), /Unknown avatar animation/);
});

test('local GSAP timeline drives avatar even with suppressed callbacks and out-of-order seeks', async () => {
  const env = environment();
  const root = env.root();
  const component = mountHyperframesAvatar(root, demoProps, { gsap });
  assert.equal(root.children.length, 0);
  assert.ok(env.target.__hf.buildReady['sprite-avatar:presenter']);
  assert.equal(env.target.__timelines.presenter, undefined);
  await component.ready;
  try {
    assert.equal(root.children[0], component.element);
    assert.equal(env.target.__timelines.presenter, component.timeline);
    for (const time of [16.09, 1.09, 9.09, 0, 4.5]) {
      component.timeline.time(time, true);
      await env.seek();
      const state = component.renderAt(time);
      const body = component.element.children[1];
      assert.equal(body.children[3].src, demoProps.pack.layers.poses[state.pose]);
      assert.equal(body.style.transform, `translateY(${state.translateY}px) scaleY(${state.scaleY})`);
    }
    component.timeline.time(1.09, false);
    assert.equal(component.element.children[1].children[3].src, demoProps.pack.layers.poses.point_up);
  } finally { component.destroy(); }
  assert.equal(root.children.length, 0);
  assert.equal(env.target.__timelines.presenter, undefined);
  assert.equal(env.target.__hf.buildReady['sprite-avatar:presenter'], undefined);
  await env.seek();
  component.destroy();
  assert.throws(() => component.renderAt(0), /destroyed/);
});

test('multiple mounts have independent clocks, filters and registry entries', async () => {
  const env = environment();
  const left = mountHyperframesAvatar(env.root('left'), { ...demoProps, position: 'bottom-left' }, { gsap });
  const right = mountHyperframesAvatar(env.root('right'), demoProps, { gsap });
  try {
    await Promise.all([left.ready, right.ready]);
    left.timeline.time(9.09, true);
    right.timeline.time(16.09, true);
    await env.seek();
    assert.equal(left.element.children[1].children[3].src, demoProps.pack.layers.poses.shrug);
    assert.equal(right.element.children[1].children[3].src, demoProps.pack.layers.poses.fist);
    assert.notEqual(left.element.children[1].style.filter, right.element.children[1].style.filter);
    left.destroy();
    assert.equal(env.target.__timelines.right, right.timeline);
    assert.throws(() => mountHyperframesAvatar(env.root('right'), demoProps, { gsap }), /already mounted/);
  } finally { left.destroy(); right.destroy(); }
});

test('destroy during asset loading does not register or append later', async () => {
  let release;
  const loaded = new Promise((resolve) => { release = resolve; });
  const env = environment(() => loaded);
  const root = env.root();
  const component = mountHyperframesAvatar(root, demoProps, { gsap });
  component.destroy();
  release();
  await component.ready;
  assert.equal(root.children.length, 0);
  assert.equal(env.target.__timelines.presenter, undefined);
  assert.deepEqual(env.target.__hf.buildReady, {});
});

test('failed assets reject readiness and clean up the component', async () => {
  const env = environment(() => Promise.reject(new Error('Bad image')));
  const root = env.root();
  const component = mountHyperframesAvatar(root, demoProps, { gsap });
  await assert.rejects(component.ready, /Bad image/);
  assert.equal(root.children.length, 0);
  assert.deepEqual(env.target.__hf.buildReady, {});
  assert.equal(env.target.__timelines.presenter, undefined);
});

test('rejects missing clock, invalid duration, missing composition id and duplicate setup', async () => {
  const env = environment();
  assert.throws(() => mountHyperframesAvatar(env.root(), demoProps), /GSAP/);
  assert.throws(() => mountHyperframesAvatar(env.root(), demoProps, { gsap, duration: 0 }), /duration/);
  assert.throws(() => mountHyperframesAvatar(env.root(''), demoProps, { gsap }), /compositionId/);
  const component = mountHyperframesAvatar(env.root(), demoProps, { gsap });
  assert.throws(() => mountHyperframesAvatar(env.root(), demoProps, { gsap }), /already mounted/);
  component.destroy();
  await component.ready;
});
