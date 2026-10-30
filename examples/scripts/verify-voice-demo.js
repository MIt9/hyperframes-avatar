import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { prepareAvatar, resolveAvatarState } from '../../src/state.js';
import { recordingProps } from '../videos/voice-test/assets/avatar/recording.js';

const config = prepareAvatar(recordingProps);
const duration = 1160 / 30;
const mouths = { closed: 0, half: 0, open: 0 };
for (let frame = 0; frame < 1160; frame++) mouths[resolveAvatarState(config, frame / 30).mouth]++;
assert.ok(Object.values(mouths).every((count) => count > 0));
assert.equal(resolveAvatarState(config, duration - 1 / 30).mouth, 'closed');
const report = { duration, frames: 1160, envelopeSamples: config.audioEnvelope.length,
  mouthFrameCounts: mouths, poseKeyframes: config.poseKeyframes.length };
if (process.argv[2]) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_frames', '-of', 'json', process.argv[2]], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const probe = JSON.parse(result.stdout);
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  assert.ok(video && audio, 'Output must contain both video and audio');
  assert.equal(video.codec_name, 'h264');
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
  assert.equal(video.r_frame_rate, '30/1');
  assert.equal(Number(video.nb_frames), 1160);
  assert.ok(Math.abs(Number(probe.format.duration) - duration) < 0.05);
  assert.ok(Number(probe.format.size) > 10000);
  report.output = probe;
}
await writeFile(fileURLToPath(new URL('../videos/voice-test/analysis/verification.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
