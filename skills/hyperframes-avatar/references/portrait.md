# Talking portrait: build a new human or animal from scratch

Profile `talking-portrait` (`assets/portrait.schema.json`). Use it for smooth 2D art (not pixel sprites). One transparent mouthless base PNG, plus a drawn mouth, blinking eyelids and optional swaying parts. Follow the steps in order; each ends with a check. Do not skip a check, do not claim a step done on the strength of the generation alone.

## What the renderer does by itself (no scene commands needed)

- Mouth: `closed/half/open` from the audio RMS (amplitude, not phonemes).
- Blink: every ~3 s, an occasional double blink. Needs `eyes`.
- Layer sway: each layer with `motion` swings around its `origin` (tail, ear, hair lock) with rests in between.
- Body beats: a small weight shift and lean (under 1°) about every 6.5 s, held back until a pause in the speech.
- Breathing: 0.4 % vertical scale.

**Not supported, never promise or script them:** bounce/jump/squash (`bounce` is rejected for portraits), arm or hand gestures, scratching, head turns, gaze, brows, emotions. Those need separate art layers *and* renderer support. The pixel profile (`pack.json`) keeps `bounce` as a style choice.

## 1. Design the character

`design.json` from `assets/design.example.json` (animals: see `artwork.md`), then `validate design` and `prompt`. Generate a reference sheet with the image tool.

**Neutral pose is mandatory:** arms/paws relaxed in a natural resting position, mouth closed, eyes open looking at the viewer, tail visible and not hidden behind the body. A demonstration gesture (open palms, pointing, a raised paw) is not a neutral pose.

## 2. Make the base (transparent, no mouth)

Image models do not output real transparency. Generate every part on a **flat chroma-key background** and key it out with the helper.

1. Pick the key colour that the character does **not** contain: `#00FF00` (default), or `#FF00FF` for a green character (green sweater, green eyes), or `#0000FF`. Set `render.background` in `design.json` to that hex colour (the schema takes only a hex value); the exported prompt then asks for one flat solid background of it, no shadow, gradient or floor. Light tints of the key colour count too: do not key a pink character on magenta.
2. Generate or edit the approved reference into one full-canvas image: neutral pose, **mouth absent** (skin/fur continuous where the mouth was). Never paint a second mouth over a drawn one.
3. Animal with a tail: `base-mouthless.png` **is the body without the tail**. Generate it, and also the **tail alone** (`tail.png`), both on the same canvas size, same pose and framing. The tail root must overlap the body, because the tail renders behind it. Human or tailless animal: only `base-mouthless.png`.
4. Key every part, then look at it on three backgrounds:

```sh
uv run <skill-dir>/scripts/avatar_tool.py chroma raw-base.png --out base-mouthless.png --key "#00FF00"
uv run <skill-dir>/scripts/avatar_tool.py composite base-mouthless.png --out check.png   # white | near-black | magenta, side by side
```

`chroma` refuses an image whose corners are not the key colour (regenerate on a flat background) and one that keys out everything (the character contains the key colour: choose another `--key`). The defaults (`--tolerance 60 --softness 50`) were verified on real generated art (a human on magenta, a cat with thin whiskers on green) and are normally right: **use them first and do not change them without a reason.** The helper already removes the key tint from edge pixels.

Judge `check.png` by looking at the whole image at normal size:
- **Accept** if the subject's colours are intact and at most a faint, thin tint remains on the very tips of thin hairs/whiskers on the white tile. That is not a defect; carry on and mention it in the report.
- **Re-key** (new output name; files are never overwritten) only for real defects: a visible coloured outline around the body, background patches left behind (raise `--tolerance` by 15), or holes/transparency inside the subject (lower `--tolerance` by 15; never go above `--softness 80`).
- If after two re-keys a real defect remains, stop, keep the best one and report it as unaccepted.
5. All parts: identical pixel size, same framing. Save inside the project under `assets/avatar/`.

## 3. Measure, do not guess

All coordinates are **fractions of the base image** (0–1), except layer `origin` which is in base pixels.

```sh
uv run <skill-dir>/scripts/avatar_tool.py grid base-mouthless.png --out grid.png   # labelled 0.1 grid; look at it
uv run <skill-dir>/scripts/avatar_tool.py sample base-mouthless.png 0.45 0.28       # median colour -> eyes.color
```

- `mouth`: box around where the mouth should be; `style` `human` or `cat`; colours `ink/teeth/tongue` from the design palette.
- `eyes.boxes`: one box per eye covering the whole open eye (white, iris and lash line), a little generous. `eyes.color` = skin/fur colour *next to* the eye (sample it), `line` = dark outline colour.
- `layers[]`: `{id, src, placement: "behind", origin: [px, py], motion}`. `origin` is the point where the part attaches to the body (tail root). Typical tail motion: `{"type":"sway","amplitude":7.5,"period":1.8,"cycle":5.4,"active":3.6}`. Keep amplitude ≤ 10°.

Write `portrait.json` (start from `assets/portrait.example.json`). `base` and every `layers[].src` are paths **relative to the asset root** (the directory you pass as `--asset-root`, normally the project folder that contains `assets/`), e.g. `assets/avatar/base-mouthless.png`; they are not relative to `portrait.json`. Then run the checks; `overlay` and `scaffold` take the paths from `--image`/`--asset-root`:

```sh
uv run <skill-dir>/scripts/avatar_tool.py validate portrait portrait.json
uv run <skill-dir>/scripts/avatar_tool.py overlay --pack portrait.json --image base-mouthless.png --out overlay.png
```

Look at `overlay.png`: mouth box on the mouth place, eye boxes on the eyes, pivot circle on the tail root. Fix the numbers and repeat until they are right.

## 4. Scene, scaffold, check

`scene.json` for a portrait is `{"version":1,"characterId":"<pack id>","duration":<seconds>,"motionPreset":"off","commands":[{"time":0,"pose":"idle"}]}`. The schema requires `motionPreset`; always write `"off"`, portraits ignore it. No other poses, no `bounce`. `brief --pack portrait.json` prints what is supported.

```sh
uv run <skill-dir>/scripts/avatar_tool.py scaffold --scene scene.json --pack portrait.json \
  --asset-root <dir-containing-assets/> --gsap <local gsap.min.js> --audio voice.wav --project <new-dir> --rendering auto
cd <new-dir> && npx hyperframes check . --json
npx hyperframes snapshot . --at 0.3,0.8,2,5.2 --no-end --output review
```

Look at the snapshots: eyes open at 0.3 s and closed at ~0.8 s and ~5.2 s (first blinks of any project), the mouth changes with speech, lids leave no ring around the eye, the tail root is hidden behind the body, no rectangle behind the character on a light or a dark background. Fix the smallest wrong thing (a box size, a colour, a pivot) and rebuild.

Only then render. Verify duration and the audio track of the MP4 with ffprobe.
