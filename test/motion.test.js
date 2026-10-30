import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareAvatar, resolveAvatarState } from '../src/index.js';
import { demoProps } from '../assets/avatar/demo-pack.js';

const lively = { breathAmplitude: 0.008, breathPeriod: 3.2, swayDegrees: 1.2,
  swayPeriod: 4.5, gestureLeanDegrees: 3, poseTransition: 0.12 };

test('optional motion remains deterministic under out-of-order seeks and inside bounds', () => {
  const config = prepareAvatar({ ...demoProps, motionProfile: lively });
  const times = [0, 0.8, 1.06, 4.09, 9.1, 16.09];
  const expected = times.map((time) => resolveAvatarState(config, time));
  for (const index of [5, 0, 3, 1, 4, 2]) assert.deepEqual(resolveAvatarState(config, times[index]), expected[index]);
  assert.notEqual(expected[1].scaleY, 1);
  assert.ok(expected.some((state) => state.rotation !== 0));
  for (let i = 0; i < 600; i++) {
    const state = resolveAvatarState(config, i / 30);
    assert.ok(Math.abs(state.rotation) <= 4.2 + Number.EPSILON);
    assert.ok(state.scaleY >= 0.992 && state.scaleY <= 1.069);
    assert.ok(state.poseMix >= 0 && state.poseMix <= 1);
  }
});

test('pose transitions resolve from the last earlier pose and finish without history', () => {
  const config = prepareAvatar({ ...demoProps, motionProfile: lively });
  const start = resolveAvatarState(config, 4);
  assert.equal(start.previousPose, 'point_up');
  assert.equal(start.pose, 'point_viewer');
  assert.equal(start.poseMix, 0);
  assert.ok(Math.abs(resolveAvatarState(config, 4.06).poseMix - 0.5) < 1e-12);
  assert.equal(resolveAvatarState(config, 4.121).poseMix, 1);
  const duplicate = prepareAvatar({ ...demoProps, motionProfile: lively, poseKeyframes: [
    { time: 0, pose: 'idle' }, { time: 1, pose: 'shrug' }, { time: 1, pose: 'fist' },
  ] });
  assert.equal(resolveAvatarState(duplicate, 1).previousPose, 'idle');
});

test('old configs keep instant pose changes and zero rotation by default', () => {
  const state = resolveAvatarState(prepareAvatar(demoProps), 4);
  assert.equal(state.poseMix, 1);
  assert.equal(state.rotation, 0);
  assert.equal(state.scaleY, 1);
  assert.equal(state.translateY, 0);
});

test('rejects unknown and excessive motion values', () => {
  for (const motionProfile of [{ headTilt: 20 }, { constructor: 2 }, { swayDegrees: 10 }, { breathAmplitude: NaN },
    { poseTransition: -1 }, { breathPeriod: 0 }, { gestureLeanDegrees: 6 }]) {
    assert.throws(() => prepareAvatar({ ...demoProps, motionProfile }));
  }
});
