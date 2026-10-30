import { resolveAudioState } from './state.js';
import { blinkAmount, bodyBeat, swayAngle } from './motion.js';

const SVG = 'http://www.w3.org/2000/svg';

export function prepareTalkingPortrait(props) {
  const pack = structuredClone(props.pack);
  if (pack?.kind !== 'talking-portrait' || !pack.id || !pack.base || !pack.mouthlessBase) {
    throw new TypeError('A talking-portrait pack with a verified mouthless base is required');
  }
  if (!Array.isArray(pack.size) || pack.size.length !== 2 || pack.size.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw new TypeError('Portrait size must contain two positive integer dimensions');
  }
  const mouth = pack.mouth;
  if (!mouth || !['human', 'cat'].includes(mouth.style)) throw new TypeError('Unsupported mouth style');
  for (const key of ['x', 'y', 'width', 'height']) {
    if (!Number.isFinite(mouth[key]) || mouth[key] < 0 || mouth[key] > 1) throw new TypeError(`Invalid mouth.${key}`);
  }
  if (mouth.width <= 0 || mouth.height <= 0 || mouth.x + mouth.width > 1 || mouth.y + mouth.height > 1) {
    throw new TypeError('Mouth box must fit the source canvas');
  }
  for (const color of [mouth.ink, mouth.teeth, mouth.tongue]) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new TypeError('Mouth colors must be hex RGB');
  }
  if (pack.eyes !== undefined) {
    const { color, line, boxes } = pack.eyes;
    if (![color, line].every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))) throw new TypeError('Eye colors must be hex RGB');
    if (!Array.isArray(boxes) || !boxes.length) throw new TypeError('eyes.boxes must be a non-empty array');
    for (const box of boxes) {
      for (const key of ['x', 'y', 'width', 'height']) {
        if (!Number.isFinite(box[key]) || box[key] < 0 || box[key] > 1) throw new TypeError(`Invalid eye box ${key}`);
      }
      if (box.width <= 0 || box.height <= 0 || box.x + box.width > 1 || box.y + box.height > 1) throw new TypeError('Eye box must fit the source canvas');
    }
  }
  if (pack.layers !== undefined) {
    if (!Array.isArray(pack.layers)) throw new TypeError('pack.layers must be an array');
    for (const layer of pack.layers) {
      if (!layer || typeof layer.id !== 'string' || typeof layer.src !== 'string') {
        throw new TypeError('Each layer must have id and src strings');
      }
      if (layer.placement !== undefined && !['behind', 'front'].includes(layer.placement)) {
        throw new TypeError('Layer placement must be behind or front');
      }
      if (layer.origin !== undefined) {
        if (!Array.isArray(layer.origin) || layer.origin.length !== 2 || layer.origin.some((n) => !Number.isFinite(n))) {
          throw new TypeError('Layer origin must contain two numeric coordinates');
        }
      }
      if (layer.motion !== undefined) {
        const m = layer.motion;
        if (m?.type !== 'sway' || !layer.origin) throw new TypeError('Layer motion must be {type:"sway"} and needs an origin');
        if (!Number.isFinite(m.amplitude) || m.amplitude < 0 || m.amplitude > 20) throw new TypeError('motion.amplitude must be in [0,20] degrees');
        if (!Number.isFinite(m.period) || m.period <= 0) throw new TypeError('motion.period must be positive');
        for (const key of ['cycle', 'active', 'rest']) {
          if (m[key] !== undefined && (!Number.isFinite(m[key]) || m[key] < 0)) throw new TypeError(`motion.${key} must be non-negative`);
        }
        if ((m.active ?? 3.6) > (m.cycle ?? 5.4)) throw new TypeError('motion.active must not exceed motion.cycle');
      }
    }
  }
  const audioEnvelope = [...(props.audioEnvelope ?? [])];
  if (audioEnvelope.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) throw new TypeError('RMS samples must be in [0,1]');
  const audioFps = props.audioFps ?? 30;
  if (!Number.isFinite(audioFps) || audioFps <= 0) throw new TypeError('audioFps must be positive');
  const width = props.width ?? 480;
  if (!Number.isFinite(width) || width <= 0) throw new TypeError('width must be positive');
  const position = props.position ?? 'bottom-right';
  if (typeof position === 'object' && position !== null) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new TypeError('Invalid position');
  } else if (!['bottom-left', 'bottom-right'].includes(position)) throw new TypeError('Invalid position');
  const accentKeyframes = (props.accentKeyframes ?? []).map((frame) => {
    if (!Number.isFinite(frame.time) || frame.time < 0) throw new TypeError('Invalid accent time');
    return { time: frame.time };
  }).sort((a, b) => a.time - b.time);
  const enableBounce = Boolean(props.enableBounce ?? false);
  return { pack, audioEnvelope, audioFps, width, position, accentKeyframes, enableBounce, label: props.label ?? pack.id };
}

