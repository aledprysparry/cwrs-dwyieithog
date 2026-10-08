// Course player. Reads window.COURSE (built from the spreadsheet), renders one
// page at a time, and swaps language in place without losing the learner's place.
(function () {
  // ?preview=1 inside the editor: read the course the editor has just built.
  const preview = new URLSearchParams(location.search).has('preview') && window.parent !== window;
  const course = (preview && window.parent.previewCourse) || window.COURSE;
  const Scorm = window.Scorm;

  const UI = {
    cy: {
      other: 'English', otherLang: 'en', skip: "Neidio i'r cynnwys", contents: 'Cynnwys',
      prev: 'Blaenorol', next: 'Nesaf', finish: 'Gorffen', pageOf: 'Tudalen {n} o {t}',
      check: "Gwirio'r ateb", choose: 'Dewiswch ateb yn gyntaf.', correct: 'Cywir.',
      wrong: 'Ddim yn gywir. Yr ateb cywir yw: {a}', doneTitle: 'Diwedd y cwrs',
      passed: 'Da iawn. Rydych chi wedi pasio gyda sgôr o {s}%.',
      failed: 'Eich sgôr yw {s}%. Mae angen {m}% i basio.', retry: 'Ceisio eto',
      unanswered: 'Mae rhai cwestiynau heb eu hateb eto.', unvisited: 'Ewch drwy bob tudalen i orffen y cwrs.',
      back: "Yn ôl i'r cwestiynau",
    },
    en: {
      other: 'Cymraeg', otherLang: 'cy', skip: 'Skip to content', contents: 'Contents',
      prev: 'Previous', next: 'Next', finish: 'Finish', pageOf: 'Page {n} of {t}',
      check: 'Check answer', choose: 'Choose an answer first.', correct: 'Correct.',
      wrong: 'Not quite. The correct answer is: {a}', doneTitle: 'End of course',
      passed: 'Well done. You passed with a score of {s}%.',
      failed: 'Your score is {s}%. You need {m}% to pass.', retry: 'Try again',
      unanswered: 'Some questions have not been answered yet.', unvisited: 'Go through every page to finish the course.',
      back: 'Back to the questions',
    },
  };

  const finishIndex = course.pages.length;
  const questions = course.pages.flatMap((page, index) =>
    page.blocks.filter((block) => block.type === 'question').map((block) => ({ ...block, page: index })));

  const $ = (id) => document.getElementById(id);
  const el = (tag, props, ...children) => {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    for (const child of children) if (child != null) node.append(child);
    return node;
  };
  const fill = (template, values) => template.replace(/\{(\w)\}/g, (_, key) => values[key]);

  // ---- state ----------------------------------------------------------------
  Scorm.init();
  const state = { lang: 'cy', page: 0, visited: [], answers: {} };
  try {
    const saved = JSON.parse(Scorm.get('cmi.suspend_data') || '{}');
    if (saved.l) state.lang = saved.l;
    if (Number.isInteger(saved.p)) state.page = Math.min(saved.p, finishIndex);
    if (Array.isArray(saved.v)) state.visited = saved.v;
    if (saved.a) state.answers = saved.a;
  } catch (e) { /* first launch */ }
  const requested = new URLSearchParams(location.search).get('lang');
  if (!Scorm.get('cmi.suspend_data') && (requested === 'cy' || requested === 'en')) state.lang = requested;

  function save() {
    Scorm.set('cmi.suspend_data', JSON.stringify({ l: state.lang, p: state.page, v: state.visited, a: state.answers }));
    Scorm.set('cmi.core.lesson_location', String(state.page));
    Scorm.commit();
  }

  function result() {
    const allVisited = course.pages.every((_, index) => state.visited.includes(index));
    const allAnswered = questions.every((q) => q.id in state.answers);
    const right = questions.filter((q) => state.answers[q.id] === q.answer).length;
    const score = questions.length ? Math.round((right / questions.length) * 100) : 100;
    return { allVisited, allAnswered, score, passed: score >= course.mastery };
  }

  function report() {
    const r = result();
    if (!r.allVisited || !r.allAnswered) return;
    if (questions.length) {
      Scorm.set('cmi.core.score.min', '0');
      Scorm.set('cmi.core.score.max', '100');
      Scorm.set('cmi.core.score.raw', String(r.score));
      Scorm.set('cmi.core.lesson_status', r.passed ? 'passed' : 'failed');
    } else Scorm.set('cmi.core.lesson_status', 'completed');
    Scorm.commit();
  }

  // ---- rendering ------------------------------------------------------------
  function renderBlock(block, t, lang) {
    if (block.type === 'text') return el('p', { textContent: block.text[lang] });
    if (block.type === 'heading') return el('h2', { textContent: block.text[lang] });
    if (block.type === 'video') return renderVideo(block, lang);
    if (block.type === 'callout') return el('p', { className: 'callout', textContent: block.text[lang] });
    if (block.type === 'list') return el('ul', {}, ...block.items[lang].map((item) => el('li', { textContent: item })));
    if (block.type === 'question') return renderQuestion(block, t, lang);
    return null;
  }

  function renderVideo(block, lang) {
    const src = block.src[lang];
    const frame = src.kind === 'file'
      ? el('video', { src: src.url, controls: true, preload: 'metadata' })
      : el('iframe', { src: src.url, title: block.title[lang], loading: 'lazy', allowFullscreen: true });
    if (src.kind !== 'file') frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
    if (src.kind === 'file') frame.setAttribute('aria-label', block.title[lang]);
    return el('figure', { className: 'video' }, el('div', { className: 'frame' }, frame), el('figcaption', { textContent: block.title[lang] }));
  }

  function renderQuestion(q, t, lang) {
    const answered = q.id in state.answers;
    const feedback = el('p', { className: 'feedback', tabIndex: -1 });
    feedback.setAttribute('role', 'status');
    const fieldset = el('fieldset', { className: 'question' }, el('legend', { textContent: q.prompt[lang] }));
    q.options[lang].forEach((option, index) => {
      const input = el('input', { type: 'radio', name: q.id, value: String(index), disabled: answered });
      if (answered && state.answers[q.id] === index) input.checked = true;
      const label = el('label', { className: 'option' }, input, el('span', { textContent: option }));
      if (answered && index === q.answer) label.classList.add('is-correct');
      if (answered && index === state.answers[q.id] && index !== q.answer) label.classList.add('is-wrong');
      fieldset.append(label);
    });
    if (answered) {
      const right = state.answers[q.id] === q.answer;
      feedback.textContent = right ? t.correct : fill(t.wrong, { a: q.options[lang][q.answer] });
      feedback.classList.add(right ? 'good' : 'bad');
      fieldset.append(feedback);
    } else {
      const check = el('button', { type: 'button', className: 'secondary', textContent: t.check });
      check.addEventListener('click', () => {
        const chosen = fieldset.querySelector('input:checked');
        if (!chosen) { feedback.textContent = t.choose; feedback.className = 'feedback bad'; return; }
        state.answers[q.id] = Number(chosen.value);
        save();
        render({ keepFocusOn: q.id });
      });
      fieldset.append(check, feedback);
    }
    return fieldset;
  }

  function renderFinish(t, lang) {
    const r = result();
    const body = [];
    if (!r.allVisited) body.push(el('p', { textContent: t.unvisited }));
    else if (!r.allAnswered) body.push(el('p', { textContent: t.unanswered }));
    else body.push(el('p', { className: 'result', textContent: r.passed ? fill(t.passed, { s: r.score }) : fill(t.failed, { s: r.score, m: course.mastery }) }));
    const quizPage = questions.length ? questions[0].page : 0;
    if (r.allVisited && r.allAnswered && !r.passed) {
      const retry = el('button', { type: 'button', className: 'primary', textContent: t.retry });
      retry.addEventListener('click', () => { state.answers = {}; go(quizPage); });
      body.push(retry);
    } else if (r.allVisited && !r.allAnswered) {
      const back = el('button', { type: 'button', className: 'secondary', textContent: t.back });
      back.addEventListener('click', () => go(quizPage));
      body.push(back);
    }
    return [el('h1', { textContent: t.doneTitle, tabIndex: -1 }), ...body];
  }

  function render(opts) {
    const lang = state.lang;
    const t = UI[lang];
    document.documentElement.lang = lang;
    document.title = course.title[lang];
    document.querySelector('[data-ui="skip"]').textContent = t.skip;
    $('course-title').textContent = course.title[lang];

    const toggle = $('lang-toggle');
    toggle.textContent = t.other;
    toggle.lang = t.otherLang;

    // Contents list
    $('toc-summary').textContent = `${t.contents} · ${fill(t.pageOf, { n: Math.min(state.page + 1, finishIndex), t: finishIndex })}`;
    const list = $('toc-list');
    const pageItem = (page, index) => {
      const button = el('button', { type: 'button', textContent: page.title[lang] });
      if (index === state.page) button.setAttribute('aria-current', 'page');
      if (state.visited.includes(index)) button.classList.add('visited');
      button.addEventListener('click', () => go(index));
      return el('li', {}, button);
    };
    const units = course.units || [];
    if (!units.length) list.replaceChildren(...course.pages.map(pageItem));
    else {
      const groups = [];
      course.pages.forEach((page, index) => {
        const key = page.unit == null ? -1 : page.unit;
        let group = groups.find((g) => g.key === key);
        if (!group) groups.push(group = { key, items: [] });
        group.items.push(pageItem(page, index));
      });
      list.replaceChildren(...groups.map((g) => el('li', { className: 'unit' },
        g.key >= 0 ? el('p', { className: 'unit-title', textContent: units[g.key].title[lang] }) : null,
        el('ol', {}, ...g.items))));
    }

    // Page body
    const article = $('page');
    if (state.page === finishIndex) article.replaceChildren(...renderFinish(t, lang));
    else {
      const page = course.pages[state.page];
      article.replaceChildren(el('h1', { textContent: page.title[lang], tabIndex: -1 }),
        ...page.blocks.map((block) => renderBlock(block, t, lang)));
    }

    // Pager + progress
    $('prev').textContent = t.prev;
    $('prev').hidden = state.page === 0;
    const onLastPage = state.page === finishIndex - 1;
    $('next').textContent = onLastPage ? t.finish : t.next;
    $('next').hidden = state.page === finishIndex;
    $('count').textContent = state.page < finishIndex ? fill(t.pageOf, { n: state.page + 1, t: finishIndex }) : '';
    const pct = Math.round((state.visited.filter((i) => i < finishIndex).length / finishIndex) * 100);
    $('progress').setAttribute('aria-valuenow', String(pct));
    $('progress').setAttribute('aria-label', fill(t.pageOf, { n: state.page + 1, t: finishIndex }));
    $('progress').firstElementChild.style.width = pct + '%';

    if (opts && opts.keepFocusOn === 'lang') toggle.focus();
    else if (opts && opts.keepFocusOn) {
      const next = document.querySelector(`input[name="${opts.keepFocusOn}"]`);
      if (next) next.closest('fieldset').querySelector('.feedback').focus({ preventScroll: true });
    } else if (opts && opts.moved) article.querySelector('h1').focus({ preventScroll: true });
  }

  function go(index) {
    state.page = Math.max(0, Math.min(index, finishIndex));
    if (state.page < finishIndex && !state.visited.includes(state.page)) state.visited.push(state.page);
    save();
    if (state.page === finishIndex) report();
    render({ moved: true });
    window.scrollTo({ top: 0 });
  }

  $('lang-toggle').addEventListener('click', () => {
    state.lang = state.lang === 'cy' ? 'en' : 'cy';
    save();
    render({ keepFocusOn: 'lang' });
  });
  $('prev').addEventListener('click', () => go(state.page - 1));
  $('next').addEventListener('click', () => go(state.page + 1));

  // The contents list is a sidebar on wide screens and folds away on phones.
  const wide = window.matchMedia('(min-width: 860px)');
  const syncToc = () => { $('toc-details').open = wide.matches; };
  wide.addEventListener('change', syncToc);
  syncToc();

  window.addEventListener('pagehide', () => Scorm.finish());
  window.addEventListener('beforeunload', () => Scorm.finish());

  if (!state.visited.includes(state.page) && state.page < finishIndex) state.visited.push(state.page);
  save();
  render();
})();
