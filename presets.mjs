import { readNote } from './notes.mjs';

export const instruments = {
  guitar: { name: 'Guitarra', count: 6, standard: 'standard' },
  bass: { name: 'Bajo de cuatro cuerdas', count: 4, standard: 'bass-standard', headstock: 'bass' },
  uke: { name: 'Ukulele soprano', count: 4, standard: 'soprano', headstock: 'uke' },
};
const create = (id, name, notes, group = 'Guitarra', instrument = 'guitar', flats = false) =>
  ({ id, name, notes: notes.split(' ').map(readNote), group, instrument, flats });
export const alternative = 'Alternative / Midwest Emo';
export const presets = [
  create('standard', 'Estándar', 'E2 A2 D3 G3 B3 E4'),
  create('drop-d', 'Drop D', 'D2 A2 D3 G3 B3 E4'),
  create('d-standard', 'D Standard / Full Step Down', 'D2 G2 C3 F3 A3 D4'),
  create('drop-c', 'Drop C', 'C2 G2 C3 F3 A3 D4'),
  create('open-d', 'Open D', 'D2 A2 D3 F#3 A3 D4'),
  create('open-g', 'Open G', 'D2 G2 D3 G3 B3 D4'),
  create('eb', 'Half Step Down', 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4', 'Guitarra', 'guitar', true),
  create('dadgad', 'DADGAD', 'D2 A2 D3 G3 A3 D4'),
  create('facgce', 'FACGCE', 'F2 A2 C3 G3 C4 E4', alternative),
  create('facgae', 'FACGAE', 'F2 A2 C3 G3 A3 E4', alternative),
  create('dadfae', 'DADF♯AE', 'D2 A2 D3 F#3 A3 E4', alternative),
  create('facgbe', 'FACGBE', 'F2 A2 C3 G3 B3 E4', alternative),
  create('bass-standard', 'Estándar', 'E1 A1 D2 G2', 'Bajo de cuatro cuerdas', 'bass'),
  create('bass-drop-d', 'Drop D', 'D1 A1 D2 G2', 'Bajo de cuatro cuerdas', 'bass'),
  create('soprano', 'Estándar · High G', 'G4 C4 E4 A4', 'Ukulele soprano', 'uke'),
  create('low-g', 'Low G', 'G3 C4 E4 A4', 'Ukulele soprano', 'uke'),
];
