// Course editor: the spreadsheet as a form, built with the same lib.mjs as the
// command-line build, so the editor and the build refuse the same mistakes.
import { parseCsv, buildCourse, scormManifest } from './lib.mjs';
import { makeZip } from './zip.js';
import { t, onLang } from './ui.js';

const COLUMNS = ['type', 'cy', 'en', 'options_cy', 'options_en', 'answer', 'media_cy', 'media_en'];
const STORE = 'cwrs:editor-rows';
const TYPES = {
  course: { cy: 'Teitl y cwrs', en: 'Course title' },
  unit: { cy: 'Uned', en: 'Unit' },
  page: { cy: 'Tudalen', en: 'Page' },
  heading: { cy: 'Is-bennawd', en: 'Subheading' },
  text: { cy: 'Paragraff', en: 'Paragraph' },
  callout: { cy: 'Nodyn amlwg', en: 'Highlighted note' },
  list: { cy: 'Rhestr', en: 'List' },
  question: { cy: 'Cwestiwn', en: 'Question' },
  video: { cy: 'Fideo', en: 'Video' },
};
const MULTILINE = new Set(['text', 'callout', 'list']);
const L = {
  missingBoth: { cy: 'Ar goll', en: 'Missing' },
  onePerLine: { cy: 'Un eitem ar bob llinell.', en: 'One item per line.' },
  options: { cy: 'Dewisiadau, un ar bob llinell', en: 'Options, one per line' },
  correct: { cy: 'Ateb cywir', en: 'Correct answer' },
  choose: { cy: 'Dewiswch…', en: 'Choose…' },
  passMark: { cy: 'Marc pasio (%)', en: 'Pass mark (%)' },
  videoLink: { cy: 'Dolen y fideo', en: 'Video link' },
  videoHint: { cy: 'Copïwch y ddolen o YouTube neu Vimeo. Gall yr un fideo wasanaethu’r ddwy iaith.', en: 'Copy the link from YouTube or Vimeo. The same video can serve both languages.' },
  up: { cy: 'Symud i fyny', en: 'Move up' },
  down: { cy: 'Symud i lawr', en: 'Move down' },
  remove: { cy: 'Dileu’r rhes', en: 'Delete row' },
  row: { cy: 'Rhes', en: 'Row' },
  ready: { cy: 'Mae’r cwrs yn barod: mae pob testun yn y ddwy iaith.', en: 'The course is ready: every text is in both languages.' },
  problems: { cy: 'Problemau: {n}. Mae’r rhagolwg yn dangos y fersiwn olaf oedd yn gweithio, ac mae’r pecyn SCORM wedi’i gloi nes eu datrys.', en: 'Problems: {n}. The preview shows the last version that worked, and the SCORM package is locked until they are fixed.' },
  resetConfirm: { cy: 'Colli’ch newidiadau a mynd yn ôl i’r demo?', en: 'Lose your changes and go back to the demo?' },
  loadFailed: { cy: 'Methu darllen y daenlen. A oes colofnau type, cy ac en ynddi?', en: 'Could not read the spreadsheet. Does it have type, cy and en columns?' },
};
const lang = { cy: 'Cymraeg', en: 'English' };

let rows = [];
let errorsByRow = new Map();
let lastErrors = [];
let lastValid = null;

const $ = (id) => document.getElementById(id);
const el = (tag, props, ...children) => {
  const node = document.createElement(tag);
  Object.assign(node, props || {});
  for (const child of children) if (child != null) node.append(child);
  return node;
};
const blank = (type) => Object.fromEntries(COLUMNS.map((c) => [c, c === 'type' ? type : '']));
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(rows)); } catch (e) { /* storage blocked */ } };

// ---- building ---------------------------------------------------------------
// Records carry line = index + 1 so an error points at the editor's row number.
function rebuild() {
  const { course, errors } = buildCourse(rows.map((row, index) => ({ ...row, line: index + 1 })));
  lastErrors = errors;
  errorsByRow = new Map();
  for (const error of errors) {
    if (error.line == null) continue;
    const list = errorsByRow.get(error.line - 1) || [];
    list.push(error);
    errorsByRow.set(error.line - 1, list);
  }
  showErrors();
  $('download-scorm').disabled = errors.length > 0;
  if (!errors.length) {
    lastValid = course;
    window.previewCourse = course;
    const frame = $('preview');
    if (frame.contentWindow && frame.src) frame.contentWindow.location.reload();
  }
}

