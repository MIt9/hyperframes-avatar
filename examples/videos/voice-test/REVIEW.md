# Review — English / Ukrainian recording

## Creative choices

One continuous shot of the existing pixel presenter against #E6EBE5. The recording and the avatar's gestures are the subject. No additional characters, captions, music or sound effects: this is a technical lip-sync test, so the recorded voice remains the only audio reference. A multi-scene explainer or a promotional edit would make comparison harder and is outside this test.

## Pre-render checks

- HyperFrames 0.8.214 check passed: no lint, runtime or layout errors.
- Review beat and 360 px phone sheets inspected: avatar, fingers, outline and bounce remain inside frame; no unwanted seam or blank scene.
- RMS is generated from the normalized/trimmed voice WAV, not the demo envelope. Three mouth states remain time-driven and deterministic.
- Phrase gestures follow both English and Ukrainian: pointing on the introduction, raised hand on “First” / “Спочатку”, surprised shrug on the question, direct address and final fist.
- Local Whisper transcribed each language independently; English-only auto detection had translated the Ukrainian section, so that auto transcript was not used as Ukrainian source text.
- One craft warning is kept: 3.37 s of apparently static pose during the raised-hand phrase at 19.46–22.83 s. The hand intentionally holds while the phrase finishes; mouth/blinks continue. Extra movement would weaken the hand-raising test.

## Limits

The presenter is the existing geometric test pack. Lip-sync is three-state RMS animation, not phoneme/viseme alignment. Phrase timestamps are refined from silence boundaries; the long leading recording pause makes the first ASR word timings unsuitable as exact word alignment. Sound is analyzed/transcribed locally and measured, not aurally reviewed by the agent. The weakest visual moment is a multi-second pose hold; a production character pack could add hand articulation without changing the core.

## Delivery verification

Delivered `renders/avatar-en-uk.mp4`: 1,217,464 bytes, H.264 1920×1080 at 30 fps, 1160 frames / 38.666667 s; AAC stereo 48 kHz, 38.666 s. Codec, duration, frame count and presence of audio passed `scripts/verify-voice-demo.js`; results are in `analysis/verification.json`.

Six frames decoded from the MP4 (first, raised hand, English question, Ukrainian question, final fist, final closed mouth) were inspected in `review-keyframes/encoded-contact-sheet.jpg`. No crop, missing avatar, broken outline or encoding artifact was found.

Final encoded audio measured -16.87 LUFS integrated, -1.50 dBTP true peak, LRA 8.60 LU. The normalized WAV is 38.606 s; the framework pads the final ~0.06 s to the video timeline, with the mouth closed at the end. Sound was measured/transcribed, not listened to. Core regression suite remains 17/17 passing.
