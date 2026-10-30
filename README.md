# hyperframes-sprite-avatar

**English** · [Українська](README.uk.md)

Talking 2D avatars for HyperFrames videos. The mouth follows an audio envelope, eyes blink, the body breathes and sways, gestures come from a timeline. Every visible state is a pure function of the frame time, so seeking and parallel rendering work. The core is a framework-free DOM component with TypeScript types and no runtime dependencies.

[![Demo: pixel presenter speaking English and Ukrainian](docs/preview.gif)](https://github.com/MIt9/hyperframes-avatar/blob/main/examples/videos/voice-test/renders/avatar-en-uk.mp4)

▶ [Watch the full demo video](https://github.com/MIt9/hyperframes-avatar/blob/main/examples/videos/voice-test/renders/avatar-en-uk.mp4): a pixel presenter speaking English and Ukrainian (38 s, 1080p, 30 fps).

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

Drop-in HyperFrames sub-composition: [`docs/hyperframes-component.md`](docs/hyperframes-component.md) (`npx hyperframes-avatar-create-component <id>`, docs in Ukrainian).

### Sprite assets

All layers need a transparent background and the same `gridSize`. Order: `base → eyes → mouth → pose`. Required: a base without eyes, mouth and arms; `eyes.open/blink`; `mouth.closed/half/open`; `poses.idle`. Other poses are free-form, but every pose used in the timeline must exist in the pack. Sprite sheets are not supported yet.

Place parts on a shared grid and leave room for the arms. Local URLs resolve against the HTML document; in HyperFrames use `assets/...`. Outline and shadow are applied to the whole group by one SVG filter, so layer seams have no outlines. Each instance gets its own filter id.

### Audio

Needs `ffmpeg`:

```sh
npx hyperframes-avatar-envelope speech.wav speech-envelope.json 30
```

The script streams the audio as mono float32 24 kHz and writes `{ audioFps, audioEnvelope }`. An existing output file is never overwritten. RMS values are in `[0, 1]`, there is no automatic normalization (normalize quiet voices first). Mouth thresholds: `<0.05` closed, `<0.25` half open, otherwise open; a causal 3-sample average is applied and the mouth closes after the array ends. The component does not play audio: add a HyperFrames audio track that starts at the same time as the avatar.

### Gestures

```js
import { tagGestures } from 'hyperframes-sprite-avatar';
const poseKeyframes = tagGestures([
  { time: 0, text: 'Why does this matter?' },
  { time: 2, text: 'Look at the first rule' },
  { time: 5, text: 'You can repeat it' },
  { time: 8, text: 'Done!', finale: true },
], Object.keys(pack.layers.poses));
```

A simple English/Ukrainian keyword mapper, not semantic LLM tagging. Input is segments or words with times in seconds; the finale is marked explicitly. The timeline is sorted; for equal timestamps the last pose wins. A pose and emotion stay until the next keyframe.

## Create your own avatar (agent skill)

[`skills/hyperframes-avatar/SKILL.md`](skills/hyperframes-avatar/SKILL.md) is a skill for an AI coding agent. It designs a character, validates JSON design tokens, builds a talking portrait from generated art (chroma-key, mouth/eye measuring) and compiles short scene JSON into a self-contained HyperFrames project. Install it with:

```sh
npx hyperframes-avatar-install-skill
```

## Examples

Everything that is not the package lives in [`examples/`](examples):

- `avatars/skill-test-v4/`: a woman and a tuxedo cat (`portrait.json`, `design.json`, `scene.json`, full generated projects in `project-*`).
- `videos/voice-test/`: the demo video above with its source composition.
- `videos/all-avatars/`: the pixel presenter, the woman and the cat side by side.
- `demo/preview.htm`: interactive scrubber. Run `npm run demo`, then open <http://localhost:4173/examples/demo/preview.htm>.
- `notes/`: early design notes (Ukrainian).

## Development

```sh
npm install
npm test
```

## License

MIT. Example artwork in `examples/avatars` and `examples/videos` was generated with AI image tools. The voice recording belongs to the repository author and is included as a demo sample.
