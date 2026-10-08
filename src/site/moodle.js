// Stands in for Moodle: the same SCORM 1.2 API the course finds in a real LMS,
// with the learner record shown in plain words beside it. The record survives
// a reload so "close and reopen" shows the course resuming.
import { t, onLang, setLang, currentLang } from './ui.js';

const KEY = 'cwrs:moodle-view';
const fresh = () => ({ 'cmi.core.lesson_status': 'not attempted', 'cmi.suspend_data': '', 'cmi.core.lesson_location': '' });
let cmi = fresh();
try { cmi = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { /* storage blocked */ }
const log = [];

const STATUS = {
  'not attempted': { cy: 'Heb ddechrau', en: 'Not started' },
  incomplete: { cy: 'Ar y gweill', en: 'In progress' },
  completed: { cy: 'Wedi gorffen', en: 'Completed' },
  passed: { cy: 'Wedi pasio', en: 'Passed' },
  failed: { cy: 'Heb basio', en: 'Not passed' },
};
const LANG = { cy: { cy: 'Cymraeg', en: 'Welsh' }, en: { cy: 'Saesneg', en: 'English' } };
const DASH = '–';

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cmi)); } catch (e) { /* storage blocked */ }
}

function setValue(id, text, className, quiet) {
  const node = document.getElementById(id);
  node.classList.remove('flash');
  if (!quiet && node.textContent !== text && node.textContent !== '') {
    node.classList.remove('flash');
    void node.offsetWidth; // restart the highlight
    node.classList.add('flash');
  }
  node.textContent = text;
  const flashing = node.classList.contains('flash');
  node.className = (className || '') + (flashing ? ' flash' : '');
}

function show(quiet) {
  let saved = {};
  try { saved = JSON.parse(cmi['cmi.suspend_data'] || '{}'); } catch (e) { /* empty */ }
  // One language button on this page: the course's. The panel follows it.
  if (saved.l) setLang(saved.l);
  const status = cmi['cmi.core.lesson_status'];
  const frame = document.getElementById('course').contentWindow;
  const total = frame && frame.COURSE ? frame.COURSE.pages.length : null;
  const questions = frame && frame.COURSE
    ? frame.COURSE.pages.flatMap((p) => p.blocks).filter((b) => b.type === 'question').length : null;
  const of = (n, m) => (m == null ? String(n) : `${n} / ${m}`);

  setValue('v-status', STATUS[status] ? t(STATUS[status]) : status, status, quiet);
  setValue('v-score', cmi['cmi.core.score.raw'] ? cmi['cmi.core.score.raw'] + '%' : DASH, '', quiet);
  setValue('v-lang', saved.l ? t(LANG[saved.l]) : DASH, '', quiet);
  const location = cmi['cmi.core.lesson_location'];
  const pageText = location === '' ? DASH
    : total != null && Number(location) >= total ? t({ cy: 'Diwedd y cwrs', en: 'End of course' })
      : of(Number(location) + 1, total);
  setValue('v-page', pageText, '', quiet);
  setValue('v-seen', saved.v ? of(saved.v.length, total) : DASH, '', quiet);
  setValue('v-answered', saved.a ? of(Object.keys(saved.a).length, questions) : DASH, '', quiet);
  document.getElementById('log').textContent = log.slice(-200).reverse().join('\n');
}

const record = (line) => log.push(line);
window.API = {
  LMSInitialize: () => { record('LMSInitialize'); return 'true'; },
  LMSFinish: () => { record('LMSFinish'); persist(); return 'true'; },
  LMSGetValue: (key) => { record(`LMSGetValue ${key}`); return cmi[key] ?? ''; },
  LMSSetValue: (key, value) => { if (cmi[key] !== value) record(`LMSSetValue ${key} = ${value}`); cmi[key] = value; return 'true'; },
  LMSCommit: () => { persist(); show(); return 'true'; },
  LMSGetLastError: () => '0',
  LMSGetErrorString: () => '',
  LMSGetDiagnostic: () => '',
};

// A new learner starts in the language chosen on the landing page.
const launch = () => { document.getElementById('course').src = `cwrs/index.html?lang=${currentLang()}&moodle=${Date.now()}`; };
document.getElementById('course').addEventListener('load', () => show(true));
document.getElementById('relaunch').addEventListener('click', () => { record('--- ' + t({ cy: 'ailagor', en: 'reopen' }) + ' ---'); launch(); });
document.getElementById('reset').addEventListener('click', () => {
  cmi = fresh(); log.length = 0; persist(); launch();
});
onLang(() => show(true));
launch();
