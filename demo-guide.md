# Demo walkthrough

A click-by-click script for showcasing IntelliAssessment V1 end-to-end. Designed for a 10–15 minute live demo or for screenshots.

---

## Setup (one-time)

1. Start the app: `npm run dev` (or open the Code App from inside the Model-Driven host).
2. Navigate to **`/admin/seed`** in the address bar.
3. Click **Run seed**. Wait for every step to turn green (~10–20 seconds).
4. The page surfaces direct links to the demo project, template, and three assessments — keep them handy.

If you re-run the seed, you'll get a second copy of everything. Clean up in the Power Apps maker portal if it gets cluttered.

---

## What got created

| Entity | Name | Notes |
|---|---|---|
| **Project** | RPL — Carpentry Cert III (Demo) | One Active project |
| **Template** | Carpentry Certificate III RPL — 2026 (Demo) | Two sections, two subsections, ten questions |
| **Rules** | At every cascade tier | Question-level Boolean, subsection Weighted threshold, subsection Grouped, section Every-child, assessment-root Every-section |
| **Assessment 1** | Demo — Jane Doe (Draft) | Empty checklist — good for showing the editing experience from scratch |
| **Assessment 2** | Demo — Maria Garcia (In progress) | Partially filled with one reviewer flag — good for showing live outcome chips + flag flow + Submit dialog |
| **Assessment 3** | Demo — John Smith (Complete · Suitable) | Approved with reviewer notes — good for the outcome letter, version history, and read-only state |

---

## Demo flow

### 1. Dashboard (1 min)

Open `/dashboard`. Talk through:

- **Four tiles**: Total / In progress / Pending review / Completed this month.
- **Outcome breakdown** card: Suitable / Not suitable / Pending bars with percent.
- **Recent assessments** table: status pill + outcome pill on each row.
- Click any row → opens the instance.

Talking point: *"All of this is derived from a single Dataverse query — no separate aggregation tables."*

### 2. Template authoring — Structure tab (2 min)

Open the demo template (`/templates/<id>/edit`). On the **Structure** tab:

- Section / Subsection / Question hierarchy.
- Drag the 6-dots grip handle to reorder (try moving a question).
- Open a question via the kebab → Edit. Show the Visibility + Evaluation panels.
- Show **Duplicate** on a Subsection — deep-copies the whole subtree.

### 3. Template authoring — Scoring tab (2 min)

Switch to the **Scoring & evaluation** tab. This is the most demo-worthy view:

- Colour-coded matrix: Section (purple) · Subsection (blue) · Question (teal) · Assessment outcome (amber).
- Top row **Assessment · Overall outcome** — expand it, show "Every section must pass".
- Click into **Prior qualifications** subsection — show "At least 50% must pass" + per-question Importance (the Cert II question has the amber `×2` badge).
- Click into **Work experience** subsection — show "By groups (1)". Expand it, show the "Verification" group requiring 1 of 2 from {supervisor reference, portfolio}.
- Hover any rule chip → plain-English summary.

Talking point: *"Every rule lives on one Dataverse row. The hierarchy + cascade are computed at render time by a pure TypeScript evaluator."*

### 4. Live assessment — In progress (3 min)

Open **Demo — Maria Garcia (In progress)**.

