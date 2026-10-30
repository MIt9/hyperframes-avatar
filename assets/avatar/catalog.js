import { demoPack, demoProps } from './demo-pack.js';

// Replace/add packs and precomputed envelopes here; imports resolve before capture.
export const catalog = {
  packs: { 'pixel-presenter': demoPack },
  animations: {
    demo: {
      audioEnvelope: demoProps.audioEnvelope,
      audioFps: demoProps.audioFps,
      poseKeyframes: demoProps.poseKeyframes,
    },
    idle: { poseKeyframes: [], audioEnvelope: [], audioFps: 30 },
  },
};
