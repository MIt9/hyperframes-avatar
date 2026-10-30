import { createSpriteAvatar, createTalkingPortrait } from './index.js';

/** Resolve editor variables against a local, pre-baked catalog. No render-time fetches. */
export function avatarPropsFromVariables(variables, catalog) {
  const packId = variables.pack ?? Object.keys(catalog.packs)[0];
  const animationId = variables.animation ?? Object.keys(catalog.animations)[0];
  if (!Object.hasOwn(catalog.packs, packId)) throw new TypeError(`Unknown avatar pack: ${packId}`);
  if (!Object.hasOwn(catalog.animations, animationId)) throw new TypeError(`Unknown avatar animation: ${animationId}`);
  const animation = catalog.animations[animationId];
  const position = variables.position === 'custom'
    ? { x: variables.x ?? 0, y: variables.y ?? 0 }
    : variables.position ?? 'bottom-right';
  return {
    ...animation,
    pack: catalog.packs[packId],
    scale: variables.scale ?? 4,
    position,
    label: variables.label ?? packId,
    stickerStyle: {
      outlineWidth: variables.outlineWidth ?? 8,
      outlineColor: variables.outlineColor ?? '#F8F6F0',
      shadowBlur: variables.shadowBlur ?? 20,
      shadowOpacity: variables.shadowOpacity ?? 0.35,
    },
  };
}

/**
 * Mount inside a composition root. The framework owns slot visibility and audio.
 * Timeline time is local: moving the host on the main timeline needs no offsets.
 */
export function mountHyperframesAvatar(root, props, options = {}) {
  if (!root?.ownerDocument) throw new TypeError('A composition root element is required');
  const target = options.target ?? root.ownerDocument.defaultView;
  const gsap = options.gsap ?? target.gsap;
  if (typeof gsap?.timeline !== 'function') throw new TypeError('GSAP is required by the HyperFrames adapter');
  const compositionId = options.compositionId ?? root.getAttribute('data-composition-id');
  if (!compositionId) throw new TypeError('A compositionId is required');
  const duration = options.duration ?? Number(root.getAttribute('data-duration'));
  if (!Number.isFinite(duration) || duration <= 0) throw new TypeError('duration must be finite and positive');
  const timelines = target.__timelines ??= {};
  const buildReady = (target.__hf ??= {}).buildReady ??= {};
  const key = `sprite-avatar:${compositionId}`;
  if (Object.hasOwn(timelines, compositionId) || Object.hasOwn(buildReady, key)) {
    throw new Error(`Composition already mounted: ${compositionId}`);
  }
  const avatar = props.pack?.kind === 'talking-portrait'
    ? createTalkingPortrait(props, root.ownerDocument) : createSpriteAvatar(props, root.ownerDocument);
  const clock = { time: 0 };
  let destroyed = false;
  const timeline = gsap.timeline({ paused: true });
  const renderAt = (time) => {
    if (destroyed) throw new Error('SpriteAvatar has been destroyed');
    return avatar.renderAt(time);
  };
  timeline.to(clock, { time: duration, duration, ease: 'none', onUpdate: () => renderAt(clock.time) });
  const seek = (event) => {
    if (destroyed) return;
    // Also draw when the runtime seeks GSAP with callbacks suppressed.
    renderAt(timeline.time());
    event.detail.waitUntil?.(Promise.all([ready, avatar.whenFrameReady()]));
  };
  const ready = avatar.ready.then(async () => {
    if (!destroyed) {
      root.append(avatar.element);
      renderAt(timeline.time());
      await avatar.whenFrameReady();
      if (!destroyed) {
        timelines[compositionId] = timeline;
        target.addEventListener('hf-seek', seek);
      }
    }
    return avatar;
  });
  buildReady[key] = ready;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    target.removeEventListener('hf-seek', seek);
    timeline.kill();
    avatar.element.remove();
    if (timelines[compositionId] === timeline) delete timelines[compositionId];
    if (buildReady[key] === ready) delete buildReady[key];
  }
  // Keep the original rejecting promise observable by the caller and runtime.
  ready.catch(destroy);
  return { element: avatar.element, timeline, ready, renderAt, destroy };
}
