# hyperframes-sprite-avatar

Talking 2D avatars for HyperFrames videos. The mouth follows an audio envelope, eyes blink, the body breathes and sways, gestures come from a timeline. Every visible state is a pure function of the frame time, so seeking and parallel rendering work. The core is a framework-free DOM component with TypeScript types and no runtime dependencies.

**Demo:** [`examples/videos/voice-test/renders/avatar-en-uk.mp4`](examples/videos/voice-test/renders/avatar-en-uk.mp4) — a pixel presenter speaking English and Ukrainian (38 s, 1080p, 30 fps).

## Install

```sh
npm install hyperframes-sprite-avatar
```

Node >= 22. GSAP is only needed for the HyperFrames adapter and the example compositions. `ffmpeg` is needed to extract the audio envelope.

## Two avatar kinds

- **Layered sprite**: `base → eyes → mouth → pose` layers on a shared grid, arm poses and bounce.
- **Talking portrait**: one flat illustration with the mouth removed. A vector mouth, blinking eyes and optional moving layers (a cat tail) are drawn over it. See [`skills/hyperframes-avatar/references/portrait.md`](skills/hyperframes-avatar/references/portrait.md).

## Usage

```js
import { createSpriteAvatar, bindHyperframes } from 'hyperframes-sprite-avatar';

const avatar = createSpriteAvatar({
  pack,                          // AvatarPackManifest, see src/index.d.ts
  scale: 4,
  position: 'bottom-right',
  audioEnvelope: [0, 0.1, 0.4, 0.2, 0],
  audioFps: 30,
  poseKeyframes: [{ time: 1, pose: 'point_up', bounce: true }],
});
container.append(avatar.element);   // container: position: relative, sized
await avatar.ready;
avatar.renderAt(1.09);              // seconds
const detach = bindHyperframes(avatar, { offset: 0 }); // follows HyperFrames hf-seek
```

Audio envelope from any audio file:

```sh
npx hyperframes-avatar-envelope speech.wav speech-envelope.json 30
```

Drop-in HyperFrames sub-composition: [`docs/hyperframes-component.md`](docs/hyperframes-component.md) (`npx hyperframes-avatar-create-component <id>`).

## Create your own avatar (agent skill)

[`skills/hyperframes-avatar/SKILL.md`](skills/hyperframes-avatar/SKILL.md) is a skill for an AI coding agent: it designs a character, validates JSON design tokens, builds a talking portrait from generated art (chroma-key, mouth/eye measuring) and compiles short scene JSON into a self-contained HyperFrames project. Install it with:

```sh
npx hyperframes-avatar-install-skill
```

## Examples

Everything that is not the package lives in [`examples/`](examples):

- `avatars/skill-test-v4/` — a woman and a tuxedo cat (`portrait.json`, `design.json`, `scene.json`, full generated projects in `project-*`).
- `videos/voice-test/` — the demo video above, with its source composition.
- `videos/all-avatars/` — the pixel presenter, the woman and the cat side by side.
- `demo/preview.htm` — interactive scrubber: `npm run demo`, then open <http://localhost:4173/examples/demo/preview.htm>.
- `notes/` — early design notes.

## Development

```sh
npm install
npm test
```

## License

MIT. Example artwork in `examples/avatars` and `examples/videos` was generated with AI image tools; the voice recording belongs to the repository author and is included as a demo sample.

---

# Довідка (українською)


## Асети

Усі шари повинні мати прозорий фон і однаковий розмір `gridSize`. Порядок: `base → eyes → mouth → pose`. Обов'язкові: база без очей, рота та рук; `eyes.open/blink`; `mouth.closed/half/open`; `poses.idle`. Решта поз довільні, але кожна поза таймлайна повинна бути в паку. Спрайт-шити поки не підтримуються.

Розташовуйте частини на спільній сітці, залишаючи місце для рук. Локальні URL визначаються відносно HTML-документа; для HyperFrames використовуйте `assets/...`. Обводка й тінь накладаються на групу одним SVG-фільтром, без обводок на стиках шарів. Кожен екземпляр має окремий filter id. `smile` зарезервовано в маніфесті, автоматичний lip-sync використовує три базові стани рота.

## Аудіо

Потрібен встановлений `ffmpeg`:

```sh
npm run envelope -- speech.wav speech-envelope.json 30
```

Скрипт потоково декодує аудіо в mono float32 24 kHz та записує `{ audioFps, audioEnvelope }`. Наявний вихідний файл не перезаписується. Значення RMS лежать у `[0, 1]`, автоматичної нормалізації немає. Пороги рота: `<0.05` закритий, `<0.25` напіввідкритий, решта відкритий. Застосовується причинне середнє трьох семплів; після кінця масиву рот закривається. Для тихого голосу нормалізуйте аудіо перед препроцесингом. Сам компонент аудіо не відтворює: додайте аудіодоріжку HyperFrames із тим самим початком, що й аватар.

## Жести

```js
import { tagGestures } from './src/index.js';
const poseKeyframes = tagGestures([
  { time: 0, text: 'Чому це важливо?' },
  { time: 2, text: 'Дивись на перше правило' },
  { time: 5, text: 'Ви можете повторити' },
  { time: 8, text: 'Готово!', finale: true },
], Object.keys(pack.layers.poses));
```

Це простий українсько-англійський мапер, а не семантична LLM-розмітка. Вхід — сегменти/слова з часом у секундах; фінал позначається явно. Таймлайн сортується, для однакових часових міток перемагає остання поза. Поза й емоція діють до наступного ключового кадру.
