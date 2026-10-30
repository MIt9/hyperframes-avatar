const finite = (value, name, minimum = 0) => {
  if (!Number.isFinite(value) || value < minimum) throw new TypeError(`${name} must be finite and >= ${minimum}`);
  return value;
};

/** Validate once at setup, never mutate caller-owned configuration. */
export function prepareAvatar(props) {
  const { pack } = props;
  if (!pack || typeof pack.id !== 'string' || !pack.id) throw new TypeError('pack.id is required');
  if (!Array.isArray(pack.gridSize) || pack.gridSize.length !== 2) throw new TypeError('pack.gridSize must contain width and height');
  pack.gridSize.forEach((n) => finite(n, 'gridSize', 1));
  const layers = pack.layers;
  const paths = [layers?.base, layers?.eyes?.open, layers?.eyes?.blink,
    layers?.mouth?.closed, layers?.mouth?.half, layers?.mouth?.open, layers?.poses?.idle];
  if (paths.some((path) => typeof path !== 'string' || !path)) throw new TypeError('base, eyes, mouth and idle pose asset paths are required');
  for (const path of [...Object.values(layers.eyes), ...Object.values(layers.mouth), ...Object.values(layers.poses)]) {
    if (typeof path !== 'string' || !path) throw new TypeError('Asset paths must be nonempty strings');
  }
  const audioFps = finite(props.audioFps ?? 30, 'audioFps', Number.EPSILON);
  const scale = finite(props.scale ?? 4, 'scale', Number.EPSILON);
  const audioEnvelope = [...(props.audioEnvelope ?? [])];
  audioEnvelope.forEach((n) => {
    finite(n, 'audioEnvelope sample');
    if (n > 1) throw new TypeError('audioEnvelope samples must be in [0, 1]');
  });
  const poseKeyframes = (props.poseKeyframes ?? []).map((frame) => {
    finite(frame.time, 'keyframe time');
    if (!Object.hasOwn(layers.poses, frame.pose)) throw new TypeError(`Unknown pose: ${frame.pose}`);
    if (frame.emotion !== undefined && !['open', 'surprised'].includes(frame.emotion)) throw new TypeError('Unknown emotion');
    return { ...frame };
  }).sort((a, b) => a.time - b.time);
  const position = props.position ?? 'bottom-right';
  if (typeof position === 'object' && position !== null) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new TypeError('Position coordinates must be finite');
  } else if (!['bottom-left', 'bottom-right'].includes(position)) throw new TypeError('Unknown position');
  const stickerStyle = { outlineWidth: 8, outlineColor: '#F8F6F0', shadowBlur: 20, shadowOpacity: 0.35, ...props.stickerStyle };
  finite(stickerStyle.outlineWidth, 'outlineWidth');
  finite(stickerStyle.shadowBlur, 'shadowBlur');
  finite(stickerStyle.shadowOpacity, 'shadowOpacity');
  if (stickerStyle.shadowOpacity > 1) throw new TypeError('shadowOpacity must be <= 1');
  if (typeof stickerStyle.outlineColor !== 'string' || !stickerStyle.outlineColor) throw new TypeError('outlineColor is required');
  return { pack: structuredClone(pack), audioFps, audioEnvelope, scale, poseKeyframes,
    position: typeof position === 'object' ? { ...position } : position, stickerStyle };
}

/** Pure resolver. Input must be prepared with prepareAvatar(). Last equal-time keyframe wins. */
export function resolveAvatarState(config, currentTime) {
  finite(currentTime, 'currentTime');
  const { pack, poseKeyframes, audioEnvelope, audioFps } = config;
  let low = 0;
  let high = poseKeyframes.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (poseKeyframes[mid].time <= currentTime) low = mid + 1;
    else high = mid;
  }
  const frame = poseKeyframes[low - 1];
  const elapsed = frame ? currentTime - frame.time : Infinity;
  const impulse = frame?.bounce && elapsed < 0.18 ? Math.sin(elapsed / 0.18 * Math.PI) : 0;
  const index = Math.floor(currentTime * audioFps);
  // Causal three-sample average, recomputed from time: no history or end-of-audio hang.
  let amplitude = 0;
  if (index < audioEnvelope.length) {
    for (let i = 0; i < 3; i++) amplitude += audioEnvelope[index - i] ?? 0;
    amplitude /= 3;
  }
  const mouth = amplitude < 0.05 ? 'closed' : amplitude < 0.25 ? 'half' : 'open';
  const cycle = Math.floor(currentTime / 3.5);
  const hash = Math.sin((cycle + 1) * 999) * 43758.5453;
  const blinkStart = 1 + (hash - Math.floor(hash)) * 2;
  const local = currentTime - cycle * 3.5;
  const blink = local >= blinkStart && local < blinkStart + 0.12;
  const eyes = blink ? 'blink' : frame?.emotion === 'surprised' && pack.layers.eyes.surprised ? 'surprised' : 'open';
  return { pose: frame?.pose ?? 'idle', mouth, eyes, amplitude,
    scaleY: 1 + 0.06 * impulse, translateY: impulse ? -12 * impulse : 0 };
}

/** Rule-based starting point for timestamped transcript segments (seconds). */
export function tagGestures(segments, availablePoses = ['idle', 'shrug', 'point_up', 'point_viewer', 'fist']) {
  const available = new Set(availablePoses);
  const frames = [];
  let previousPose = 'idle';
  const ordered = segments.map((segment) => {
    finite(segment.time, 'segment time');
    if (typeof segment.text !== 'string') throw new TypeError('Segment text must be a string');
    return { ...segment };
  }).sort((a, b) => a.time - b.time);
  for (const segment of ordered) {
    const text = segment.text.toLocaleLowerCase('uk');
    const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
    const has = (terms) => words.some((word) => terms.includes(word));
    let pose = 'idle';
    if (text.includes('?') || has(['what', 'why', 'how', 'що', 'чому', 'як'])) pose = 'shrug';
    else if (/\d/u.test(text) || has(['stop', 'first', 'wait', 'look', 'стоп', 'перше', 'зачекай', 'дивись'])) pose = 'point_up';
    else if (has(['you', 'he', 'every', 'ти', 'ви', 'кожен'])) pose = 'point_viewer';
    if (segment.finale) pose = 'fist';
    if (!available.has(pose)) pose = 'idle';
    if (available.has(pose) && pose !== previousPose) {
      frames.push({ time: segment.time, pose, bounce: true });
      previousPose = pose;
    }
  }
  return frames;
}
