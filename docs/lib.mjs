// Turns the spreadsheet (CSV) into a course object and the SCORM 1.2 manifest.
// Pure functions only, so the tests can run them without touching the disk.

export const LANGS = ['cy', 'en'];

// RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  const [header, ...body] = rows;
  return body.map((cells, index) => {
    const record = { line: index + 2 };
    header.forEach((name, col) => { record[name.trim()] = (cells[col] ?? '').trim(); });
    return record;
  });
}

// Accepts the link an author copies from the browser and returns an embeddable
// one. YouTube goes through the no-cookie domain. The same video may serve both
// languages, or each language may have its own.
export function videoEmbed(url) {
  if (!url) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.replace(/^www\./, '');
  let id = null;
  if (host === 'youtu.be') id = parsed.pathname.slice(1);
  else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
    id = parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1];
  }
  if (id && /^[\w-]{6,}$/.test(id)) return { kind: 'iframe', url: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const vid = parsed.pathname.match(/(\d{5,})/)?.[1];
    if (vid) return { kind: 'iframe', url: `https://player.vimeo.com/video/${vid}` };
  }
  if (/\.mp4$/i.test(parsed.pathname)) return { kind: 'file', url: parsed.href };
  return null;
}

const splitItems = (value) => value.split('|').map((item) => item.trim()).filter(Boolean);

const LANG_NAME = { cy: { cy: 'Cymraeg', en: 'Welsh' }, en: { cy: 'Saesneg', en: 'English' } };

// Every string must exist in both languages: a missing translation fails the
// build rather than shipping a course that is half English. Errors carry both
// languages because authors read them in the editor.
export function buildCourse(records) {
  const errors = [];
  const course = { title: null, mastery: 100, units: [], pages: [] };
  let questionCount = 0;
  const fail = (record, cy, en) => errors.push({ line: record ? record.line : null, cy, en });
  const bilingual = (record) => {
    for (const lang of LANGS) {
      if (!record[lang]) fail(record, `Mae'r testun ${LANG_NAME[lang].cy} ar goll.`, `The ${LANG_NAME[lang].en} text is missing.`);
    }
    return { cy: record.cy, en: record.en };
  };

  for (const record of records) {
    const page = course.pages.at(-1);
    switch (record.type) {
      case 'course':
        course.title = bilingual(record);
        if (record.answer) course.mastery = Number(record.answer);
        break;
      case 'unit':
        course.units.push({ title: bilingual(record) });
        break;
      case 'page':
        course.pages.push({ title: bilingual(record), unit: course.units.length ? course.units.length - 1 : null, blocks: [] });
        break;
      case 'heading':
      case 'video':
      case 'text':
      case 'callout':
      case 'list':
      case 'question': {
        if (!page) { fail(record, 'Rhaid cael tudalen cyn y rhes hon.', 'This row must come after a page.'); break; }
        if (record.type === 'list') {
          const cy = splitItems(record.cy);
          const en = splitItems(record.en);
          if (!cy.length || !en.length) bilingual({ ...record, cy: cy.join('|'), en: en.join('|') });
          else if (cy.length !== en.length) fail(record, `Mae ${cy.length} eitem Gymraeg a ${en.length} eitem Saesneg.`, `There are ${cy.length} Welsh items and ${en.length} English.`);
          page.blocks.push({ type: 'list', items: { cy, en } });
        } else if (record.type === 'question') {
          const prompt = bilingual(record);
          const options = { cy: splitItems(record.options_cy), en: splitItems(record.options_en) };
          const answer = Number(record.answer);
          if (options.cy.length < 2 || options.en.length < 2) fail(record, "Mae angen o leiaf ddau ddewis yn y ddwy iaith.", 'A question needs at least two options in each language.');
          else if (options.cy.length !== options.en.length) fail(record, "Mae nifer y dewisiadau'n wahanol yn y ddwy iaith.", 'The number of options differs between the languages.');
          else if (record.answer === '' || !Number.isInteger(answer) || answer < 0 || answer >= options.cy.length) fail(record, "Dewiswch pa ateb sy'n gywir.", 'Choose which answer is correct.');
          page.blocks.push({ type: 'question', id: `q${questionCount++}`, prompt, options, answer });
        } else if (record.type === 'video') {
          const title = bilingual(record);
          const src = {};
          for (const lang of LANGS) {
            src[lang] = videoEmbed(record[`media_${lang}`]);
            if (!src[lang]) fail(record, `Mae angen dolen YouTube, Vimeo neu .mp4 ar gyfer y fideo ${LANG_NAME[lang].cy}.`, `The ${LANG_NAME[lang].en} video needs a YouTube, Vimeo or .mp4 link.`);
          }
          page.blocks.push({ type: 'video', title, src });
        } else {
          page.blocks.push({ type: record.type, text: bilingual(record) });
        }
        break;
      }
      default:
        fail(record, `Math anhysbys: "${record.type}".`, `Unknown type: "${record.type}".`);
    }
  }
  if (!course.title) fail(null, "Does dim teitl i'r cwrs.", 'The course has no title.');
  if (!course.pages.length) fail(null, 'Does dim tudalennau.', 'There are no pages.');
  if (!(course.mastery > 0 && course.mastery <= 100)) fail(null, "Rhaid i'r marc pasio fod rhwng 1 a 100.", 'The pass mark must be between 1 and 100.');
  return { course, errors };
}

export const formatError = (error, lang = 'en') =>
  (error.line ? `${lang === 'cy' ? 'rhes' : 'line'} ${error.line}: ` : '') + error[lang];

const xml = (value) => value.replace(/[<>&"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function scormManifest({ id, title, files }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${xml(id)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>${xml(title)}</title>
      <item identifier="item" identifierref="res">
        <title>${xml(title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files.map((file) => `      <file href="${xml(file)}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`;
}
