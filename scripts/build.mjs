// Usage: node scripts/build.mjs [content/<course>.csv]
// Writes dist/<slug>/web (plain website), dist/<slug>/scorm (SCORM 1.2 folder)
// and dist/<slug>-scorm12.zip (the file you upload to Moodle).
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv, buildCourse, scormManifest, formatError } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2] ?? join(root, 'content/plymio-demo.csv');
const slug = basename(input, '.csv');

const { course, errors } = buildCourse(parseCsv(readFileSync(input, 'utf8')));
if (errors.length) {
  console.error(`${input} has ${errors.length} problem(s):\n  ${errors.map((e) => formatError(e)).join('\n  ')}`);
  process.exit(1);
}

const runtime = ['index.html', 'player.js', 'scorm.js', 'style.css'];
const courseJs = `window.COURSE = ${JSON.stringify(course, null, 2)};\n`;
const out = join(root, 'dist', slug);
rmSync(out, { recursive: true, force: true });

for (const target of ['web', 'scorm']) {
  const dir = join(out, target);
  mkdirSync(dir, { recursive: true });
  for (const file of runtime) copyFileSync(join(root, 'src', file), join(dir, file));
  writeFileSync(join(dir, 'course.js'), courseJs);
}

const files = [...runtime, 'course.js'];
writeFileSync(join(out, 'scorm', 'imsmanifest.xml'), scormManifest({
  id: `cwrs-${slug}`,
  title: `${course.title.cy} / ${course.title.en}`,
  files,
}));
copyFileSync(join(root, 'src', 'test-lms.html'), join(out, 'test-lms.html'));

const zip = join(root, 'dist', `${slug}-scorm12.zip`);
if (existsSync(zip)) rmSync(zip);
// The manifest must sit at the root of the zip, so zip from inside the folder.
execFileSync('zip', ['-q', '-X', '-r', zip, '.'], { cwd: join(out, 'scorm') });

const questions = course.pages.flatMap((page) => page.blocks).filter((block) => block.type === 'question').length;
console.log(`Built "${course.title.en}": ${course.pages.length} pages, ${questions} questions, pass mark ${course.mastery}%`);
console.log(`  web:   dist/${slug}/web/index.html`);
console.log(`  scorm: dist/${slug}-scorm12.zip`);
console.log(`  test:  dist/${slug}/test-lms.html (mock LMS that logs every SCORM call)`);
