import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, buildCourse, scormManifest } from '../scripts/lib.mjs';

const header = 'type,cy,en,options_cy,options_en,answer\n';

test('parses quoted fields with commas, quotes and newlines', () => {
  const rows = parseCsv(header + 'text,"Un, dau ""tri""","Line one\nline two",,,\n');
  assert.equal(rows[0].cy, 'Un, dau "tri"');
  assert.equal(rows[0].en, 'Line one\nline two');
  assert.equal(rows[0].line, 2);
});

test('the demo course builds with both languages aligned', () => {
  const { course, errors } = buildCourse(parseCsv(readFileSync(new URL('../content/plymio-demo.csv', import.meta.url), 'utf8')));
  assert.deepEqual(errors, []);
  assert.equal(course.pages.length, 4);
  for (const block of course.pages.flatMap((page) => page.blocks)) {
    if (block.type === 'list') assert.equal(block.items.cy.length, block.items.en.length);
    if (block.type === 'question') assert.equal(block.options.cy.length, block.options.en.length);
  }
});

test('a missing translation fails the build and names the line', () => {
  const { errors } = buildCourse(parseCsv(header + 'course,Teitl,Title,,,\npage,Tudalen,,,,\n'));
  assert.deepEqual(errors, ['line 3: "page" has no en text']);
});

test('mismatched lists and bad answers are refused', () => {
  const { errors } = buildCourse(parseCsv(header +
    'course,T,T,,,\npage,P,P,,,\nlist,a|b,a,,,\nquestion,C?,Q?,x|y,x|y,2\n'));
  assert.equal(errors.length, 2);
  assert.match(errors[0], /line 4: list has 2 Welsh items and 1 English/);
  assert.match(errors[1], /line 5: answer "2" is not an option number/);
});

test('manifest declares SCORM 1.2, a single SCO and escapes the title', () => {
  const xml = scormManifest({ id: 'cwrs-x', title: 'Plymio & <Plastro>', files: ['index.html', 'course.js'] });
  assert.match(xml, /<schemaversion>1\.2<\/schemaversion>/);
  assert.match(xml, /adlcp:scormtype="sco" href="index\.html"/);
  assert.match(xml, /Plymio &#38; &#60;Plastro&#62;/);
  assert.match(xml, /<file href="course\.js"\/>/);
});
