// Assembles docs/, which GitHub Pages serves:
//   index.html      the demonstration's landing page
//   cwrs/           the course as a website (also framed by the two pages below)
//   moodle.html     the course beside a mock Moodle that shows what is recorded
//   golygydd.html   the editor, which builds with the same lib.mjs as this script
// Run after `npm run build`.
import { cpSync, rmSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2] ?? 'plymio-demo';
const docs = join(root, 'docs');
rmSync(docs, { recursive: true, force: true });
mkdirSync(docs);
cpSync(join(root, 'src', 'site'), docs, { recursive: true });
cpSync(join(root, 'dist', slug, 'web'), join(docs, 'cwrs'), { recursive: true });
copyFileSync(join(root, 'scripts', 'lib.mjs'), join(docs, 'lib.mjs'));
copyFileSync(join(root, 'content', `${slug}.csv`), join(docs, `${slug}.csv`));
copyFileSync(join(root, 'dist', `${slug}-scorm12.zip`), join(docs, `${slug}-scorm12.zip`));
writeFileSync(join(docs, '.nojekyll'), '');
console.log('docs/ ready: index.html, cwrs/, moodle.html, golygydd.html, csv and zip');
