# hyperframes-sprite-avatar

[English](README.md) · **Українська**

Розмовні 2D-аватари для відео HyperFrames. Рот рухається за аудіо-огинаючою, очі кліпають, тіло дихає й похитується, жести задаються таймлайном. Кожен видимий стан залежить лише від часу кадру, тож перемотування та паралельний рендер працюють. Ядро — незалежний від фреймворку DOM-компонент із типами TypeScript і без runtime-залежностей.

[![Демо: піксельний ведучий говорить англійською та українською](docs/preview.gif)](https://github.com/MIt9/hyperframes-avatar/blob/main/examples/videos/voice-test/renders/avatar-en-uk.mp4)

▶ [Дивитися повне демо-відео](https://github.com/MIt9/hyperframes-avatar/blob/main/examples/videos/voice-test/renders/avatar-en-uk.mp4): піксельний ведучий говорить англійською та українською (38 с, 1080p, 30 fps).

## Встановлення

```sh
npm install hyperframes-sprite-avatar
```

Node >= 22. GSAP потрібен лише для адаптера HyperFrames і прикладів композицій. `ffmpeg` потрібен для отримання аудіо-огинаючої.

## Два види аватарів

- **Шаровий спрайт**: шари `base → eyes → mouth → pose` на спільній сітці, пози рук і підскок.
- **Розмовний портрет**: одна плоска ілюстрація без рота. Поверх малюються векторний рот, очі, що кліпають, і додаткові рухомі шари (наприклад, хвіст кота). Див. [`skills/hyperframes-avatar/references/portrait.md`](skills/hyperframes-avatar/references/portrait.md).

## Використання

```js
import { createSpriteAvatar, bindHyperframes } from 'hyperframes-sprite-avatar';

const avatar = createSpriteAvatar({
  pack,                          // AvatarPackManifest, див. src/index.d.ts
  scale: 4,
  position: 'bottom-right',
  audioEnvelope: [0, 0.1, 0.4, 0.2, 0],
  audioFps: 30,
  poseKeyframes: [{ time: 1, pose: 'point_up', bounce: true }],
});
container.append(avatar.element);   // container: position: relative, із розміром
await avatar.ready;
avatar.renderAt(1.09);              // секунди
const detach = bindHyperframes(avatar, { offset: 0 }); // слухає hf-seek HyperFrames
```

Готова підкомпозиція HyperFrames: [`docs/hyperframes-component.md`](docs/hyperframes-component.md) (`npx hyperframes-avatar-create-component <id>`).

### Асети

Усі шари повинні мати прозорий фон і однаковий розмір `gridSize`. Порядок: `base → eyes → mouth → pose`. Обов'язкові: база без очей, рота та рук; `eyes.open/blink`; `mouth.closed/half/open`; `poses.idle`. Решта поз довільні, але кожна поза таймлайна повинна бути в паку. Спрайт-шити поки не підтримуються.

Розташовуйте частини на спільній сітці, залишаючи місце для рук. Локальні URL визначаються відносно HTML-документа; для HyperFrames використовуйте `assets/...`. Обводка й тінь накладаються на групу одним SVG-фільтром, без обводок на стиках шарів. Кожен екземпляр має окремий filter id.

### Аудіо

Потрібен встановлений `ffmpeg`:

```sh
npx hyperframes-avatar-envelope speech.wav speech-envelope.json 30
```

Скрипт потоково декодує аудіо в mono float32 24 kHz та записує `{ audioFps, audioEnvelope }`. Наявний вихідний файл не перезаписується. Значення RMS лежать у `[0, 1]`, автоматичної нормалізації немає (тихий голос нормалізуйте заздалегідь). Пороги рота: `<0.05` закритий, `<0.25` напіввідкритий, решта відкритий. Застосовується причинне середнє трьох семплів; після кінця масиву рот закривається. Сам компонент аудіо не відтворює: додайте аудіодоріжку HyperFrames із тим самим початком, що й аватар.

### Жести

```js
import { tagGestures } from 'hyperframes-sprite-avatar';
const poseKeyframes = tagGestures([
  { time: 0, text: 'Чому це важливо?' },
  { time: 2, text: 'Дивись на перше правило' },
  { time: 5, text: 'Ви можете повторити' },
  { time: 8, text: 'Готово!', finale: true },
], Object.keys(pack.layers.poses));
```

Це простий українсько-англійський мапер за ключовими словами, а не семантична LLM-розмітка. Вхід — сегменти/слова з часом у секундах; фінал позначається явно. Таймлайн сортується, для однакових часових міток перемагає остання поза. Поза й емоція діють до наступного ключового кадру.

## Створення власного аватара (навичка для агента)

[`skills/hyperframes-avatar/SKILL.md`](skills/hyperframes-avatar/SKILL.md) — навичка для ШІ-агента. Вона проєктує персонажа, валідує JSON-токени дизайну, збирає розмовний портрет зі згенерованого арту (хромакей, вимірювання рота й очей) і компілює короткий scene JSON у самодостатній проєкт HyperFrames. Встановлення:

```sh
npx hyperframes-avatar-install-skill
```

## Приклади

Усе, що не є пакетом, лежить в [`examples/`](examples):

- `avatars/skill-test-v4/`: жінка та кіт у смокінгу (`portrait.json`, `design.json`, `scene.json`, повні згенеровані проєкти в `project-*`).
- `videos/voice-test/`: демо-відео вище з вихідною композицією.
- `videos/all-avatars/`: піксельний ведучий, жінка й кіт поруч.
- `demo/preview.htm`: інтерактивний повзунок часу. Запустіть `npm run demo` і відкрийте <http://localhost:4173/examples/demo/preview.htm>.
- `notes/`: ранні нотатки про дизайн.

## Розробка

```sh
npm install
npm test
```

## Ліцензія

MIT. Приклади арту в `examples/avatars` і `examples/videos` згенеровано ШІ-інструментами. Запис голосу належить авторові репозиторію й доданий як демо-зразок.
