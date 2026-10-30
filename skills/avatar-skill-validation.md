# Avatar skill validation

- `skill-creator` quick validator: valid skill frontmatter, entrypoint and resource structure.
- Node core suite: 21 passing tests, including seek order, off-by-default motion, bounded breathing/sway, pose transitions, invalid motion values and adapter lifecycle.
- Skill helper suite: 12 passing tests, including unknown controls, invalid timing, identity mismatch, missing pose/emotion art, non-finite envelope, duplicate JSON keys, file overwrite protection, path escape checks, audio scaffolding and non-human character tokens without human clothing/skin requirements.
- TypeScript declaration check: strict, ES2022 + DOM, no errors.
- Real scaffold output: `artifacts/skill-smoke/`; HyperFrames 0.8.214 check passes lint/runtime/layout/craft with no warnings. Audio absence is informational for this explicitly silent 8 s test.
- Inspected six generated browser frames at 0 / 0.76 / 2.06 / 3.56 / 5.06 / 7.4 s. Whole-body motion and arm blending are present; arm blending briefly shows both silhouettes and does not provide skeletal joint interpolation.
- Generated concept sheet: 1536×1024 RGB. Neutral cutout: 1254×1254 RGBA with measured alpha minimum 0 / maximum 255. Both generated using built-in image_gen and copied into the project.
- New art is marked concept; its rig is planning only. No claim that a reference sheet is an aligned runtime pack.
- JSON contracts have not been benchmarked with cheaper models; no measured cost or quality savings are claimed.
