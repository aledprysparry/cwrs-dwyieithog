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

const splitItems = (value) => value.split('|').map((item) => item.trim()).filter(Boolean);

// Every string must exist in both languages: a missing translation fails the
// build rather than shipping a course that is half English.
export function buildCourse(records) {
  const errors = [];
  const course = { title: null, mastery: 100, pages: [] };
  let questionCount = 0;
  const fail = (record, message) => errors.push(`line ${record.line}: ${message}`);
  const bilingual = (record) => {
    for (const lang of LANGS) if (!record[lang]) fail(record, `"${record.type}" has no ${lang} text`);
    return { cy: record.cy, en: record.en };
  };

  for (const record of records) {
    const page = course.pages.at(-1);
    switch (record.type) {
      case 'course':
        course.title = bilingual(record);
        if (record.answer) course.mastery = Number(record.answer);
        break;
      case 'page':
        course.pages.push({ title: bilingual(record), blocks: [] });
        break;
      case 'text':
      case 'callout':
      case 'list':
      case 'question': {
        if (!page) { fail(record, `"${record.type}" appears before any page`); break; }
        if (record.type === 'list') {
          const cy = splitItems(record.cy);
          const en = splitItems(record.en);
          if (cy.length !== en.length) fail(record, `list has ${cy.length} Welsh items and ${en.length} English`);
          page.blocks.push({ type: 'list', items: { cy, en } });
        } else if (record.type === 'question') {
          const options = { cy: splitItems(record.options_cy), en: splitItems(record.options_en) };
          const answer = Number(record.answer);
          if (options.cy.length < 2) fail(record, 'question needs at least two options');
          if (options.cy.length !== options.en.length) fail(record, 'question has a different number of options in each language');
          if (!Number.isInteger(answer) || answer < 0 || answer >= options.cy.length) fail(record, `answer "${record.answer}" is not an option number (0 is the first)`);
          page.blocks.push({ type: 'question', id: `q${questionCount++}`, prompt: bilingual(record), options, answer });
        } else {
          page.blocks.push({ type: record.type, text: bilingual(record) });
        }
        break;
      }
      default:
        fail(record, `unknown type "${record.type}"`);
    }
  }
  if (!course.title) errors.push('no "course" row with the course title');
  if (!course.pages.length) errors.push('no pages');
  if (!(course.mastery > 0 && course.mastery <= 100)) errors.push('pass mark must be between 1 and 100');
  return { course, errors };
}

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
