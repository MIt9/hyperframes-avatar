import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('audio CLI decodes real WAV, writes RMS JSON and preserves existing output', async (t) => {
  if (spawnSync('ffmpeg', ['-version']).error?.code === 'ENOENT') return t.skip('ffmpeg is not installed');
  const dir = await mkdtemp(join(tmpdir(), 'sprite-avatar-'));
  try {
    const input = join(dir, 'tone.wav');
    const output = join(dir, 'envelope.json');
    const tone = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.25', input]);
    assert.equal(tone.status, 0, tone.stderr?.toString());
    const script = fileURLToPath(new URL('../scripts/audio-envelope.js', import.meta.url));
    const run = () => spawnSync(process.execPath, [script, input, output, '30']);
    const first = run();
    assert.equal(first.status, 0, first.stderr?.toString());
    const bytes = await readFile(output, 'utf8');
    const data = JSON.parse(bytes);
    assert.equal(data.audioFps, 30);
    assert.equal(data.audioEnvelope.length, 8);
    assert.ok(data.audioEnvelope.every((n) => n > 0.08 && n < 0.1));
    assert.equal(run().status, 1);
    assert.equal(await readFile(output, 'utf8'), bytes);
    const missing = spawnSync(process.execPath, [script, join(dir, 'missing.wav'), join(dir, 'missing.json')]);
    assert.equal(missing.status, 1);
    await assert.rejects(readFile(join(dir, 'missing.json')), { code: 'ENOENT' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
