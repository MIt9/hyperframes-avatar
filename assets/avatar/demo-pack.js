// Original geometric test art. All layers share a transparent 96 × 96 canvas.
const rect = (x, y, width, height, fill) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
const svg = (content) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" shape-rendering="crispEdges">${content}</svg>`);
const skin = '#d99d70';
const dark = '#24283b';
const sleeve = '#6376ba';
const hand = (x, y) => rect(x, y, 10, 10, dark) + rect(x + 2, y + 2, 6, 6, skin);
export const demoPack = {
  id: 'pixel-presenter', gridSize: [96, 96],
  layers: {
    base: svg(rect(26, 48, 44, 42, dark) + rect(29, 51, 38, 36, sleeve) + rect(40, 45, 16, 10, skin)
      + rect(26, 12, 44, 36, dark) + rect(30, 18, 36, 30, skin) + rect(26, 10, 44, 12, dark)
      + rect(26, 20, 6, 14, dark) + rect(62, 20, 8, 12, dark) + rect(43, 61, 3, 15, '#d8dcf1') + rect(51, 61, 3, 15, '#d8dcf1')),
    eyes: {
      open: svg(rect(36, 28, 5, 5, dark) + rect(55, 28, 5, 5, dark)),
      blink: svg(rect(35, 31, 7, 2, dark) + rect(54, 31, 7, 2, dark)),
      surprised: svg(rect(35, 26, 7, 8, '#ffffff') + rect(54, 26, 7, 8, '#ffffff') + rect(37, 28, 3, 5, dark) + rect(56, 28, 3, 5, dark)),
    },
    mouth: {
      closed: svg(rect(43, 40, 11, 2, dark)),
      half: svg(rect(43, 38, 11, 5, dark) + rect(45, 38, 7, 2, '#ffffff')),
      open: svg(rect(42, 36, 13, 9, dark) + rect(44, 36, 9, 2, '#ffffff') + rect(45, 42, 7, 2, '#c76c78')),
    },
    poses: {
      idle: svg(rect(20, 54, 10, 26, sleeve) + hand(20, 77) + rect(66, 54, 10, 26, sleeve) + hand(66, 77)),
      point_up: svg(rect(20, 54, 10, 26, sleeve) + hand(20, 77) + rect(66, 50, 12, 12, sleeve) + rect(72, 31, 10, 25, sleeve) + hand(72, 24) + rect(74, 14, 4, 14, skin)),
      point_viewer: svg(rect(20, 54, 10, 26, sleeve) + hand(20, 77) + rect(62, 55, 17, 14, sleeve) + hand(71, 53) + rect(75, 51, 6, 8, skin)),
      shrug: svg(rect(15, 55, 17, 10, sleeve) + rect(10, 44, 10, 17, sleeve) + hand(7, 38) + rect(64, 55, 17, 10, sleeve) + rect(77, 44, 10, 17, sleeve) + hand(79, 38)),
      fist: svg(rect(20, 54, 10, 26, sleeve) + hand(20, 77) + rect(65, 42, 12, 20, sleeve) + rect(72, 23, 11, 23, sleeve) + hand(71, 15)),
    },
  },
};

export const demoProps = {
  pack: demoPack, scale: 4, audioFps: 30,
  // Synthetic envelope only: replace with audio-envelope.js output for real speech.
  audioEnvelope: Array.from({ length: 540 }, (_, i) => i % 90 > 65 ? 0 : (0.3 + 0.28 * Math.sin(i * 0.35))),
  poseKeyframes: [
    { time: 0, pose: 'idle' }, { time: 1, pose: 'point_up', bounce: true },
    { time: 4, pose: 'point_viewer', bounce: true }, { time: 9, pose: 'shrug', emotion: 'surprised', bounce: true },
    { time: 13, pose: 'idle', bounce: true }, { time: 16, pose: 'fist', bounce: true },
  ],
};
