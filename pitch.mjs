// A gain-normalized YIN difference keeps decaying notes comparable across lags.
const referenceSamples = 1280;
const minReferenceSamples = 768;
const minHz = 15;
const maxHz = 8200;
const minRms = .00065;
const maxPeriodError = .24;
const strideFor = sampleRate => Math.max(1, Math.round(sampleRate / 48000));
export const analysisTailSeconds = sampleRate => 1 / minHz + (referenceSamples + 1) * strideFor(sampleRate) / sampleRate;

function refineMinimum(lag, left, center, right) {
  const curvature = left - 2 * center + right;
  return lag + (curvature > 0 ? Math.max(-.5, Math.min(.5, (left - right) / (2 * curvature))) : 0);
}

function periodError(dot, sum, power, reference) {
  const norm = power - sum * sum / reference.width;
  if (norm <= 0) return 1;
  const covariance = dot - sum * reference.sum / reference.width;
  return Math.max(0, 1 - covariance / Math.sqrt(norm * reference.norm));
}

function nearMinimum(frame, reference, center, radius, last) {
  const first = Math.max(2, Math.round(center) - radius);
  const stop = Math.min(last, Math.round(center) + radius);
  let best = { lag: center, error: Infinity };
  let before = Infinity;
  let current = Infinity;
  for (let lag = first; lag <= stop; lag++) {
    let sum = 0;
    let power = 0;
    let dot = 0;
    for (let i = 0; i < reference.width; i++) {
      const sample = frame[i + lag];
      sum += sample;
      power += sample * sample;
      dot += frame[i] * sample;
    }
    const next = periodError(dot, sum, power, reference);
    if (Number.isFinite(before) && current < best.error && current <= before && current <= next) {
      best = { lag: refineMinimum(lag - 1, before, current, next), error: current };
    }
    before = current;
    current = next;
  }
  return best;
}

export class PitchDetector {
  frame = new Float32Array(8192);

  detect(samples, sampleRate) {
    const stride = strideFor(sampleRate);
    const rate = sampleRate / stride;
    const length = Math.floor(samples.length / stride);
    const first = Math.max(2, Math.floor(rate / maxHz));
    const last = Math.min(Math.ceil(rate / minHz), length - minReferenceSamples - 1);
    if (last <= first + 1) return { hz: null, rms: 0 };

    const width = Math.min(referenceSamples, length - last);
    const frame = this.frame;
    // The reference starts at the end of the captured buffer, closest to the current sound.
    const frameLength = width + last;
    for (let i = 0; i < frameLength; i++) {
      const end = samples.length - i * stride;
      let value = 0;
      for (let j = 1; j <= stride; j++) value += samples[end - j];
      frame[i] = value / stride;
    }

    // Apply a low-pass filter from oldest to newest so the newest samples are
    // compared with history under the same filter, without a window-edge step.
    const weight = 1 - Math.exp(-2 * Math.PI * 3100 / rate);
    let firstPass = frame[frameLength - 1];
    let secondPass = firstPass;
    let thirdPass = firstPass;
    let sum = 0;
    let power = 0;
    for (let i = frameLength - 1; i >= 0; i--) {
      firstPass += weight * (frame[i] - firstPass);
      secondPass += weight * (firstPass - secondPass);
      thirdPass += weight * (secondPass - thirdPass);
      frame[i] = thirdPass;
      if (i < width) {
        sum += thirdPass;
        power += thirdPass * thirdPass;
      }
    }
    const norm = Math.max(0, power - sum * sum / width);
    const rms = Math.sqrt(norm / width);
    if (rms < minRms) return { hz: null, rms };

    const reference = { sum, norm, width };
    let shiftedSum = sum;
    let shiftedPower = power;
    let before = Infinity;
    let current = Infinity;
    let yinScore = 1;
    let total = 0;
    let lag = 0;
    let error = Infinity;
    for (let step = 1; step <= last; step++) {
      const remove = frame[step - 1];
      const add = frame[step + width - 1];
      shiftedSum += add - remove;
      shiftedPower += add * add - remove * remove;
      let dot = 0;
      for (let i = 0; i < width; i++) dot += frame[i] * frame[i + step];
      const next = periodError(dot, shiftedSum, shiftedPower, reference);
      if (step > first && current < maxPeriodError && yinScore < .27 && current <= before && current < next) {
        lag = refineMinimum(step - 1, before, current, next);
        error = current;
        break;
      }
      total += next;
      yinScore = total ? next * step / total : 1;
      before = current;
      current = next;
    }
    if (!lag) return { hz: null, rms };

    // A strong overtone may fit half or a third of the true period. Only use a
    // longer period if it matches materially better than the first candidate.
    if (error > .035) {
      const original = lag;
      for (const multiple of [2, 3]) {
        const center = original * multiple;
        const radius = Math.max(3, Math.ceil(center * .015));
        if (center + radius >= last) break;
        const match = nearMinimum(frame, reference, center, radius, last);
        if (match.error < error - .03 && match.error < error * .73) {
          lag = match.lag;
          error = match.error;
        }
      }
    }

    // Measuring several cycles improves interpolation when a period has few samples.
    if (lag < 32 && lag * 16 + 4 < last) {
      const match = nearMinimum(frame, reference, lag * 16, 4, last);
      if (match.error < .2) lag = match.lag / 16;
    }
    const hz = rate / lag;
    return { hz: hz >= minHz && hz <= maxHz ? hz : null, rms };
  }
}

const holdDurationMs = 1600;
const signalGapMs = 120;
const centsBetween = (a, b) => Math.abs(1200 * Math.log2(a / b));

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
      if (time - this.lastSampleAt >= signalGapMs || (previous && centsBetween(hz, previous) > 42)) {
        this.samples = [];
      }
      this.samples.push(hz);
      this.lastSampleAt = time;
      if (this.samples.length > 3) this.samples.shift();
      if (this.samples.length >= 2) {
        const sorted = [...this.samples].sort((a, b) => a - b);
        const median = sorted.length === 2 ? Math.sqrt(sorted[0] * sorted[1]) : sorted[1];
        const change = this.value === null ? Infinity : centsBetween(median, this.value);
        if (change > 42 || age >= signalGapMs) {
          this.value = median;
        } else {
          const smoothingMs = change > 4 ? 36 : 78;
          const weight = 1 - Math.exp(-age / smoothingMs);
          this.value *= (median / this.value) ** weight;
        }
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
