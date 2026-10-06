# Cwrs dwyieithog

Prototype bilingual course player. One spreadsheet in, two outputs:

- **A SCORM 1.2 package** for Moodle, with a Cymraeg / English button that switches
  language on the page the learner is reading. Progress, language and quiz answers
  are saved to the LMS, so the learner resumes where they left off.
- **A plain website** from the same files. With no LMS present, progress is kept in
  the browser instead.

No Storyline, no Rise, no runtime dependencies.

## Run it

```bash
npm run build     # content/plymio-demo.csv to dist/
npm test          # parser, bilingual guard, manifest
npm run serve     # http://localhost:4610/plymio-demo/test-lms.html
```

`dist/plymio-demo-scorm12.zip` is the file to upload to Moodle (Add an activity, SCORM package).
`test-lms.html` is a mock LMS that logs every SCORM call and keeps the learner's data
between launches, for testing resume without Moodle.

## Publishing the demo

`npm run site` rebuilds and copies the web version and the SCORM zip into `docs/`.
GitHub Pages serves `docs/` on `main` at https://aledprysparry.github.io/cwrs-dwyieithog/
(the zip is at `plymio-demo-scorm12.zip` under the same address). Commit and push
`docs/` to update it.

## Writing a course

One CSV per course in `content/`, editable in Excel or Google Sheets. One row per block:

| type | cy | en | options_cy | options_en | answer |
|---|---|---|---|---|---|
| course | Course title | Course title | | | pass mark % |
| page | Page heading | Page heading | | | |
| text | Paragraph | Paragraph | | | |
| callout | Highlighted note | Highlighted note | | | |
| list | item one\|item two | item one\|item two | | | |
| question | Question | Question | a\|b\|c | a\|b\|c | correct option, 0 = first |

The build refuses a course with a missing translation, a list or question whose two
languages have a different number of items, or an answer that is not an option. Each
error names the spreadsheet line.

## Status

Prototype, 05.10.2026.

- The content is **demo text**. The Welsh is drafted and has not been reviewed by a
  Welsh editor. Register is `chi`, to be confirmed with the Coleg.
- Tested against the mock LMS only. **Not yet tested on SCORM Cloud or a real Moodle.**
- Not built yet: images, video, other question types, SCORM interactions
  (per-question reporting), an editor in the browser.
