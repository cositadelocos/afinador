import { frequencyOf, labelOf, noteOf, tuningState } from './notes.mjs';

const get = id => document.getElementById(id);
const elements = Object.fromEntries(['detected','note','octave','frequency','cents','target','target-label','needle','advice','wave'].map(id => [id,get(id)]));
const tuner = elements.detected.closest('.tuner');
const formatter = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false });
const hzText = hz => formatter.format(hz);
const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };

export function renderReading(hz, reading, tuning, manual, listening) {
  const current = reading && noteOf(reading.midi, tuning?.flats);
  const target = reading?.target ?? (manual === null ? null : tuning?.notes[manual]);
  const state = tuningState(reading?.cents);
  const precise = reading ? Math.round(reading.cents) : null;
  const index = reading?.index ?? manual;
  setText(elements.note, current?.name ?? '—');
  setText(elements.octave, String(current?.octave ?? ''));
  elements.detected.setAttribute('aria-label', current ? current.name + current.octave : 'Sin nota detectada');
  setText(elements.frequency, hz ? hzText(hz) : '—');
  setText(elements.cents, precise === null ? '—' : (precise > 0 ? '+' : precise < 0 ? '−' : '') + Math.abs(precise) + ' cents');
  setText(elements['target-label'], index == null ? 'Frecuencia objetivo' : 'Objetivo · ' + (tuning.notes.length - index) + 'ª cuerda');
  setText(elements.target, target == null ? '—' : labelOf(target, tuning?.flats) + ' · ' + hzText(frequencyOf(target)) + ' Hz');
  const cents = state === 'tuned' ? 0 : reading?.cents ?? 0;
  elements.needle.style.left = (50 + Math.max(-50, Math.min(50, cents))) + '%';
  tuner.dataset.state = state;
  const advice = {
    idle: listening ? 'Esperando señal' : 'Activa el micrófono',
    tuned: '✓ Afinado',
    low: index == null ? '↓ Grave' : '↑ Sube la tensión',
    high: index == null ? '↑ Agudo' : '↓ Baja la tensión',
  };
  setText(elements.advice, advice[state]);
}
export function renderWave(samples, rms = 0) {
  const canvas = elements.wave;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0,0,width,height);
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = samples ? '#bcf5ce' : '#62736a';
  for (let x = 0; x < width; x++) {
    const index = samples ? samples.length - 1024 + Math.round(x * 1023 / width) : 0;
    const value = samples?.[index] ?? 0;
    const normalized = rms > .0018 ? Math.max(-1, Math.min(1, value / Math.max(.035,rms * 3))) : 0;
    const y = height * (.5 - .43 * normalized);
    if (x === 0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  }
  ctx.stroke();
}
