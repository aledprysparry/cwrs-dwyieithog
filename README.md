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

## The demonstration site

`npm run site` rebuilds and assembles `docs/`, which GitHub Pages serves on `main`
at https://aledprysparry.github.io/cwrs-dwyieithog/. Commit and push `docs/` to update it.

- `index.html`: landing page, bilingual, linking the three parts
- `cwrs/`: the course as a website
- `moodle.html`: the course beside a mock Moodle that shows, in plain words, what
  is recorded (status, score, language, page) and resumes after "close and reopen"
- `golygydd.html`: the editor. The spreadsheet as a form, Welsh and English side by
  side, live preview, errors per row, and a SCORM download built in the browser.
  It uses the same `lib.mjs` as the command-line build, so both refuse the same mistakes.

`npm run serve` serves `docs/` at http://localhost:4610/.

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
| unit | Unit title | Unit title | | | |
| heading | Subheading | Subheading | | | |
| video | Caption | Caption | | | |

A `unit` row groups the pages after it in the contents list. A `video` row takes its
links from the `media_cy` and `media_en` columns: YouTube (played from the no-cookie
domain), Vimeo, or an `.mp4`. The same link can serve both languages. A video in a
SCORM package plays only when the learner is online.

The build refuses a course with a missing translation, a list or question whose two
languages have a different number of items, or an answer that is not an option. Each
error names the spreadsheet line.

## Status

Prototype, 05.10.2026.

- The content is **demo text**. The Welsh is drafted and has not been reviewed by a
  Welsh editor. Register is `chi`, to be confirmed with the Coleg.
- Tested against the mock LMS only. **Not yet tested on SCORM Cloud or a real Moodle.**
- Not built yet: images, other question types, SCORM interactions (per-question
  reporting). The demo course has no video row because no video has been supplied.
