# Character identity and asset readiness

Use `design.example.json` as a structured starting point, not as a mandatory person/skin tone/style. The current example is a smooth cartoon redesign of a periwinkle-hoodie pixel presenter. A different user character keeps its own identity and palette.

Design tokens lock intended choices: identity invariants, named colors, proportions, render style, allowed poses, expression studies and avoid list. Tokens can drive prompts and validation. They cannot guarantee that generated pixels match colors or anatomy; retain the approved image as the identity reference for later edits.

For animals or non-human mascots, use `identity.features` for fur, markings, ears and tail. Hair/outfit are optional; palette names should describe the actual subject (for example furBase/furStripe/nose), with only ink required. `pawToHeadWidth` can replace the optional hand ratio. Do not add human skin or clothing merely to satisfy a character example.

The base pose is neutral: relaxed limbs, closed mouth, no demonstration gesture as idle. Talking-portrait art (mouthless base, tail layer, eye boxes) is specified in `portrait.md`.

Readiness stages:

- `concept`: reference sheets/cutouts; useful for approval and subsequent image edits.
- `layered`: actual parts share a canvas and their anchors have been measured against the final artwork.
- `validated`: the layers decode, align, composite and animate correctly in browser snapshots.

The layered-sprite runtime (`pack.json`, not the talking portrait) composites `base → eyes → mouth → pose`; there `base` must omit eyes, mouth and arms. A talking portrait's `base` omits only the mouth; see `portrait.md`. Eyes: open/blink, optionally surprised. Mouth: closed/half/open, optionally smile (reserved, not used by automatic RMS selection). Every pose contains the arms on an otherwise transparent shared canvas. For separate head/brow/pupil animation, extend the renderer first; the proposed anchors in `rig.json` are not active channels.

Use actual alpha for transparent requests. For a local PNG, inspect it and use `sips -g hasAlpha` on macOS or `ffprobe` pixel format. A channel alone does not prove transparent pixels: inspect on contrasting backgrounds or measure alpha min/max. Every layer needs the same dimensions, framing and facial coordinates. Avoid full-pose crossfades that multiply opaque torso/face copies; transition the arms while keeping shared identity layers fixed.

To turn a model sheet into production art, generate/edit separate aligned parts with the approved reference; check each result. Do not label an arbitrary grid, transparent full-character cutout or approximate crop as a working sprite pack. Mechanical export from an existing layered art file is preferable when available. Use the image-editing tool for generative modifications; preserve approved alpha and identity.

For background-only cleanup, if two targeted image edits preserve the same visible halo, stop repeating the extraction prompt. Retain the original, label the candidate unaccepted, and report the remaining cleanup. An alpha channel or many zero-alpha pixels does not establish clean edges or empty negative space. Choose a different authorized preparation method before trying more generations.

The built-in prompt generator exports a design-based starting prompt. For identity edits, include the approved image and list the invariants. If a hand, expression or alignment fails, change that part in one focused follow-up rather than redrawing the whole character.
