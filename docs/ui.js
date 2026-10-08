// Language switch for the demo's own pages (hub, Moodle view, editor). Static
// text carries data-cy / data-en; scripts register for changes.
const KEY = 'cwrs:ui-lang';
const listeners = [];
let lang = 'cy';
try { lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'cy'; } catch (e) { /* storage blocked */ }

export const t = (pair) => pair[lang];
export const currentLang = () => lang;
export const onLang = (fn) => { listeners.push(fn); fn(lang); };

function apply() {
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll('[data-cy]')) node.textContent = node.dataset[lang];
  for (const node of document.querySelectorAll('[data-cy-label]')) node.setAttribute('aria-label', node.dataset[lang + 'Label']);
  for (const node of document.querySelectorAll('[data-cy-title]')) document.title = node.dataset[lang + 'Title'];
  const button = document.getElementById('ui-lang');
  if (button) { button.textContent = lang === 'cy' ? 'English' : 'Cymraeg'; button.lang = lang === 'cy' ? 'en' : 'cy'; }
  listeners.forEach((fn) => fn(lang));
}

export function setLang(next) {
  if (next !== 'cy' && next !== 'en') return;
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch (e) { /* storage blocked */ }
  apply();
}

document.getElementById('ui-lang')?.addEventListener('click', () => setLang(lang === 'cy' ? 'en' : 'cy'));
apply();
