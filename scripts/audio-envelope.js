#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createRmsAccumulator } from '../src/envelope.js';

async function main() {
  const [input, output, fpsArg = '30', ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length) throw new Error('Usage: npm run envelope -- input.wav output.json [fps] (requires ffmpeg)');
  const accumulator = createRmsAccumulator(24000, Number(fpsArg));
  const child = spawn('ffmpeg', ['-v', 'error', '-nostdin', '-i', input, '-vn', '-ac', '1', '-ar', '24000', '-f', 'f32le', 'pipe:1']);
  let stderr = '';
  let pending = Buffer.alloc(0);
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-4096); });
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr}`)));
  });
  // Register rejection handling immediately while stdout is consumed.
  completed.catch(() => {});
  try {
    for await (const chunk of child.stdout) {
      const data = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      const end = data.length - data.length % 4;
      for (let offset = 0; offset < end; offset += 4) accumulator.push(data.readFloatLE(offset));
      pending = data.subarray(end);
    }
    await completed;
    if (pending.length) throw new Error('Truncated float32 audio stream');
    await writeFile(output, JSON.stringify(accumulator.finish()) + '\n', { flag: 'wx' });
    console.log(`Saved ${output}`);
  } catch (error) {
    child.kill();
    throw error;
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
