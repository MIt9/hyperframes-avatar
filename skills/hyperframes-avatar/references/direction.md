# Compact direction for smaller models

Keep the model's job narrow: choose gesture times and supported emotion changes from timestamped speech. Give it the brief output, desired duration and timestamped phrases. Keep design JSON, image data, RMS arrays and implementation source out of its routine direction context unless the task changes those things.

Minimal valid output:

```json
{"version":1,"characterId":"pixel-presenter","duration":8,"motionPreset":"lively","commands":[{"time":0,"pose":"idle"},{"time":0.7,"pose":"point_viewer","bounce":true},{"time":2,"pose":"point_up","bounce":true},{"time":3.5,"pose":"shrug","emotion":"surprised","bounce":true},{"time":5,"pose":"fist","bounce":true},{"time":7,"pose":"idle"}]}
```

Times are seconds, increasing, at least 0.5 s apart, inside `[0, duration)`. The starter contract intentionally limits gesture density; change that contract explicitly if a different animation needs faster actions. Commands persist until the next command. Set `emotion: open` or omit emotion to return from surprise on the next keyframe. A bounce is a brief gesture accent, not an audio-driven bounce on every syllable.

Useful cues: question → shrug; “first/look/wait” or “спочатку/дивись/зачекай” → point_up; direct address → point_viewer; payoff → fist. These are editable defaults, not language understanding guarantees. Prefer phrase onsets and leave holds for important spoken ideas. When word-level ASR is unreliable, use sentence timestamps refined from waveform/silence boundaries.

Motion presets are supported numeric data in `assets/motion-presets.json`:

- `off`: historical instant pose changes, no breathing or rotation.
- `subtle`: 0.4% vertical breath, 0.5° sway, 1.5° gesture lean, 80 ms arm transition.
- `lively`: 0.8% vertical breath, 1.2° sway, 3° gesture lean, 120 ms arm transition.

All are functions of the current time. They animate the whole body and blend arm poses; they do not articulate individual joints, independently tilt the head, move pupils, or add new face artwork. `rig.json.plannedChannels` describes possible future art/renderer work only.

For audio, create RMS from the actual trimmed/normalized file that will be placed in the composition. `assets/runtime/scripts/audio-envelope.js` streams ffmpeg mono float32 at 24 kHz and writes RMS at the requested fps. The renderer uses three causal samples and thresholds 0.05 / 0.25. Adjust the recording's level before the prepass if it is too quiet; do not invent samples. This is amplitude-based lip-sync, not phoneme/viseme alignment.

For bilingual recordings, use language-appropriate ASR per section when auto-detection translates or misrecognizes the second language. Audio remains local unless the user authorizes an external provider. Do not assume the last recording's trim, duration or phrase markers apply to a new one.

JSON reduces the number of decisions and enables deterministic validation. Its token/cost benefit and a smaller model's direction quality have not been benchmarked by this skill; do not promise measured savings without an evaluation.
