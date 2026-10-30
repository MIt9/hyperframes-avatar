import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareAvatar, resolveAvatarState, tagGestures, bindHyperframes } from '../src/index.js';
import { createRmsAccumulator } from '../src/envelope.js';
import { demoProps } from '../assets/avatar/demo-pack.js';

test('seeking in any order yields identical states without changing inputs', () => {
  const source = structuredClone(demoProps);
  const config = prepareAvatar(source);
  const times = [0, 1, 1.09, 4.05, 9, 9.1, 13, 16.09, 18, 200];
  const expected = times.map((t) => resolveAvatarState(config, t));
  for (const index of [9, 0, 4, 2, 8, 6, 1, 7, 3, 5]) assert.deepEqual(resolveAvatarState(config, times[index]), expected[index]);
  assert.deepEqual(source, demoProps);
  source.pack.layers.base = 'changed';
  source.audioEnvelope[0] = 1;
  source.poseKeyframes[0].pose = 'fist';
  assert.deepEqual(resolveAvatarState(config, 0), expected[0]);
  assert.notEqual(config.pack.layers.base, 'changed');
});

test('sorts timeline, handles exact transitions, duplicate times and idle fallback', () => {
  const config = prepareAvatar({ ...demoProps, poseKeyframes: [
    { time: 3, pose: 'shrug' }, { time: 1, pose: 'point_up' }, { time: 3, pose: 'fist' },
  ] });
  assert.equal(resolveAvatarState(config, 0.99).pose, 'idle');
  assert.equal(resolveAvatarState(config, 1).pose, 'point_up');
  assert.equal(resolveAvatarState(config, 2.99).pose, 'point_up');
  assert.equal(resolveAvatarState(config, 3).pose, 'fist');
});

test('bounce has bounded duration, correct peak and can be disabled', () => {
  const config = prepareAvatar(demoProps);
  assert.equal(resolveAvatarState(config, 1).translateY, 0);
  assert.equal(resolveAvatarState(config, 1.09).translateY, -12);
  assert.equal(resolveAvatarState(config, 1.09).scaleY, 1.06);
  assert.equal(resolveAvatarState(config, 1.181).translateY, 0);
  assert.equal(resolveAvatarState(config, 0.09).translateY, 0);
});

test('causal RMS smoothing uses threshold boundaries and closes after audio ends', () => {
  for (const [amplitude, mouth] of [[0, 'closed'], [0.049, 'closed'], [0.05, 'half'], [0.249, 'half'], [0.25, 'open'], [1, 'open']]) {
    const config = prepareAvatar({ ...demoProps, audioEnvelope: [amplitude, amplitude, amplitude], audioFps: 30 });
    assert.equal(resolveAvatarState(config, 2 / 30).mouth, mouth);
    assert.equal(resolveAvatarState(config, 3 / 30).mouth, 'closed');
  }
  assert.equal(resolveAvatarState(prepareAvatar({ ...demoProps, audioEnvelope: [] }), 1).mouth, 'closed');
});

test('blinks are deterministic and surprised eyes have an open fallback', () => {
  const config = prepareAvatar(demoProps);
  const eyeStates = Array.from({ length: 350 }, (_, i) => resolveAvatarState(config, i / 100).eyes);
  const count = eyeStates.filter((eyes) => eyes === 'blink').length;
  assert.ok(count >= 11 && count <= 13);
  assert.equal(resolveAvatarState(config, 9).eyes, 'surprised');
  const props = structuredClone(demoProps);
  delete props.pack.layers.eyes.surprised;
  assert.equal(resolveAvatarState(prepareAvatar(props), 9).eyes, 'open');
});

test('rejects invalid configuration and invalid seek times', () => {
  for (const patch of [{ audioFps: 0 }, { scale: NaN }, { audioEnvelope: [Infinity] }, { audioEnvelope: [1.1] },
    { poseKeyframes: [{ time: 1, pose: 'missing' }] }, { poseKeyframes: [{ time: -1, pose: 'idle' }] },
    { stickerStyle: { shadowOpacity: 2 } }, { position: { x: NaN, y: 0 } }]) {
    assert.throws(() => prepareAvatar({ ...demoProps, ...patch }));
  }
  const config = prepareAvatar(demoProps);
  for (const time of [-1, NaN, Infinity]) assert.throws(() => resolveAvatarState(config, time));
});

test('gesture rules support Ukrainian, whole words, availability and a finale', () => {
  assert.deepEqual(tagGestures([
    { time: 6, text: 'Фінал', finale: true }, { time: 0, text: 'Чому це працює?' },
    { time: 1, text: 'Дивись на 3 приклади' }, { time: 2, text: 'Ви можете повторити' },
    { time: 3, text: 'theory younger' },
  ]).map(({ time, pose }) => [time, pose]), [[0, 'shrug'], [1, 'point_up'], [2, 'point_viewer'], [3, 'idle'], [6, 'fist']]);
  assert.deepEqual(tagGestures([{ time: 0, text: 'why?' }], ['idle']), []);
});

test('RMS windows cover fractional rates, silence and partial last window', () => {
  const rms = createRmsAccumulator(10, 3);
  for (let i = 0; i < 10; i++) rms.push(i < 4 ? 0 : -0.5);
  assert.deepEqual(rms.finish(), { audioFps: 3, audioEnvelope: [0, 0.5, 0.5] });
  assert.deepEqual(rms.finish(), { audioFps: 3, audioEnvelope: [0, 0.5, 0.5] });
  assert.throws(() => rms.push(0));
  const partial = createRmsAccumulator(10, 3);
  partial.push(0.5);
  assert.deepEqual(partial.finish().audioEnvelope, [0.5]);
  assert.throws(() => createRmsAccumulator(10, 11));
});

test('Hyperframes binding uses local time, waits for assets and detaches', () => {
  const target = new EventTarget();
  const times = [];
  const ready = Promise.resolve([]);
  const avatar = { element: { hidden: false }, ready, renderAt: (time) => times.push(time) };
  const detach = bindHyperframes(avatar, { target, offset: 2 });
  let waited;
  const send = (time) => target.dispatchEvent(new CustomEvent('hf-seek', { detail: { time, waitUntil: (promise) => { waited = promise; } } }));
  send(1);
  assert.equal(avatar.element.hidden, true);
  send(3);
  assert.equal(avatar.element.hidden, false);
  assert.deepEqual(times, [0, 1]);
  assert.equal(waited, ready);
  detach();
  send(4);
  assert.deepEqual(times, [0, 1]);
});
