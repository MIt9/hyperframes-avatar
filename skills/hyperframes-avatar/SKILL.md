---
name: hyperframes-avatar
description: "Create consistent speaking avatars and direct their poses, expressions and body motion in HyperFrames using validated JSON, local artwork packs and precomputed audio envelopes. Use for character design, avatar packs, lip-sync scenes and avatar timeline changes; excludes realistic talking-head synthesis and ChatGPT Work pets."
---

# HyperFrames Avatar

Keep character identity, animation assets and scene direction separate. Reuse the target project's avatar implementation and the user's selected character. For a new project, this skill includes a tested DOM renderer, HyperFrames adapter and scaffold templates in `assets/runtime/` and `assets/templates/`.

## Contracts

- `design.json`: identity, palette, proportions and image-generation constraints. Validate with `assets/design.schema.json`.
- `rig.json`: normalized layer anchors, planned channels and numerical body-motion limits. A planning rig is not a finished animation pack. Schema: `assets/rig.schema.json`.
- `pack.json`: actual aligned sprite assets. Schema: `assets/pack.schema.json`; all layers share `gridSize`.
- `scene.json`: compact scene direction. Schema: `assets/scene.schema.json`. A smaller model usually needs only this contract and a compact pack brief.
- Audio RMS is computed by a script from the final edited audio, not authored by the model.

Run the helper with `uv run <skill-dir>/scripts/avatar_tool.py ...`, always through `uv run` (plain `python3` fails with `No module named 'jsonschema'`): its inline dependency metadata installs jsonschema and Pillow into uv's isolated environment. If uv is unavailable, use an existing Python environment containing jsonschema 4.x and Pillow. Do not install into a global Python environment as an incidental step.

Commands (the kind comes first): `validate <design|rig|scene|pack|portrait> <file>`, `prompt --design`, `brief --pack`, `compile`, `scaffold`, and for portraits `chroma`, `composite`, `grid`, `overlay`, `sample`. `--help` lists the arguments.

## Which profile

- Smooth 2D art, human or animal, talking, with blinking and a swaying tail/part: **talking portrait**. Read [references/portrait.md](references/portrait.md) and follow it start to finish: it covers art, measuring, scaffold and checks. Contract: `assets/portrait.schema.json`. Helpers: `chroma` (key a flat background to real alpha), `composite`, `grid`, `overlay`, `sample`.
- Pixel/sprite character with arm poses and `bounce`: the layered `pack.json` profile below.

For portraits the renderer animates mouth, blinks, layer sway and pause-timed body beats on its own. It has no bounce, arm gestures, scratching, head or gaze: never put them in a scene or promise them.

## Design or change a character

Read [references/artwork.md](references/artwork.md). Start with `assets/design.example.json` / `rig.example.json` only when a new character needs them; preserve an existing character's invariants. Validate the tokens, then export a prompt:

```sh
uv run <skill-dir>/scripts/avatar_tool.py validate design <design.json>
uv run <skill-dir>/scripts/avatar_tool.py prompt --design <design.json> --out <prompt.txt>
```

For requested raster art, use the available image-generation tool; a prompt file alone does not fulfill an image request. Generate a model sheet and, when useful, a neutral transparent reference preserving that identity. Save project-bound outputs in the project. Check actual transparency, anatomy, gesture clearance and identity consistency.

Generated sheets/cutouts are reference art until separated into aligned layers and checked in the renderer. Do not set `status: validated` from the generation result alone. An image model does not guarantee exact RGB values, anatomy, anchors or cross-pose registration; JSON records intended design, not pixel-perfect reproducibility.

## Direct a scene or manage an existing avatar

Read [references/direction.md](references/direction.md). Generate compact model context from the real pack; it excludes image data and unsupported features:

```sh
uv run <skill-dir>/scripts/avatar_tool.py brief --pack <pack.json>
```

Have the model return scene JSON only. Current scene v1 supports `idle`, `point_viewer`, `point_up`, `shrug`, `fist`; eyes `open`/`surprised`; bounce; and motion presets `off`, `subtle`, `lively`. The actual pack may expose fewer states. Do not invent head, gaze or brow controls from the planning rig: those independent channels are not implemented. Extend the contract deliberately if the target renderer gains them.

```sh
uv run <skill-dir>/scripts/avatar_tool.py validate scene <scene.json>
uv run <skill-dir>/scripts/avatar_tool.py compile --scene <scene.json> --pack <pack.json> \
  --envelope <envelope.json> --asset-root <project-dir> --out <project-dir>/assets/avatar/config.js
```

The compiler checks identity, poses, emotion artwork, timing, envelope and optional local PNG dimensions; unknown fields fail. It writes a ready-to-import default JS export or JSON according to the output suffix and refuses overwrites. `--design` additionally requires an identity-matching design marked validated after art QA. For smooth cartoon artwork use `--rendering auto`; pixel packs use `pixelated`. Validate then repair the smallest reported issue; after two failed repairs, inspect the violated contract rather than inventing new fields.

## Build or render a composition

Read [references/hyperframes.md](references/hyperframes.md). To start in a **new** directory from a real pack, use:

```sh
uv run <skill-dir>/scripts/avatar_tool.py scaffold --scene <scene.json> --pack <pack.json> \
  --asset-root <pack-project-dir> --gsap <existing-local-gsap.min.js> \
  --audio <optional-voice.wav> --project <new-project-dir>
```

Omit `--audio` for an explicitly silent scene. The scaffold copies the supplied audio, precomputes RMS locally with Node/ffmpeg, copies the runtime and GSAP, and authors declarative media. It does not normalize or trim audio: prepare the final recording first. Times are local to the avatar; raw audio starts at local zero. For edits inside an existing project, update its existing timeline and adapter instead of scaffolding over it. Failed scaffolds may leave their newly created directory for inspection; do not remove unrelated files to retry.

Run HyperFrames `check`, inspect snapshots, and open a preview. Render the file when requested or already authorized, then inspect decoded frames and verify duration and audio with ffprobe. A technical voice test may intentionally omit music and captions. Record limitations honestly, including whether sound was measured or listened to. Do not publish, send messages, clone a voice or buy services merely because this skill is active.
