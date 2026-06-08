# AI auto-fill — demo evidence files

These are the sample documents for the **AI auto-fill** demo. They belong to one
fictional candidate, **Alex Carter**, and line up with the questions seeded by
the AI demo seeder (`/admin/seed` → **Seed AI demo**).

## The three files

| File | Maps to template file variable | Drives questions |
|---|---|---|
| `id-document.md` | `id-document` | Full name · Date of birth · ID document type |
| `academic-transcript.md` | `academic-transcript` | Holds a bachelor's degree? · Field of study · Graduation date |
| `candidate-resume.md` | `candidate-resume` | Years of professional experience · Most recent job title · Latest role start date |

## How to use them

The extraction flow runs Azure Document Intelligence, which reads **PDFs and
images** best. These sources are Markdown so they're easy to read and tweak —
convert each to PDF before uploading:

1. Open a file (e.g. in VS Code or a browser).
2. **Print → Save as PDF** (or any md-to-PDF tool).
3. Name the PDF so it's recognisable, e.g. `id-document.pdf`,
   `academic-transcript.pdf`, `candidate-resume.pdf`. The exact name doesn't have
   to match the variable — you map it by hand in the dialog — but a matching name
   gets auto-selected by the dialog's best-guess.

If your extraction flow already accepts `.txt`/`.md` (some configurations do),
you can skip the PDF step and upload the source files directly.

## In the demo

1. Open the seeded assessment **AI Demo — Alex Carter**.
2. In **Evidence files**, upload all three PDFs.
3. Click **AI auto-fill** → map `id-document` → your ID PDF, `academic-transcript`
   → the transcript PDF, `candidate-resume` → the resume PDF.
4. Tick the questions to run → **Run** → review the confidence-scored proposals →
   **Accept all**.

The expected answers (so you can sanity-check the AI):

- **Full name:** Alex Carter
- **Date of birth:** 1996-02-14
- **ID document type:** Passport
- **Holds a bachelor's degree?:** Yes
- **Field of study:** Computer Science
- **Graduation date:** 2018-06-15
- **Years of professional experience:** 5+ years
- **Most recent job title:** Senior Software Engineer
- **Latest role start date:** 2022-03-01
