// Pure, time-only secondary motion for talking portraits. No timers, no Math.random: any seek gives the same frame.
import { resolveAudioState } from './state.js';

const hash = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

/** 0 = eyes open, 1 = fully closed. One blink per 3.2 s slot at a hashed offset; every 4th slot is a double blink. */
export function blinkAmount(time) {
  const slot = Math.floor(time / 3.2);
  const local = time - slot * 3.2;
  const start = 0.3 + hash(slot) * 2.2;
  const pulse = (from) => {
    const p = (local - from) / 0.15;
    return p >= 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
  };
  return Math.max(pulse(start), slot % 4 === 3 ? pulse(start + 0.28) : 0);
}

/**
 * Oscillating layer (tail, ear, hair lock): `cycle` seconds long, swaying for `active` of them, resting for the rest.
 * Phase follows absolute time and the envelope eases in/out, so the layer never jumps at a cycle boundary.
 */
export function swayAngle(time, { amplitude, period, cycle = 5.4, active = 3.6, rest = 0.2 }) {
  const c = time % cycle;
  const env = rest + (1 - rest) * smooth(c / 0.5) * (1 - smooth((c - active) / 0.5));
  const phase = time * Math.PI * 2 / period;
  return amplitude * env * (Math.sin(phase) + 0.27 * Math.sin(phase * 2));
}

/**
 * Occasional body-language beats (weight shift + lean), one per ~6.5 s slot. A beat that would start during speech is
 * pushed to the next pause (up to 2 s). `shift` is a fraction of portrait width, `lean` is degrees.
 */
export function bodyBeat(time, audioEnvelope, audioFps) {
  const SLOT = 6.5, LENGTH = 1.8;
  let shift = 0, lean = 0;
  for (let slot = Math.max(0, Math.floor((time - LENGTH - 2) / SLOT)); slot <= Math.floor(time / SLOT); slot++) {
    let start = slot * SLOT + 1 + hash(slot + 100) * 3;
    for (let i = 0; i < 20 && resolveAudioState(audioEnvelope, audioFps, start).amplitude >= 0.05; i++) start += 0.1;
    const p = (time - start) / LENGTH;
    if (p < 0 || p >= 1) continue;
    const bump = Math.sin(p * Math.PI) ** 2;
    const side = hash(slot + 200) < 0.5 ? -1 : 1;
    shift += side * 0.006 * bump;
    lean += side * 0.9 * bump;
  }
  return { shift, lean };
}
