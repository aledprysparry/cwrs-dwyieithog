// Copies the built web version and the SCORM zip into docs/, which GitHub Pages
// serves. Run after `npm run build`.
import { cpSync, rmSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2] ?? 'plymio-demo';
const docs = join(root, 'docs');
rmSync(docs, { recursive: true, force: true });
mkdirSync(docs);
cpSync(join(root, 'dist', slug, 'web'), docs, { recursive: true });
copyFileSync(join(root, 'dist', `${slug}-scorm12.zip`), join(docs, `${slug}-scorm12.zip`));
writeFileSync(join(docs, '.nojekyll'), '');
console.log(`docs/ ready: index.html (the course) and ${slug}-scorm12.zip`);
