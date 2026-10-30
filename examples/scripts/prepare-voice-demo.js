import { constants } from 'node:fs';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const project = fileURLToPath(new URL('../../', import.meta.url));
const directory = join(project, 'examples/videos/voice-test');
const source = process.argv[2];
if (!source) throw new Error('Usage: node examples/scripts/prepare-voice-demo.js recording.mp3');
await mkdir(join(directory, 'assets/audio'), { recursive: true });
await mkdir(join(directory, 'assets/avatar'), { recursive: true });
await mkdir(join(directory, 'lib'), { recursive: true });
await mkdir(join(directory, 'compositions'), { recursive: true });
await mkdir(join(directory, 'analysis'), { recursive: true });
await mkdir(join(directory, 'analysis/en'), { recursive: true });
await mkdir(join(directory, 'analysis/uk'), { recursive: true });
const original = join(directory, 'assets/audio/original.mp3');
try { await copyFile(source, original, constants.COPYFILE_EXCL); }
catch (error) {
  if (error.code !== 'EEXIST' || !(await readFile(source)).equals(await readFile(original))) throw error;
}
await cp(join(project, 'src'), join(directory, 'src'), { recursive: true });
await copyFile(join(project, 'assets/avatar/demo-pack.js'), join(directory, 'assets/avatar/pack.js'));
await copyFile(join(project, 'node_modules/gsap/dist/gsap.min.js'), join(directory, 'lib/gsap.min.js'));
function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', ...args], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr);
}
// Remove only leading/trailing recording pauses; speech timing and pitch are preserved.
// Keep ~0.2 s before ASR's speech onset and ~0.3 s after its final word.
const trimStart = 3.3;
const audioDuration = 38.65;
ffmpeg(['-i', source, '-ss', String(trimStart), '-t', String(audioDuration), '-af',
  'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', join(directory, 'assets/audio/voice.wav')]);
ffmpeg(['-i', source, '-ss', '19.8', '-t', '22.2', '-ar', '16000', '-ac', '1', join(directory, 'analysis/uk/speech.wav')]);
ffmpeg(['-i', source, '-t', '19.8', '-ar', '16000', '-ac', '1', join(directory, 'analysis/en/speech.wav')]);
await writeFile(join(directory, 'analysis/audio-edit.json'), JSON.stringify({
  source: 'assets/audio/original.mp3', trimStart, audioDuration,
  fps: 30, videoDuration: Math.ceil(audioDuration * 30) / 30,
  normalization: 'loudnorm I=-16 TP=-1.5 LRA=11',
  englishSourceOffset: 0, ukrainianSourceOffset: 19.8,
}, null, 2) + '\n');
console.log(`Prepared ${directory}`);
