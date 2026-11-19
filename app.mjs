import { Microphone, microphoneMessage } from './audio.mjs?v=2';
import { TunedChime } from './chimes.mjs';
import { Headstock } from './headstock.mjs';
import { beginEdit, confirmDelete, renderLibrary } from './library.mjs';
import { chromaticReading, instrumentReading, labelOf } from './notes.mjs?v=2';
import { instruments, presets } from './presets.mjs';
import { renderReading, renderWave } from './readout.mjs';
import { searchSongs } from './songs.mjs';
import { readLibrary, saveLibrary } from './storage.mjs';

const get = id => document.getElementById(id);
const findPreset = id => presets.find(tuning => tuning.id === id);
const standard = instrument => findPreset(instruments[instrument].standard);
let library = readLibrary();
const state = {
  mode: 'guitar', layout: 'three', manual: null, hz: null, midi: null, held: false,
  selection: Object.fromEntries(Object.entries(instruments).map(([key, data]) => [key, data.standard])),
  microphone: 'off',
};
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const layoutButtons = [...document.querySelectorAll('[data-layout]')];
const libraryError = get('library-error');
const presetSelect = get('preset');
const star = get('preset-star');
const allTunings = () => [...presets, ...library.custom];
const current = () => allTunings().find(tuning => tuning.id === state.selection[state.mode]);
const activate = tuning => {
  state.mode = tuning.instrument;
  state.selection[state.mode] = tuning.id;
  state.manual = null;
  renderMode();
};
const headstock = new Headstock(get('instrument-art'),get('pegs'), index => {
  state.manual = state.manual === index ? null : index;
  updateReading();
});
const chime = new TunedChime();
const mic = new Microphone(({ hz, held }, rms, samples, time) => {
  state.hz = hz;
  state.held = held;
  renderWave(samples,rms);
  const reading = updateReading();
  if (state.microphone === 'on' && chime.update(state.mode, reading, held, time)) {
    mic.playConfirmation(state.mode);
  }
}, () => {
  setMicrophone('off');
  showMicError('Se interrumpió el acceso al micrófono. Vuelve a activarlo para continuar.');
});

function updateReading() {
  const tuning = current();
  const { hz, midi, held, manual, microphone } = state;
  const reading = hz ? tuning ? instrumentReading(hz,tuning,manual,midi) : chromaticReading(hz,midi) : null;
  state.midi = reading?.midi ?? null;
  renderReading(hz,reading,tuning,manual,microphone === 'on',held);
  if (!tuning) return reading;
  const index = reading?.index ?? manual;
  headstock.select(index);
  get('auto').setAttribute('aria-pressed', manual === null);
  const caption = index == null
    ? hz ? 'Cuerda sin identificar. Selecciónala.' : 'Toca una cuerda o selecciónala.'
    : (tuning.notes.length - index) + 'ª cuerda · ' + labelOf(tuning.notes[index],tuning.flats);
  if (get('string-caption').textContent !== caption) get('string-caption').textContent = caption;
  return reading;
}
function updateStar() {
  const favorite = library.favorites.includes(state.selection[state.mode]);
  star.textContent = favorite ? '★' : '☆';
  star.setAttribute('aria-label', favorite ? 'Quitar de favoritas' : 'Marcar como favorita');
  star.setAttribute('aria-pressed',favorite);
}
function renderMode() {
  modeButtons.forEach(button => button.setAttribute('aria-pressed', button.dataset.mode === state.mode));
  const tuning = current();
  get('instrument-panel').hidden = !tuning;
  if (tuning) {
    get('instrument-heading').textContent = instruments[state.mode].name;
    get('instrument-heading').nextElementSibling.hidden = state.mode !== 'guitar';
    layoutButtons.forEach(button => button.setAttribute('aria-pressed',button.dataset.layout === state.layout));
    const groups = new Map();
    for (const item of allTunings().filter(tuning => tuning.instrument === state.mode)) {
      const name = item.group ?? 'Personalizadas';
      if (!groups.has(name)) {
        const group = document.createElement('optgroup');
        group.label = name;
        groups.set(name, group);
      }
      groups.get(name).append(new Option(item.name,item.id));
    }
    presetSelect.replaceChildren(...groups.values());
    presetSelect.value = tuning.id;
    updateStar();
    headstock.render(instruments[state.mode].headstock ?? state.layout,tuning,state.manual);
  }
  updateReading();
}
function showMicError(message) {
  const error = get('mic-error');
  error.textContent = message;
  error.hidden = !message;
}
function setMicrophone(status) {
  state.microphone = status;
  const active = status === 'on';
  const pending = status === 'pending';
  const button = get('mic-button');
  button.classList.toggle('listening',active);
  button.disabled = pending;
  get('mic-button-label').textContent = active ? 'Detener micrófono' : pending ? 'Solicitando permiso…' : 'Activar micrófono';
  const indicator = get('mic-status');
  indicator.classList.toggle('active',active);
  indicator.lastChild.textContent = active ? ' Micrófono activo' : pending ? ' Solicitando acceso' : ' Micrófono apagado';
  if (!active) {
    state.hz = null;
    state.held = false;
    chime.reset();
    renderWave();
  }
  updateReading();
}
get('mic-button').onclick = async () => {
  showMicError('');
  if (state.microphone === 'on') {
    mic.stop();
    setMicrophone('off');
    return;
  }
  setMicrophone('pending');
  try {
    await mic.start();
    if (state.microphone === 'pending') setMicrophone(mic.session ? 'on' : 'off');
  } catch (error) {
    setMicrophone('off');
    showMicError(microphoneMessage(error));
  }
};
window.addEventListener('pagehide', () => {
  mic.stop();
  setMicrophone('off');
});
modeButtons.forEach(button => button.onclick = () => {
  if (state.mode === button.dataset.mode) return;
  state.mode = button.dataset.mode;
  state.manual = null;
  renderMode();
});
layoutButtons.forEach(button => button.onclick = () => {
  state.layout = button.dataset.layout;
  renderMode();
});
presetSelect.onchange = () => activate(allTunings().find(tuning => tuning.id === presetSelect.value));
get('auto').onclick = () => {
  state.manual = null;
  updateReading();
};

