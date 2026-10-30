# Bilingual avatar voice test

GOAL: Demonstrate the existing SpriteAvatar speaking the user's English and Ukrainian recording with speech-driven mouth states and phrase-driven gestures.

OUTPUT: HyperFrames, 1920 × 1080, 30 fps, 1160 frames, 38.666667 s, H.264/AAC MP4.

AUDIO: Use only the supplied recording. Preserve speech, pitch and rate. Trim source [3.3, 41.95) s, normalize to -16 LUFS with true peak ceiling -1.5 dBTP. Retain the original MP3 in assets/audio/original.mp3. No music or effects: this is a lip-sync test, and unmasked speech is the reference signal.

LOOK: Single existing pixel presenter, 96 × 96 grid at 9× scale, canvas top-left at (528, 108). Full-frame ground #E6EBE5, white composite outline 9 px, shadow blur 16 px / opacity 0.18. Avatar actual visible height approximately 720 px. No text or subtitles requested; no added text.

MOTION: RMS 30 Hz, causal 3-sample smoothing, mouth thresholds 0.05/0.25. 18 keyframes including idle. Pose-change impulse 0.18 s, maximum translateY -12 px and scaleY 1.06. Deterministic blinking from existing core. Mouth timing uses the final normalized/trimmed audio, never an unrelated synthetic envelope.

SHOTS: One uninterrupted shot. At local 0.2 s point to viewer; 2.33 s raise hand; 5.04 s surprised shrug; 7.29 s idle explanation; 10.35 s viewer; 12.15 s fist payoff; 14.38 s hand/transition. Ukrainian begins around 16.82 s and repeats the gesture structure at 19.23 / 22.92 / 25.60 / 28.86 / 30.95 / 33.23 / 36.20 / 37.50 s; settle at 38.40 s.

BANNED: Extra characters, captions, charts, badges, decorative particles, synthetic narration, background music that masks the voice, changing the speaker's speed, unseeded animation and live audio analysis during capture.

QA: Inspect first frame, raised hand, both question/answer transitions, language transition, final fist and mouth closure. Check MP4 contains audio and duration matches 1160/30 s. Inspect decoded video frames after encoding. Audio is measured/transcribed locally, not aurally reviewed by the agent.
