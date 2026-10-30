/** Incremental mono float32 RMS, with exact sample windows even for fractional fps. */
export function createRmsAccumulator(sampleRate = 24000, fps = 30) {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || !Number.isFinite(fps) || fps <= 0 || fps > sampleRate) {
    throw new TypeError('Require integer sampleRate > 0 and 0 < fps <= sampleRate');
  }
  const envelope = [];
  let sampleCount = 0;
  let windowCount = 0;
  let sum = 0;
  let finished = false;
  return {
    push(sample) {
      if (finished) throw new Error('Accumulator is finished');
      if (!Number.isFinite(sample)) throw new TypeError('Audio samples must be finite');
      sum += sample * sample;
      sampleCount++;
      windowCount++;
      if (sampleCount >= Math.ceil((envelope.length + 1) * sampleRate / fps)) {
        envelope.push(Math.min(1, Math.sqrt(sum / windowCount)));
        sum = 0;
        windowCount = 0;
      }
    },
    finish() {
      if (!finished && windowCount) envelope.push(Math.min(1, Math.sqrt(sum / windowCount)));
      finished = true;
      return { audioFps: fps, audioEnvelope: [...envelope] };
    },
  };
}
