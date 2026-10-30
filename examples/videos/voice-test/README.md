# English / Ukrainian voice test

Тест SpriteAvatar із записом користувача. Фінальний файл: `renders/avatar-en-uk.mp4`.

- 1920 × 1080, 30 fps, приблизно 38.67 секунди.
- Одна безперервна сцена, без субтитрів і музики.
- Рот: RMS з фактичного WAV-файла; пози: фразові мітки обома мовами.
- Початкову й кінцеву паузи прибрано; голос нормалізовано до цілі -16 LUFS / -1.5 dBTP без зміни швидкості та висоти.
- Вхідний MP3 збережений без змін у `assets/audio/original.mp3`.

Готовий проєкт відкривається та рендериться окремо від бібліотечного демо:

```sh
npx hyperframes@0.8.214 preview . --background
npx hyperframes@0.8.214 check . --json
npx hyperframes@0.8.214 render . --quality delivery --fps 30 --format mp4 --output renders/avatar-en-uk.mp4 --json
```

Скрипти підготовки лежать в `examples/scripts/`. Вони призначені саме для цього запису: обрізання та жести прив'язані до його часових міток.

```sh
# Із кореня репозиторію; prepare призначено для першого створення аудіофайлів.
node examples/scripts/prepare-voice-demo.js /path/to/recording.mp3
node scripts/audio-envelope.js examples/videos/voice-test/assets/audio/voice.wav examples/videos/voice-test/analysis/envelope.json 30
node examples/scripts/build-voice-demo.js
node scripts/verify-voice-demo.js examples/videos/voice-test/renders/avatar-en-uk.mp4
```

`analysis/en/` та `analysis/uk/` містять локальні ASR-матеріали. Відредаговані фразові мітки — `analysis/phrases.json`. `src/` і `assets/avatar/pack.js` — копії використаної версії компонента/тестового пака, щоб цей відеопроєкт лишався самодостатнім. Подальші зміни бібліотеки не оновлюють його автоматично.

Перевірки та свідомі обмеження описано в `REVIEW.md`; параметри ролика — у `SPEC.md`.
