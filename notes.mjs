export const sharps = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const flats = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭'];
export const minMidi = 12;
export const maxMidi = 119;
export const frequencyOf = midi => 440 * 2 ** ((midi - 69) / 12);
export const midiOf = hz => 69 + 12 * Math.log2(hz / 440);
export const centsFrom = (hz, midi) => 100 * (midiOf(hz) - midi);
export function noteOf(midi, preferFlats = false) {
  return { name: (preferFlats ? flats : sharps)[midi % 12], octave: Math.floor(midi / 12) - 1 };
}
export function labelOf(midi, preferFlats = false) {
  const { name, octave } = noteOf(midi, preferFlats);
  return name + octave;
}
export function readNote(label) {
  const [, name, accidental, octave] = /^([A-G])([#b♯♭]?)(\d+)$/.exec(label);
  const offset = accidental === '#' || accidental === '♯' ? 1 : accidental ? -1 : 0;
  return (Number(octave) + 1) * 12 + sharps.indexOf(name) + offset;
}
export function chromaticReading(hz, previousMidi = null) {
  const pitch = midiOf(hz);
  const midi = previousMidi !== null && Math.abs(pitch - previousMidi) <= .55 ? previousMidi : Math.round(pitch);
  return { midi, target: midi, cents: 100 * (pitch - midi), index: null };
}
export function instrumentReading(hz, tuning, manual, previousMidi = null) {
  const chromatic = chromaticReading(hz, previousMidi);
  const distances = tuning.notes.map((midi, index) => ({ index, distance: Math.abs(centsFrom(hz, midi)) }))
    .sort((a, b) => a.distance - b.distance);
  const [nearest, second] = distances;
  const index = manual ?? (nearest.distance <= 150 && second.distance - nearest.distance >= 35 ? nearest.index : null);
  if (index === null) return chromatic;
  const target = tuning.notes[index];
  return { ...chromatic, target, index, cents: centsFrom(hz, target) };
}
export function tuningState(cents) {
  if (cents == null) return 'idle';
  if (Math.abs(cents) <= 3) return 'tuned';
  return cents < 0 ? 'low' : 'high';
}