let timer = null;
const rebuildSoon = () => { clearTimeout(timer); timer = setTimeout(rebuild, 350); };

function showErrors() {
  const status = $('status');
  status.classList.toggle('has-errors', lastErrors.length > 0);
  if (!lastErrors.length) status.replaceChildren(el('p', { textContent: t(L.ready) }));
  else {
    status.replaceChildren(
      el('p', { textContent: t(L.problems).replace('{n}', lastErrors.length) }),
      el('ul', {}, ...lastErrors.map((error) => {
        const label = (error.line ? `${t(L.row)} ${error.line}: ` : '') + t(error);
        if (!error.line) return el('li', { textContent: label });
        const jump = el('button', { type: 'button', textContent: label });
        jump.addEventListener('click', () => {
          const row = $('rows').children[error.line - 1];
          row.scrollIntoView({ block: 'center' });
          (row.querySelector('input:placeholder-shown, textarea:placeholder-shown') || row.querySelector('input, textarea')).focus({ preventScroll: true });
        });
        return el('li', {}, jump);
      })));
  }
  [...$('rows').children].forEach((node, index) => {
    const errors = errorsByRow.get(index) || [];
    node.classList.toggle('invalid', errors.length > 0);
    node.querySelector('.row-error').textContent = errors.map((e) => t(e)).join(' ');
  });
}

// ---- rendering --------------------------------------------------------------
function field(label, value, { multiline, type = 'text', lines, onInput, lang: fieldLang }) {
  const shown = lines ? value.split('|').join('\n') : value;
  const control = multiline || lines
    ? el('textarea', { value: shown, rows: lines ? 3 : 3, placeholder: ' ' })
    : el('input', { type, value: shown, placeholder: ' ' });
  if (fieldLang) control.lang = fieldLang;
  control.addEventListener('input', () => {
    onInput(lines ? control.value.split('\n').map((s) => s.trim()).filter(Boolean).join('|') : control.value);
    save();
    rebuildSoon();
  });
  return el('label', { className: 'field' }, el('span', { textContent: label }), control);
}

function renderRow(row, index) {
  const node = el('li', { className: `row kind-${row.type}` });
  const select = el('select', {}, ...Object.entries(TYPES).map(([value, label]) => el('option', { value, textContent: t(label), selected: value === row.type })));
  select.setAttribute('aria-label', `${t(L.row)} ${index + 1}`);
  select.addEventListener('change', () => { row.type = select.value; save(); renderRows(); rebuild(); });
  const button = (text, label, onClick) => {
    const b = el('button', { type: 'button', className: 'icon', textContent: text });
    b.setAttribute('aria-label', t(label));
    b.title = t(label);
    b.addEventListener('click', onClick);
    return b;
  };
  const move = (delta) => {
    const to = index + delta;
    if (to < 0 || to >= rows.length) return;
    [rows[index], rows[to]] = [rows[to], rows[index]];
    save(); renderRows(); rebuild();
    $('rows').children[to].querySelector('.icon[aria-label="' + t(delta < 0 ? L.up : L.down) + '"]')?.focus();
  };
  node.append(el('div', { className: 'row-head' },
    el('span', { className: 'num', textContent: String(index + 1) }), select, el('span', { className: 'spacer' }),
    button('↑', L.up, () => move(-1)), button('↓', L.down, () => move(1)),
    button('✕', L.remove, () => { rows.splice(index, 1); save(); renderRows(); rebuild(); })));

  const isList = row.type === 'list';
  node.append(el('div', { className: 'pair' },
    ...['cy', 'en'].map((code) => field(lang[code], row[code], {
      multiline: MULTILINE.has(row.type), lines: isList, lang: code, onInput: (v) => { row[code] = v; },
    }))));
  if (isList) node.append(el('p', { className: 'hint', textContent: t(L.onePerLine) }));

  if (row.type === 'question') {
    node.append(el('div', { className: 'pair' },
      ...['cy', 'en'].map((code) => field(`${t(L.options)} · ${lang[code]}`, row[`options_${code}`], {
        lines: true, lang: code, onInput: (v) => { row[`options_${code}`] = v; refreshAnswer(); },
      }))));
    const answer = el('select', {});
    const refreshAnswer = () => {
      const options = (row.options_cy || row.options_en).split('|').filter(Boolean);
      answer.replaceChildren(el('option', { value: '', textContent: t(L.choose) }),
        ...options.map((text, i) => el('option', { value: String(i), textContent: `${i + 1}. ${text}`, selected: String(i) === row.answer })));
    };
    answer.addEventListener('change', () => { row.answer = answer.value; save(); rebuild(); });
    refreshAnswer();
    node.append(el('label', { className: 'extra' }, el('span', { textContent: t(L.correct) }), answer));
  }
  if (row.type === 'video') {
    node.append(el('div', { className: 'pair' },
      ...['cy', 'en'].map((code) => field(`${t(L.videoLink)} · ${lang[code]}`, row[`media_${code}`], {
        type: 'url', onInput: (v) => { row[`media_${code}`] = v.trim(); },
      }))));
    node.append(el('p', { className: 'hint', textContent: t(L.videoHint) }));
  }
  if (row.type === 'course') {
    const mark = el('input', { type: 'number', min: 1, max: 100, value: row.answer || '100' });
    mark.addEventListener('input', () => { row.answer = mark.value; save(); rebuildSoon(); });
    node.append(el('label', { className: 'extra' }, el('span', { textContent: t(L.passMark) }), mark));
  }
  node.append(el('p', { className: 'row-error' }));
  return node;
}

