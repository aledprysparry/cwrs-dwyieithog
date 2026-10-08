import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, buildCourse, scormManifest, formatError, videoEmbed } from '../scripts/lib.mjs';

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
  assert.deepEqual(errors.map((e) => formatError(e)), ['line 3: The English text is missing.']);
  assert.equal(formatError(errors[0], 'cy'), "rhes 3: Mae'r testun Saesneg ar goll.");
});

test('mismatched lists and bad answers are refused', () => {
  const { errors } = buildCourse(parseCsv(header +
    'course,T,T,,,\npage,P,P,,,\nlist,a|b,a,,,\nquestion,C?,Q?,x|y,x|y,2\n'));
  assert.equal(errors.length, 2);
  assert.equal(formatError(errors[0]), 'line 4: There are 2 Welsh items and 1 English.');
  assert.equal(formatError(errors[1]), 'line 5: Choose which answer is correct.');
});

test('manifest declares SCORM 1.2, a single SCO and escapes the title', () => {
  const xml = scormManifest({ id: 'cwrs-x', title: 'Plymio & <Plastro>', files: ['index.html', 'course.js'] });
  assert.match(xml, /<schemaversion>1\.2<\/schemaversion>/);
  assert.match(xml, /adlcp:scormtype="sco" href="index\.html"/);
  assert.match(xml, /Plymio &#38; &#60;Plastro&#62;/);
  assert.match(xml, /<file href="course\.js"\/>/);
});

test('video links from the address bar become privacy-friendly embeds', () => {
  assert.equal(videoEmbed('https://www.youtube.com/watch?v=lcwWrLVu4yw').url, 'https://www.youtube-nocookie.com/embed/lcwWrLVu4yw?rel=0');
  assert.equal(videoEmbed('https://youtu.be/lcwWrLVu4yw?si=x').url, 'https://www.youtube-nocookie.com/embed/lcwWrLVu4yw?rel=0');
  assert.equal(videoEmbed('https://www.youtube.com/embed/lcwWrLVu4yw?si=C4a').url, 'https://www.youtube-nocookie.com/embed/lcwWrLVu4yw?rel=0');
  assert.equal(videoEmbed('https://vimeo.com/123456789').url, 'https://player.vimeo.com/video/123456789');
  assert.equal(videoEmbed('https://example.com/clip.mp4').kind, 'file');
  assert.equal(videoEmbed('http://youtube.com/watch?v=lcwWrLVu4yw'), null);
  assert.equal(videoEmbed('javascript:alert(1)'), null);
});

test('units group pages and videos need a link in each language', () => {
  const csv = 'type,cy,en,options_cy,options_en,answer,media_cy,media_en\n' +
    'course,T,T,,,,,\nunit,Uned 1,Unit 1,,,,,\npage,P,P,,,,,\nvideo,Fideo,Video,,,,https://youtu.be/lcwWrLVu4yw,\n';
  const { course, errors } = buildCourse(parseCsv(csv));
  assert.equal(course.pages[0].unit, 0);
  assert.deepEqual(errors.map((e) => formatError(e)), ['line 5: The English video needs a YouTube, Vimeo or .mp4 link.']);
});

test('the editor zip writer produces an archive unzip accepts', async () => {
  const { makeZip } = await import('../src/site/zip.js');
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'cwrs-zip-'));
  const file = join(dir, 'test.zip');
  writeFileSync(file, makeZip([{ name: 'imsmanifest.xml', data: '<manifest/>' }, { name: 'course.js', data: 'window.COURSE = { "t": "Dŵr" };' }]));
  const listing = execFileSync('unzip', ['-t', file]).toString();
  assert.match(listing, /No errors detected/);
  assert.equal(execFileSync('unzip', ['-p', file, 'course.js']).toString(), 'window.COURSE = { "t": "Dŵr" };');
});
