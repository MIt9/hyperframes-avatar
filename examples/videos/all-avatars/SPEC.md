# Three avatars in one video

GOAL: Show every unique avatar created in this project at the same time, responding to the same bilingual recording.

OUTPUT: 1920×1080, 30 fps, 1160 frames / 38.666667 s, H.264/AAC MP4.

SOURCE: Reuse the user's prepared English/Ukrainian voice WAV from `videos/voice-test`. No additional trimming, stretching, synthetic voice, music or effects. All three avatars remain visible throughout the clip.

LAYOUT: Full-frame ground #E6EBE5. Header centered in (192,108,1536,64), Inter 52 px / weight 700. Three 544 px columns at x=96/688/1280, starting y=220. Labels at y=930 in Inter 32 px / weight 400. No captions, animated titles, logos, decorative particles, fake controls or CTA.

CHARACTERS: Pixel presenter keeps its existing layered sprites and RMS lip-sync unchanged. Woman (skill-test-woman) and tuxedo cat (skill-test-cat) use the supplied avatars/skill-test-v4 portrait packs and unchanged keyed 1254×1254 PNGs copied into assets/avatar/. Both portraits use width 544 and local position (0,80) within their columns; Ukrainian labels are Жінка and Кіт-смокінг. The cat tail renders behind the body with origin [500,1130]. Old portrait assets remain unused.

MOTION: Pixel presenter keeps its existing phrase gestures, bounce and deterministic breathing/sway. Both talking portraits share the original recording/envelope for RMS mouth articulation and use automatic blinks, breathing and pause-timed body beats with bounce disabled. The cat has automatic tail sway; portraits have no scripted gestures.

QA: Validate both adjusted portrait packs. Run HyperFrames check and inspect snapshots at 0.3, 0.8, 5.2, 20 and 37 s: all three fully visible; woman head to shoes and cat ears to paws plus left tail; blink near 0.8 s; changing speech mouth; tail root hidden; no clipping or overlap with header/labels. Do not render an MP4 for this swap. Audio is reused unchanged; it is not aurally reviewed by the agent.