function renderRows() {
  $('rows').replaceChildren(...rows.map(renderRow));
  $('add-type').replaceChildren(...Object.entries(TYPES).filter(([v]) => v !== 'course')
    .map(([value, label]) => el('option', { value, textContent: t(label), selected: value === 'text' })));
  showErrors();
}

// ---- files ------------------------------------------------------------------
const quote = (value) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const toCsv = () => '﻿' + [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((c) => quote(row[c] || '')).join(','))].join('\r\n') + '\r\n';

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const slug = () => (lastValid ? lastValid.title.en : 'cwrs').toLowerCase()
  .replace(/^demo\s*·\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cwrs';

$('download-csv').addEventListener('click', () => download(`${slug()}.csv`, toCsv(), 'text/csv;charset=utf-8'));

$('download-scorm').addEventListener('click', async () => {
  if (lastErrors.length || !lastValid) return;
  const runtime = ['index.html', 'player.js', 'scorm.js', 'style.css'];
  const files = await Promise.all(runtime.map(async (name) => ({ name, data: new Uint8Array(await (await fetch(`cwrs/${name}`)).arrayBuffer()) })));
  files.push({ name: 'course.js', data: `window.COURSE = ${JSON.stringify(lastValid, null, 2)};\n` });
  files.unshift({ name: 'imsmanifest.xml', data: scormManifest({ id: `cwrs-${slug()}`, title: `${lastValid.title.cy} / ${lastValid.title.en}`, files: [...runtime, 'course.js'] }) });
  download(`${slug()}-scorm12.zip`, makeZip(files), 'application/zip');
});

$('load-csv').addEventListener('click', () => $('csv-file').click());
$('csv-file').addEventListener('change', async () => {
  const file = $('csv-file').files[0];
  if (!file) return;
  const records = parseCsv(await file.text());
  $('csv-file').value = '';
  if (!records.length || !('type' in records[0]) || !('cy' in records[0])) { alert(t(L.loadFailed)); return; }
  rows = records.map((r) => ({ ...blank(r.type), ...Object.fromEntries(COLUMNS.map((c) => [c, r[c] || ''])) }));
  save(); renderRows(); rebuild();
});

$('reset').addEventListener('click', async () => {
  if (!confirm(t(L.resetConfirm))) return;
  try { localStorage.removeItem(STORE); } catch (e) { /* storage blocked */ }
  await loadDemo(); renderRows(); rebuild();
});

$('add-row').addEventListener('click', () => {
  rows.push(blank($('add-type').value));
  save(); renderRows(); rebuild();
  const last = $('rows').lastElementChild;
  last.scrollIntoView({ block: 'center' });
  last.querySelector('input, textarea').focus({ preventScroll: true });
});

async function loadDemo() {
  const records = parseCsv(await (await fetch('plymio-demo.csv')).text());
  rows = records.map((r) => Object.fromEntries(COLUMNS.map((c) => [c, r[c] || ''])));
}

// ---- start ------------------------------------------------------------------
try { rows = JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { rows = []; }
if (!rows.length) await loadDemo();
rebuild();
$('preview').src = 'cwrs/index.html?preview=1';
let started = false;
onLang(() => { if (started) { renderRows(); showErrors(); } });
renderRows();
started = true;