export function resolvePortraitState(config, currentTime) {
  if (!Number.isFinite(currentTime) || currentTime < 0) throw new TypeError('currentTime must be non-negative');
  const { amplitude, mouth } = resolveAudioState(config.audioEnvelope, config.audioFps, currentTime);
  let accent = -1;
  for (let i = 0; i < config.accentKeyframes.length && config.accentKeyframes[i].time <= currentTime; i++) accent = i;
  const elapsed = accent < 0 ? Infinity : currentTime - config.accentKeyframes[accent].time;
  const pulse = (config.enableBounce && elapsed < 0.22) ? Math.sin(elapsed / 0.22 * Math.PI) : 0;
  const breath = 0.004 * Math.sin(currentTime * Math.PI * 2 / 3.4);
  const beat = bodyBeat(currentTime, config.audioEnvelope, config.audioFps);
  const rotation = beat.lean + (accent % 2 ? -1 : 1) * pulse;
  const translateY = pulse ? -7 * pulse : 0;
  const scaleY = 1 + breath + 0.018 * pulse;
  const blink = blinkAmount(currentTime);
  const layerAngles = {};
  for (const layer of config.pack.layers ?? []) if (layer.motion) layerAngles[layer.id] = swayAngle(currentTime, layer.motion);

  return {
    pose: 'idle', previousPose: 'idle', poseMix: 1, eyes: blink > 0.5 ? 'blink' : 'open', blink, amplitude, mouth,
    rotation, translateX: beat.shift, translateY, scaleY, layerAngles,
  };
}