Hero:
- Status pill (In progress) + version + autosave badge + live outcome chip (currently **Not suitable (preview)** because answers don't satisfy all rules yet) + Comments / History / View letter / Submit buttons.

Checklist:
- Section header chips show **Suitable** / **Not suitable** roll-ups. Hover for math.
- Subsection chip shows the threshold result.
- Each answered question has its own chip + tooltip.
- The **Years of carpentry experience** question is unanswered AND has an amber **Reviewer flag** card under it (with a green Mark resolved button).
- Click **Next flag** at the top banner — scrolls to that question.

Now act as the assessor:
- Pick `5+ years` from the dropdown. Watch chips cascade green up the hierarchy in real-time.
- Watch the hero chip flip from **Not suitable (preview)** to **Suitable (preview)**.

Talking point: *"Outcomes are computed bottom-up. Question → subsection → section → assessment, all live."*

### 5. Submit + persisted outcome (1 min)

Click **Submit for review** in the hero:
- The dialog computes the overall outcome client-side and shows it as a preview block ("Suitable" chip with the explanation).
- If anything required is unanswered, you'll see a list of blockers.
- Submit. Status flips to **Pending review**, lock banner appears, the outcome is now persisted in `dnx_outcome`.
- Hero chip drops the "(preview)" suffix.

### 6. Reviewer flow — Approve + Reject (2 min)

From a fresh PendingReview instance (re-seed if needed), reviewer actions show in the hero:

- **Approve** → green dialog, outcome radio, optional notes. **Blocks if any reviewer flag is unresolved** — shows an amber warning.
- **Reject** → amber dialog. Required notes. Optional **Tag specific questions** picker with per-flag notes. Each tagged question becomes a `dnx_reviewer_comments` row.

### 7. Comments + question tagging (2 min)

Click **Comments** in the hero on any instance — opens a right drawer.

- Threads + replies (one-deep).
- Composer: type a comment, click `+ Tag a question`, pick a question from the search box, post.
- The posted comment shows a clickable purple chip referencing the question.
- Click the chip → drawer closes, the question row scrolls into view (Section / Subsection auto-expand if collapsed).

### 8. Version history + diff (2 min)

Click **History** in the hero.

- Filter chips at top (Autosave / Submitted / Reopened / Approved / Rejected) — multi-select toggles.
- Each row: version number, reason chip, author, time, **Compare** and **JSON** buttons.
- Click **JSON** → downloads the full snapshot as a `.json` file.
- Click **Compare** on an older snapshot → opens a side-by-side diff dialog with:
  - Summary counts (Changed / Added since / Removed since / Unchanged)
  - Instance metadata diffs (Status, Outcome, Notes, etc.)
  - Per-question diffs with breadcrumb paths

### 9. Outcome letter + PDF (1 min)

Open the **Complete · Suitable** demo assessment. Click **View letter** in the hero.

- Letter renders with candidate, project, template, outcome block (green Suitable), reviewer notes panel, and per-section responses (only questions flagged `include_in_letter` show up).
- Click **Download PDF** → instant `.pdf` download via `html2canvas` + `jsPDF`. No print dialog.

---

## Feature checklist

Use this if you only have time for one screen each:

- [ ] Dashboard tiles + outcome breakdown
- [ ] Template Structure tab — drag-reorder + duplicate
- [ ] Template Scoring tab — colour-coded matrix + Assessment outcome rule + Groups
- [ ] Assessment hero — autosave / version / live outcome chip / Comments + History + View letter buttons
- [ ] Live cascade — answer a question, watch chips roll up
- [ ] Submit dialog — outcome preview + required-field blocker
- [ ] Reviewer Approve guard — block on unresolved flag
- [ ] Reviewer Reject — per-question flags
- [ ] Inline reviewer flag — Next flag jumper + Mark resolved
- [ ] Comments drawer — threads + question tagging + scroll-to-question
- [ ] Version history drawer — filter by reason + Compare diff + JSON download
- [ ] Outcome letter — one-click PDF download

---

## Cleanup

To remove demo data after the demo:

1. Open the Power Apps maker portal → Dataverse → Tables.
2. In `dnx_assessment_responses`, delete rows where `dnx_Assessment` ∈ the three demo instance IDs.
3. In `dnx_reviewer_comments`, do the same.
4. In `dnx_assessment_versions`, same again (the file column auto-cleans).
5. In `dnx_evaluationcriteria`, delete rows linked to the demo template's levels.
6. Delete the demo levels from `dnx_assessment_levels`.
7. Delete the demo template + project.

Or re-seed twice and only delete the *original* demo project + cascade — Dataverse will refuse if there are dangling lookups, prompting you to remove children first.