function commit(next) {
  const saved = saveLibrary(next);
  libraryError.hidden = saved;
  libraryError.textContent = saved ? '' : 'No se pudieron guardar los cambios en este dispositivo.';
  if (saved) library = next;
  return saved;
}
function toggleFavorite(id) {
  const favorites = library.favorites.includes(id) ? library.favorites.filter(value => value !== id) : [...library.favorites,id];
  if (commit({ ...library,favorites })) {
    if (current()) updateStar();
    updateLibrary();
  }
}
function edit(tuning, mode) {
  beginEdit(tuning,mode,standard,saved => {
    const custom = mode === 'edit' ? library.custom.map(item => item.id === saved.id ? saved : item) : [...library.custom,saved];
    if (!commit({ ...library,custom })) return false;
    activate(saved);
    updateLibrary();
    return true;
  });
}
function remove(tuning) {
  confirmDelete(tuning,() => {
    const custom = library.custom.filter(item => item.id !== tuning.id);
    const favorites = library.favorites.filter(id => id !== tuning.id);
    if (!commit({ custom,favorites })) return;
    if (state.selection[tuning.instrument] === tuning.id) {
      state.selection[tuning.instrument] = standard(tuning.instrument).id;
      if (state.mode === tuning.instrument) state.manual = null;
    }
    renderMode();
    updateLibrary();
  });
}
function updateLibrary() {
  renderLibrary(allTunings().filter(tuning => tuning.custom || library.favorites.includes(tuning.id)),
    library.favorites,{ favorite: toggleFavorite, use: tuning => {
      activate(tuning);
      get('afinador').scrollIntoView();
    }, edit, remove });
}
get('new-tuning').onclick = () => edit(current() ?? standard('guitar'),'new');
star.onclick = () => toggleFavorite(current().id);
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());

const dialog = get('song-dialog');
const query = get('song-query');
get('open-search').onclick = () => {
  dialog.showModal();
  query.focus();
};
query.oninput = () => {
  const results = searchSongs(query.value);
  const list = get('song-results');
  list.replaceChildren();
  if (!query.value.trim()) return;
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay coincidencias en el catálogo local.';
    list.append(empty);
  }
  for (const song of results) {
    const tuning = findPreset(song.tuningId);
    const result = document.createElement('article');
    result.className = 'song-result';
    const title = document.createElement('strong');
    title.textContent = song.title + ' · ' + song.artist;
    const notes = document.createElement('p');
    notes.textContent = tuning.notes.map(note => labelOf(note)).join(' · ');
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.textContent = 'Usar afinación';
    apply.onclick = () => {
      activate(tuning);
      dialog.close();
    };
    const source = document.createElement('a');
    source.href = song.source;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Fuente de la afinación';
    result.append(title,notes,apply,source);
    list.append(result);
  }
};

renderMode();
renderWave();
updateLibrary();
