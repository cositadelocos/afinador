import { flats, labelOf, minMidi, maxMidi, sharps } from './notes.mjs';

const get = id => document.getElementById(id);
const create = (tag, value, className) => {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
};
function action(text, onClick, pressed) {
  const button = create('button', text);
  button.type = 'button';
  button.onclick = onClick;
  if (pressed !== undefined) button.setAttribute('aria-pressed', pressed);
  return button;
}
export function renderLibrary(items, favorites, events) {
  get('library-items').replaceChildren(...items.map(tuning => {
    const item = create('article', null, 'library-item');
    const text = create('div', null, 'item-text');
    text.append(create('strong', tuning.name),create('p', tuning.notes.map(note => labelOf(note,tuning.flats)).join(' · ')));
    if (tuning.instrument === 'uke') text.append(create('p', 'Ukulele soprano'));
    const controls = create('div',null,'item-actions');
    const favorite = favorites.includes(tuning.id);
    const star = action(favorite ? '★' : '☆', () => events.favorite(tuning.id), favorite);
    star.setAttribute('aria-label', favorite ? 'Quitar de favoritas' : 'Marcar como favorita');
    controls.append(action('Usar', () => events.use(tuning)),star,action('Duplicar', () => events.edit(tuning,'duplicate')));
    if (tuning.custom) controls.append(action('Editar', () => events.edit(tuning,'edit')),action('Eliminar', () => events.remove(tuning)));
    item.append(text,controls);
    return item;
  }));
}

const editor = get('editor');
const form = get('editor-form');
const instrumentSelect = get('tuning-instrument');
const nameInput = get('tuning-name');
const fieldList = get('editor-strings');
function selectOf(values, value, label, name) {
  const select = create('select');
  select.name = name;
  select.setAttribute('aria-label',label);
  select.append(...values.map(([v,t]) => new Option(t,v)));
  select.value = value;
  return select;
}
function renderRows(notes) {
  fieldList.replaceChildren(...notes.map((midi,index) => {
    const label = 'Cuerda ' + (notes.length - index);
    const row = create('div',null,'editor-row');
    row.append(
      create('span',label),
      selectOf(sharps.map((name,i) => [i,name === flats[i] ? name : name + ' / ' + flats[i]]), midi % 12, label + ', nota', 'note'),
      selectOf(Array.from({length: Math.floor(maxMidi / 12) - Math.floor(minMidi / 12) + 1}, (_,i) => [i,'Octava ' + i]), Math.floor(midi / 12) - 1, label + ', octava', 'octave'),
    );
    return row;
  }));
}
export function beginEdit(tuning, mode, getStandard, onSave) {
  get('editor-title').textContent = { new: 'Crear afinación', edit: 'Editar afinación', duplicate: 'Duplicar afinación' }[mode];
  const error = get('editor-error');
  error.hidden = true;
  nameInput.value = mode === 'new' ? '' : mode === 'edit' ? tuning.name : tuning.name.slice(0,40) + ' copia';
  instrumentSelect.value = tuning.instrument;
  instrumentSelect.disabled = mode === 'edit';
  const drafts = { [tuning.instrument]: tuning.notes };
  let instrument = tuning.instrument;
  const readNotes = () => {
    const data = new FormData(form);
    return data.getAll('note').map((note,index) => 12 * (Number(data.getAll('octave')[index]) + 1) + Number(note));
  };
  renderRows(tuning.notes);
  instrumentSelect.onchange = () => {
    drafts[instrument] = readNotes();
    instrument = instrumentSelect.value;
    renderRows(drafts[instrument] ?? getStandard(instrument).notes);
  };
  form.onsubmit = event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      error.textContent = 'Escribe un nombre para la afinación.';
      error.hidden = false;
      nameInput.focus();
      return;
    }
    const saved = onSave({
      id: mode === 'edit' ? tuning.id : 'custom-' + (crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')),
      custom: true, name, instrument, notes: readNotes(), flats: tuning.flats ?? false,
    });
    if (saved) editor.close();
    else {
      error.textContent = 'No se pudo guardar en este dispositivo. Revisa que el navegador permita el almacenamiento local.';
      error.hidden = false;
    }
  };
  editor.showModal();
  nameInput.focus();
}
export function confirmDelete(tuning, onConfirm) {
  const dialog = get('delete-dialog');
  get('delete-message').textContent = '¿Eliminar «' + tuning.name + '» de tus afinaciones?';
  dialog.returnValue = '';
  dialog.onclose = () => {
    if (dialog.returnValue === 'delete') onConfirm();
  };
  dialog.showModal();
}
