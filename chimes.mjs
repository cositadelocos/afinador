import { tuningState } from './notes.mjs';

// Each voice specifies its oscillator, frequency, delay and duration in seconds.
const voices = {
  chromatic: [['sine', 880, 0, .14]],
  guitar: [['triangle', 392, 0, .14], ['sine', 587.33, .065, .13]],
  uke: [['sine', 659.25, 0, .095], ['triangle', 880, .055, .1], ['sine', 1046.5, .11, .11]],
  bass: [['triangle', 146.83, 0, .18], ['sine', 220, .08, .15]],
};

export function playChime(context, mode) {
  const now = context.currentTime;
  let end = now;
  for (const [type, hz, delay, duration] of voices[mode]) {
    const start = now + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = hz;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(.07, start + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, start + duration - .014);
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(envelope).connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration);
    end = Math.max(end, start + duration);
  }
  return end;
}

const settleMs = 120;
const rearmMs = 240;

export class TunedChime {
  candidate = null;
  candidateAt = 0;
  played = null;
  unsteadyAt = null;

  update(mode, reading, held, time) {
    const hasTarget = reading && (mode === 'chromatic' || reading.index !== null);
    if (!hasTarget || held || tuningState(reading.cents) !== 'tuned') {
      this.candidate = null;
      if (!hasTarget || held || Math.abs(reading.cents) > 6) {
        this.unsteadyAt ??= time;
        if (time - this.unsteadyAt >= rearmMs) this.played = null;
      } else {
        this.unsteadyAt = null;
      }
      return false;
    }

    this.unsteadyAt = null;
    const key = mode + '/' + reading.target + '/' + reading.index;
    if (this.candidate !== key) {
      this.candidate = key;
      this.candidateAt = time;
    }
    if (this.played === key || time - this.candidateAt < settleMs) return false;
    this.played = key;
    return true;
  }

  reset() {
    this.candidate = null;
    this.played = null;
    this.unsteadyAt = null;
  }
}
