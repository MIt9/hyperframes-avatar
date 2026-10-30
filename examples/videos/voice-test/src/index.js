export { prepareAvatar, resolveAvatarState, tagGestures } from './state.js';
import { prepareAvatar, resolveAvatarState } from './state.js';

let nextId = 0;
const SVG = 'http://www.w3.org/2000/svg';

/** Framework-free DOM component; the caller owns the clock and mounting. */
export function createSpriteAvatar(props, document = globalThis.document) {
  const config = prepareAvatar(props);
  const { pack, scale, position, stickerStyle: style } = config;
  const element = document.createElement('div');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', props.label ?? pack.id);
  Object.assign(element.style, { position: 'absolute', width: `${pack.gridSize[0] * scale}px`,
    height: `${pack.gridSize[1] * scale}px`, pointerEvents: 'none', overflow: 'visible' });
  if (typeof position === 'object') Object.assign(element.style, { left: `${position.x}px`, top: `${position.y}px` });
  else Object.assign(element.style, { bottom: '32px', [position === 'bottom-left' ? 'left' : 'right']: '32px' });
  const svgNode = (name, attributes = {}) => {
    const node = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  };
  const id = `sprite-avatar-filter-${++nextId}`;
  const svg = svgNode('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
  svg.style.position = 'absolute';
  const defs = svgNode('defs');
  const padding = style.outlineWidth + style.shadowBlur * 2 + 8;
  const width = pack.gridSize[0] * scale;
  const height = pack.gridSize[1] * scale;
  const filter = svgNode('filter', { id, filterUnits: 'userSpaceOnUse', x: -padding, y: -padding,
    width: width + padding * 2, height: height + padding * 2, 'color-interpolation-filters': 'sRGB' });
  filter.append(svgNode('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: style.outlineWidth, result: 'dilated' }),
    svgNode('feFlood', { 'flood-color': style.outlineColor, result: 'color' }),
    svgNode('feComposite', { in: 'color', in2: 'dilated', operator: 'in', result: 'outline' }),
    svgNode('feDropShadow', { in: 'outline', dx: 0, dy: 8, stdDeviation: style.shadowBlur / 2,
      'flood-opacity': style.shadowOpacity, 'flood-color': '#000000', result: 'shadow' }));
  const merge = svgNode('feMerge');
  merge.append(svgNode('feMergeNode', { in: 'shadow' }), svgNode('feMergeNode', { in: 'SourceGraphic' }));
  filter.append(merge);
  defs.append(filter);
  svg.append(defs);
  const body = document.createElement('div');
  Object.assign(body.style, { position: 'absolute', inset: '0', transformOrigin: '50% 100%', filter: `url(#${id})` });
  const images = {};
  for (const name of ['base', 'eyes', 'mouth', 'pose']) {
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    Object.assign(img.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', imageRendering: 'pixelated' });
    images[name] = img;
    body.append(img);
  }
  element.append(svg, body);
  // Preload/decode every variant; hf-seek can wait for readiness before capture.
  const paths = new Set([pack.layers.base, ...Object.values(pack.layers.eyes),
    ...Object.values(pack.layers.mouth), ...Object.values(pack.layers.poses)]);
  const ready = Promise.all([...paths].map(async (src) => {
    const image = document.createElement('img');
    image.src = src;
    await image.decode();
    if (image.naturalWidth !== pack.gridSize[0] || image.naturalHeight !== pack.gridSize[1]) {
      throw new Error(`Asset must match gridSize: ${src}`);
    }
    return image;
  }));
  function renderAt(time) {
    const state = resolveAvatarState(config, time);
    const sources = { base: pack.layers.base, eyes: pack.layers.eyes[state.eyes],
      mouth: pack.layers.mouth[state.mouth], pose: pack.layers.poses[state.pose] };
    for (const [name, src] of Object.entries(sources)) {
      if (images[name].getAttribute('src') !== src) images[name].src = src;
    }
    body.style.transform = `translateY(${state.translateY}px) scaleY(${state.scaleY})`;
    return state;
  }
  renderAt(0);
  const whenFrameReady = () => Promise.all(Object.values(images).map((image) => image.decode()));
  return { element, ready, renderAt, whenFrameReady };
}

/** Attach explicitly; offset converts composition time into avatar-local seconds. */
export function bindHyperframes(avatar, { target = globalThis.window, offset = 0 } = {}) {
  if (!Number.isFinite(offset) || offset < 0) throw new TypeError('offset must be finite and nonnegative');
  const seek = (event) => {
    const time = event.detail.time - offset;
    avatar.element.hidden = time < 0;
    avatar.renderAt(Math.max(0, time));
    event.detail.waitUntil?.(avatar.whenFrameReady ? Promise.all([avatar.ready, avatar.whenFrameReady()]) : avatar.ready);
  };
  target.addEventListener('hf-seek', seek);
  return () => target.removeEventListener('hf-seek', seek);
}
