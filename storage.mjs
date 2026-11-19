import { instruments } from './presets.mjs';
import { minMidi, maxMidi } from './notes.mjs';

const key = 'fret.tunings.v1';
export function readLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    const custom = Array.isArray(saved?.custom) ? saved.custom.filter(tuning =>
      tuning && Object.hasOwn(instruments, tuning.instrument) &&
      typeof tuning.id === 'string' && typeof tuning.name === 'string' &&
      Array.isArray(tuning.notes) && tuning.notes.length === instruments[tuning.instrument].count &&
      tuning.notes.every(midi => Number.isInteger(midi) && midi >= minMidi && midi <= maxMidi)) : [];
    const favorites = Array.isArray(saved?.favorites) ? saved.favorites.filter(id => typeof id === 'string') : [];
    return { custom, favorites };
  } catch {
    return { custom: [], favorites: [] };
  }
}
export function saveLibrary(library) {
  try {
    localStorage.setItem(key, JSON.stringify(library));
    return true;
  } catch {
    return false;
  }
}