/** Mouth-erased RGBA base + independently drawn SVG mouth + optional articulated layers. All state derives from time. */
export function createTalkingPortrait(props, document = globalThis.document) {
  const config = prepareTalkingPortrait(props);
  const { pack, width, position } = config;
  const element = document.createElement('div');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', config.label);
  Object.assign(element.style, { position: 'absolute', width: `${width}px`, height: `${width * pack.size[1] / pack.size[0]}px`,
    pointerEvents: 'none', transformOrigin: '50% 90%' });
  if (typeof position === 'object') Object.assign(element.style, { left: `${position.x}px`, top: `${position.y}px` });
  else Object.assign(element.style, { bottom: '32px', [position === 'bottom-left' ? 'left' : 'right']: '32px' });
  const node = (name, attrs = {}) => {
    const value = document.createElementNS(SVG, name);
    for (const [key, attr] of Object.entries(attrs)) value.setAttribute(key, String(attr));
    return value;
  };
  const svg = node('svg', { viewBox: `0 0 ${pack.size[0]} ${pack.size[1]}`, width: '100%', height: '100%', overflow: 'visible' });

  // Behind layers (e.g. tail)
  const layers = pack.layers ?? [];
  const layerElements = new Map();
  for (const layer of layers.filter((l) => l.placement !== 'front')) {
    const g = node('g', { 'data-layer': layer.id });
    if (layer.origin) {
      g.style.transformOrigin = `${layer.origin[0]}px ${layer.origin[1]}px`;
    }
    const img = node('image', { href: layer.src, x: layer.x ?? 0, y: layer.y ?? 0, width: layer.width ?? pack.size[0], height: layer.height ?? pack.size[1] });
    g.append(img);
    svg.append(g);
    layerElements.set(layer.id, { g, config: layer });
  }

  // Base image
  const base = node('image', { href: pack.base, x: 0, y: 0, width: pack.size[0], height: pack.size[1] });
  svg.append(base);

  // Eyelids: skin/fur-coloured shape lowered from the top of each eye box, so the base keeps its open eyes.
  const lids = (pack.eyes?.boxes ?? []).map((box) => {
    const x = box.x * pack.size[0], y = box.y * pack.size[1], w = box.width * pack.size[0], h = box.height * pack.size[1];
    const g = node('g', { 'data-eyelid': '', opacity: 0 });
    g.append(node('ellipse', { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, fill: pack.eyes.color }),
      node('path', { d: `M${x + w * 0.08} ${y + h * 0.62} Q${x + w / 2} ${y + h * 0.88} ${x + w * 0.92} ${y + h * 0.62}`,
        fill: 'none', stroke: pack.eyes.line, 'stroke-width': Math.max(2, w * 0.045), 'stroke-linecap': 'round' }));
    svg.append(g);
    return { g, top: y };
  });

  // Dynamic SVG mouth
  const slot = node('svg', { x: pack.mouth.x * pack.size[0], y: pack.mouth.y * pack.size[1],
    width: pack.mouth.width * pack.size[0], height: pack.mouth.height * pack.size[1], viewBox: '0 0 100 100', overflow: 'visible' });
  const path = (d, fill = 'none', stroke = 'none', strokeWidth = 0) => node('path', { d, fill, stroke,
    'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const closed = node('g', { 'data-lip-state': 'closed' });
  closed.append(path(pack.mouth.style === 'cat' ? 'M50 15 L50 38 M19 40 Q28 61 50 38 Q72 61 81 40' : 'M12 36 Q50 61 88 36', 'none', pack.mouth.ink, 3.6));
  const half = node('g', { 'data-lip-state': 'half' });
  half.append(path('M18 30 Q50 44 82 30 Q80 72 50 74 Q20 72 18 30Z', pack.mouth.ink, pack.mouth.ink, 2.6),
    path('M23 34 Q50 44 77 34 L74 44 Q50 52 26 44Z', pack.mouth.teeth),
    path('M32 65 Q50 55 68 65 Q50 78 32 65Z', pack.mouth.tongue));
  const open = node('g', { 'data-lip-state': 'open' });
  open.append(path('M20 24 Q50 14 80 24 Q89 87 50 87 Q11 87 20 24Z', pack.mouth.ink, pack.mouth.ink, 2.6),
    path('M24 26 Q50 19 76 26 L75 39 Q50 43 25 39Z', pack.mouth.teeth),
    path('M28 73 Q50 54 72 73 Q67 88 50 88 Q33 88 28 73Z', pack.mouth.tongue));
  slot.append(closed, half, open);
  svg.append(slot);

  // Front layers
  for (const layer of layers.filter((l) => l.placement === 'front')) {
    const g = node('g', { 'data-layer': layer.id });
    if (layer.origin) {
      g.style.transformOrigin = `${layer.origin[0]}px ${layer.origin[1]}px`;
    }
    const img = node('image', { href: layer.src, x: layer.x ?? 0, y: layer.y ?? 0, width: layer.width ?? pack.size[0], height: layer.height ?? pack.size[1] });
    g.append(img);
    svg.append(g);
    layerElements.set(layer.id, { g, config: layer });
  }

  element.append(svg);

  const imagesToLoad = [pack.base, ...layers.map((l) => l.src)];
  const ready = Promise.all(imagesToLoad.map((src) => {
    const image = document.createElement('img');
    image.src = src;
    return image.decode ? image.decode().then(() => image) : Promise.resolve(image);
  }));

  const states = { closed, half, open };
  function renderAt(time) {
    const state = resolvePortraitState(config, time);
    for (const [key, group] of Object.entries(states)) group.setAttribute('opacity', key === state.mouth ? '1' : '0');
    element.setAttribute('data-mouth', state.mouth);
    element.setAttribute('data-audio-amplitude', String(state.amplitude));
    element.style.transform = `translate(${state.translateX * width}px, ${state.translateY}px) rotate(${state.rotation}deg) scaleY(${state.scaleY})`;
    for (const { g, top } of lids) {
      g.setAttribute('opacity', state.blink > 0 ? '1' : '0');
      g.setAttribute('transform', `translate(0 ${top}) scale(1 ${state.blink}) translate(0 ${-top})`);
    }
    for (const [id, { g }] of layerElements) {
      if (id in state.layerAngles) g.style.transform = `rotate(${state.layerAngles[id]}deg)`;
    }
    return state;
  }
  renderAt(0);
  return { element, ready, renderAt, whenFrameReady: () => ready.then(() => []) };
}
