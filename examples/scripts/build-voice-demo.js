import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { prepareAvatar } from '../../src/state.js';
import { demoPack } from '../../assets/avatar/demo-pack.js';

const directory = fileURLToPath(new URL('../videos/voice-test/', import.meta.url));
// Keep language-specific ASR outputs separate (the transcriber writes transcript.json).
for (const [language, oldName] of [['en', 'english'], ['uk', 'ukrainian']]) {
  await mkdir(join(directory, `analysis/${language}`), { recursive: true });
  try { await rename(join(directory, `analysis/${oldName}.wav`), join(directory, `analysis/${language}/speech.wav`)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
try {
  const legacy = await readFile(join(directory, 'analysis/transcript.json'), 'utf8');
  const language = /[\u0400-\u04ff]/u.test(JSON.parse(legacy)[0]?.text ?? '') ? 'uk' : 'en';
  await writeFile(join(directory, `analysis/${language}/transcript.json`), legacy);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const envelope = JSON.parse(await readFile(join(directory, 'analysis/envelope.json'), 'utf8'));
const edit = JSON.parse(await readFile(join(directory, 'analysis/audio-edit.json'), 'utf8'));
// Phrase onsets refined using the source recording's silence boundaries, in source seconds.
// Do not use Whisper's interpolated word times for the long opening recording pause.
const phrases = [
  [3.5, 'en', 'Look at this little avatar.', 'point_viewer'],
  [5.63, 'en', 'First, it raises a hand to get your attention.', 'point_up'],
  [8.34, 'en', 'But why does it change its expression?', 'shrug', 'surprised'],
  [10.59, 'en', 'Because every story needs a little emotion.', 'idle'],
  [13.65, 'en', 'You speak, it moves, and the message comes alive.', 'point_viewer'],
  [15.45, 'en', 'The message comes alive.', 'fist'],
  [17.68, 'en', 'Now let’s try the same thing in Ukrainian.', 'point_up'],
  [20.12, 'uk', 'Подивись на цього маленького аватара.', 'point_viewer'],
  [22.53, 'uk', 'Спочатку він піднімає руку, щоб привернути твою увагу.', 'point_up'],
  [26.22, 'uk', 'Але чому він змінює вираз обличчя?', 'shrug', 'surprised'],
  [28.90, 'uk', 'Тому що кожній історії потрібно трохи емоцій.', 'idle'],
  [32.16, 'uk', 'Ти говориш, він рухається, і повідомлення оживає.', 'point_viewer'],
  [34.25, 'uk', 'Повідомлення оживає.', 'fist'],
  [36.53, 'uk', 'А тепер подивімося, як голос і жести працюють разом у нашому короткому відео.', 'point_up'],
  [39.50, 'uk', 'Жести працюють разом.', 'point_viewer'],
  [40.80, 'uk', 'У нашому короткому відео.', 'fist'],
  [41.70, 'uk', '', 'idle'],
];
const poseKeyframes = [{ time: 0, pose: 'idle' }, ...phrases.map(([time, language, text, pose, emotion]) => ({
  time: Math.round((time - edit.trimStart) * 1000) / 1000,
  pose, bounce: true, ...(emotion ? { emotion } : {}),
}))];
const props = { pack: demoPack, ...envelope, poseKeyframes, scale: 9, position: { x: 528, y: 108 },
  stickerStyle: { outlineWidth: 9, outlineColor: '#ffffff', shadowBlur: 16, shadowOpacity: 0.18 },
  label: 'Bilingual sprite avatar' };
prepareAvatar(props);
const config = { ...props };
delete config.pack;
await writeFile(join(directory, 'assets/avatar/recording.js'),
  `import { demoPack } from './pack.js';\nexport const recordingProps = { pack: demoPack, ...${JSON.stringify(config, null, 2)} };\n`);
await writeFile(join(directory, 'analysis/phrases.json'), JSON.stringify(phrases.map(([sourceTime, language, text, pose]) => ({
  sourceTime, time: sourceTime - edit.trimStart, language, text, pose,
})), null, 2) + '\n');
console.log(`Baked ${envelope.audioEnvelope.length} RMS samples and ${poseKeyframes.length} pose keyframes`);
