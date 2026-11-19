// YIN difference function and cumulative mean normalization.
const windowSize = 768;
const minHz = 15;
const maxHz = 8200;
function squaredDifference(samples, stride, lag) {
  let distance = 0;
  const offset = lag * stride;
  for (let i = 0; i < windowSize * stride; i += stride) {
    const delta = samples[i] - samples[i + offset];
    distance += delta * delta;
  }
  return distance;
}
function refineMinimum(lag, left, center, right) {
  const curvature = left - 2 * center + right;
  return lag + (curvature ? (left - right) / (2 * curvature) : 0);
}
function refineShortPeriod(samples, stride, period) {
  // Measuring several cycles at once reduces the effect of rounding short lags.
  const cycles = 16;
  const first = Math.round(period * cycles) - 3;
  const values = Array.from({ length: 7 }, (_, index) => squaredDifference(samples, stride, first + index));
  const index = values.indexOf(Math.min(...values));
  if (index === 0 || index === values.length - 1) return period;
  return refineMinimum(first + index, values[index - 1], values[index], values[index + 1]) / cycles;
}
export class PitchDetector {
  constructor() {
    this.curve = new Float32Array(3600);
  }
  detect(samples, sampleRate) {
    const decimation = Math.max(1, Math.round(sampleRate / 48000));
    const rate = sampleRate / decimation;
    const first = Math.max(2, Math.floor(rate / maxHz));
    const last = Math.min(Math.ceil(rate / minHz), Math.floor(samples.length / decimation) - windowSize - 1, this.curve.length - 1);
    let energy = 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i += decimation) {
      sum += samples[i];
      energy += samples[i] ** 2;
    }
    const length = Math.ceil(samples.length / decimation);
    const rms = Math.sqrt(Math.max(0, energy / length - (sum / length) ** 2));
    if (rms < 0.0018 || last <= first) return { hz: null, rms };

    const curve = this.curve;
    curve[0] = 1;
    let total = 0;
    let lag = 0;
    for (let step = 1; step <= last; step++) {
      const distance = squaredDifference(samples, decimation, step);
      total += distance;
      curve[step] = total ? distance * step / total : 1;
      if (step > first && curve[step - 1] < 0.17 && curve[step] >= curve[step - 1]) {
        lag = step - 1;
        break;
      }
    }
    if (!lag) return { hz: null, rms };
    let refined = refineMinimum(lag, curve[lag - 1], curve[lag], curve[lag + 1]);
    if (refined < 32 && refined * 16 + 4 < last) refined = refineShortPeriod(samples, decimation, refined);
    const hz = rate / refined;
    return { hz: hz >= minHz && hz <= maxHz ? hz : null, rms };
  }
}

const holdDurationMs = 1600;
const signalGapMs = 120;

export class PitchTracker {
  samples = [];
  value = null;
  lastConfirmedAt = -Infinity;
  lastSampleAt = -Infinity;

  update(hz, time) {
    const age = time - this.lastConfirmedAt;
    if (age >= holdDurationMs) this.value = null;
    if (hz) {
      const previous = this.samples.at(-1);
      const jump = previous && Math.abs(Math.log2(hz / previous)) > 0.075;
      if (time - this.lastSampleAt >= signalGapMs || jump) this.samples = [];
      this.samples.push(hz);
      this.lastSampleAt = time;
      if (this.samples.length > 5) this.samples.shift();
      if (this.samples.length >= 2) {
        const sorted = [...this.samples].sort((a, b) => a - b);
        this.value = sorted[Math.floor(sorted.length / 2)];
        this.lastConfirmedAt = time;
      }
    }
    return { hz: this.value, held: this.value !== null && time - this.lastConfirmedAt >= signalGapMs };
  }

  reset() {
    this.samples = [];
    this.value = null;
    this.lastConfirmedAt = -Infinity;
    this.lastSampleAt = -Infinity;
  }
}
