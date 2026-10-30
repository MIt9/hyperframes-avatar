# Render and integration details

The bundled code is a dependency-free DOM renderer plus a GSAP adapter. The scaffold needs Node 22+, ffmpeg for audio, and an existing local GSAP minified bundle. It copies that bundle rather than loading a CDN during capture. HyperFrames is invoked through its CLI in the resulting project.

For an existing package, import `mountHyperframesAvatar` from its HyperFrames adapter and the compiled default config. Call it with a sized root, a unique composition id, finite duration, scoped GSAP and window. Await readiness before exposing the registered timeline. Use `destroy()` for manual unmounting; it removes its DOM/listener/timeline and owned registry entries.

Sub-composition gotcha observed in real renders: HyperFrames transfers the inner root's metadata onto the host and keeps the inner wrapper as an authored-root alias. Capture the scoped `document.querySelector('#root')` before async imports. Derive runtime identity from `root.closest('[data-composition-id]')` and pass composition id and duration explicitly to the adapter. Pass the **scoped** `window` and `gsap` captured by the template script. Merely inspecting the raw HTML does not reveal this mount behavior.

Keep each authored host id, inner composition id and timeline registry key consistent. For additional authored instances, create a template copy with matching unique ids or use the target runtime's verified instance mechanism. Do not manually nest the sub-timeline into the main timeline: HyperFrames seeks it in local time. In an existing project, preserve the user's timing, variables and media edits.

All timed hosts/media are static authored HTML with `clip`, `data-start`, `data-duration` and stable ids. Do not make or seek audio through JavaScript. The root duration controls the output and must cover the scene/audio. Shader-free scene fills belong on a full-frame child. GSAP animates a numerical clock; image state and body transforms are resolved deterministically from that clock. `hf-seek.waitUntil` waits for displayed image decoding.

Commands, from the video project directory:

```sh
npx hyperframes@0.8.214 history --since mine --who codex
npx hyperframes@0.8.214 timeline --json
npx hyperframes@0.8.214 check . --json
npx hyperframes@0.8.214 snapshot . --at 0,1,3 --no-end --output review-frames
npx hyperframes@0.8.214 preview . --background
npx hyperframes@0.8.214 render . --quality delivery --fps 30 --format mp4 --output renders/avatar.mp4 --json
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate -of json renders/avatar.mp4
```

0.8.214 is the tested CLI version for these templates. When targeting another release, inspect its local CLI help and recheck the template mount before broad changes. Initial successful lint/runtime checks can still hide a blank avatar: inspect screenshots at the first frame, a pose change, a question, a language boundary and the final state. Inspect decoded MP4 frames as well as HTML snapshots. Record intentional holds and whether audio was actually heard.

The source repository has a real bilingual recording example at `examples/videos/voice-test`. This is a local discovery hint, not a required path: the skill's contracts, compiler and runtime are self-contained.
