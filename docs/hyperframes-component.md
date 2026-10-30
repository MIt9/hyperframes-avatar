# SpriteAvatar як компонент HyperFrames

## Готовий компонент

`compositions/sprite-avatar.html` — підкомпозиція, `src/hyperframes.js` — її адаптер, `src/index.js` і `src/state.js` — самостійне ядро. Адаптер використовує GSAP із проєкту; npm-залежностей у ядра немає.

У проєкт HyperFrames скопіюйте `src/`, потрібні файли `compositions/`, `assets/avatar/` та власні спрайти. Демонстраційний каталог також імпортує `demo/pack.js`; скопіюйте його або замініть імпорт своїм паком. В кореневому HTML має бути підключений GSAP. Шляхи `./src/...` у шаблоні визначаються відносно кореневого документа проєкту.

Додайте слот у `index.html`:

```html
<div id="sprite-avatar" class="clip"
  data-composition-id="sprite-avatar"
  data-composition-src="compositions/sprite-avatar.html"
  data-start="2" data-duration="14"
  data-track-index="2" data-track-kind="graphics"
  data-width="1920" data-height="1080"
  data-variable-values='{
    "pack":"pixel-presenter",
    "animation":"demo",
    "scale":4,
    "position":"bottom-left",
    "outlineColor":"#F5DE99"
  }'></div>
```

HyperFrames контролює видимість слота на `[2, 16)`. Анімація аватара починається з локального часу `0` на глобальній секунді `2`. Переміщення слота змінює його початок без перерахунку жестів. Не викликайте `bindHyperframes` для цього ж екземпляра: адаптер уже слухає події та отримує час із власного timeline.

Шаблон має локальну тривалість 18 секунд. Коротший слот обрізає анімацію, довший утримує її останній стан. Для довшого пресета збільште `data-duration` шаблона та `duration` у виклику адаптера разом. Тривалість кореневої композиції повинна охоплювати слот.

## Параметри

Змінні оголошено на `<html data-composition-variables>` підкомпозиції. Значення для екземпляра задаються через `data-variable-values`; їхні типи та назви доступні редактору HyperFrames.

| Параметр | Призначення |
| --- | --- |
| `pack` | Ключ персонажа з `catalog.packs` |
| `animation` | Ключ готового envelope і жестів із `catalog.animations` |
| `scale` | Масштаб спрайтів |
| `position` | `bottom-left`, `bottom-right` або `custom` |
| `x`, `y` | Координати верхнього лівого кута для `custom` |
| `outlineWidth`, `outlineColor` | Обводка всього персонажа |
| `shadowBlur`, `shadowOpacity` | Тінь |
| `label` | Доступна назва аватара |

Додавши пак або анімацію в `assets/avatar/catalog.js`, також додайте його ключ до `options` відповідної enum-змінної шаблона. `idle` — мовчазне очікування з процедурним кліпанням. Невідомий ключ спричиняє помилку підготовки.

## Кілька екземплярів

У кожного слота, внутрішньої композиції та ключа `window.__timelines` має бути узгоджений унікальний id. Генератор створює окремий шаблон із правильними id та друкує HTML слота:

```sh
npm run component -- second-presenter
```

Існуючий файл не перезаписується. У цьому репозиторії `sprite-avatar-left.html` створено цим генератором. Головний приклад показує два екземпляри: правий із масштабом 7 на `[0, 18)`, лівий із масштабом 4 та жовтою обводкою на `[2, 16)`. Обидва використовують один каталог, але мають незалежні локальні годинники та SVG-фільтри.

Генератор робить копію шаблона. Подальші зміни його схеми не синхронізуються з уже створеними копіями автоматично.

## Власне аудіо та жести

1. Підготуйте огинаючу до рендера:

   ```sh
   npm run envelope -- assets/speech.wav speech-envelope.json 30
   ```

2. Створіть локальний модуль `assets/avatar/speech.js`: `export default { ... };`, вставивши об'єкт із JSON. Додайте до нього `poseKeyframes`; їх можна підготувати через `tagGestures` із сегментів транскрипту. Час жестів та envelope рахується від початку цього аудіофайла.
3. Імпортуйте модуль у `catalog.js` й додайте `animations.speech`. У enum `animation` додайте `speech`, у слоті задайте `"animation":"speech"`.
4. Додайте аудіо декларативно з тим самим глобальним початком:

   ```html
   <audio id="presenter-speech" class="clip" src="assets/speech.wav"
     data-start="2" data-duration="14" data-track-index="3"
     data-volume="1"></audio>
   ```

Відтворенням і seek аудіо керує HyperFrames. Приклад вище використовує аудіо з початку файла без прискорення. Якщо обрізаєте джерело через `data-media-start` або змінюєте швидкість, відповідно перераховуйте envelope/жести заздалегідь. Адаптер не робить цього автоматично. Зміна паків чи envelope через мережеві `fetch` під час захоплення кадрів не потрібна.

## Використання адаптера без HTML-шаблона

Для власної кореневої композиції можна оголосити ці ж змінні на її `<html>` та передати їх адаптеру:

```js
import { mountHyperframesAvatar, avatarPropsFromVariables } from './src/hyperframes.js';
import { catalog } from './assets/avatar/catalog.js';

const variables = window.__hyperframes.getVariables();
const component = mountHyperframesAvatar(
  document.querySelector('#avatar-root'),
  avatarPropsFromVariables(variables, catalog),
  { compositionId: 'presenter', duration: 18, gsap, target: window },
);
await component.ready;
// component.timeline зареєстрований під ключем presenter.
// Під час демонтування:
// component.destroy();
```

`root` повинен мати визначені розміри й `position: relative` або `absolute`. Для ручного створення цілої композиції її id та зареєстрований ключ також повинні збігатися. Глобальні CLI-змінні кореня не підмінюють `data-variable-values` дочірньої композиції автоматично; використовуйте наведений API або значення потрібного слота.

`ready` очікує декодування асетів і першого видимого кадру, після чого реєструє paused timeline. `hf-seek` також очікує декодування поточних шарів. `destroy()` прибирає DOM, listener, timeline та власні записи в реєстрах; повторний виклик безпечний. Якщо завантаження завершується після `destroy()`, компонент уже не додається до DOM. Помилки асетів відхиляють `ready` та очищають компонент.

## Перевірка

```sh
npm test
npx hyperframes@0.8.214 check . --json
npx hyperframes@0.8.214 snapshot . --at 0,2,3.09,9.09,16.09 --no-end --output snapshots
npx hyperframes@0.8.214 preview . --background
```

Перевірено 17 тестів, включно з реальним GSAP timeline, незалежністю екземплярів, suppressed callbacks, readiness, помилками асетів і раннім демонтуванням. HyperFrames check проходить: lint, runtime та layout без помилок і попереджень; лишається одне творче попередження про відсутній звук у технічному демо. На знімках перевірено різні пози, обводки, локальний зсув 2 секунди та зникнення лівого екземпляра після його слота. Знімки: `artifacts/component/contact-sheet.jpg`.
