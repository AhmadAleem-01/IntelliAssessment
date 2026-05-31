# IntelliAssessment V1 — Project Context

> Read this first when returning to the project. Last updated: 2026-05-31 (M8c.3 version history + diff dialog + tag-jump auto-expand shipped — M8 functionally complete for current scope).

## What this is

A Power Apps **Code App** (React + TypeScript) embedded in a Model-Driven App, backed by Microsoft Dataverse. The product is a configurable, multi-level **Assessment Module** — assessors run structured checklists against reusable templates, capture evidence, auto-evaluate outcomes, and generate outcome letters.

The detailed product spec lives in two places:
- **PRD** — the original PDF the user attached on 2026-05-23 (also summarised in the personal plan file outside the repo).
- **`design.md`** at the repo root — the UI design specification we're now matching. Flat aesthetic, 0.5 px borders, no shadows, no gradients, purple (`#7F77DD`) brand.

## Where we are right now

| Milestone | Status | Notes |
|---|---|---|
| **M0** Environment & foundations | ✅ done (by user) | Dataverse env provisioned, schemas synced to `.power/schemas/dataverse/` |
| **M1** Dataverse schema | ✅ done (by user) | All 10 entities present; generated TS services in `src/generated/` |
| **M2** App shell, auth, routing | ✅ done | Custom purple theme, 52 px sticky topbar, flat surfaces per `design.md` |
| **M3a** Template tree editor — CRUD | ✅ done | Section / Subsection / Question authoring with inline custom option sets + tooltips + deep-copy duplicate (any node + descendants) |
| **M3b** Drag-reorder | ✅ done | `@dnd-kit/core` + `@dnd-kit/sortable` integration; same-bucket reorder with optimistic cache + rollback |
| **M3c** Conditional visibility editor | ✅ done | Author-time rule editor; `dnx_visibility_condition` text column on `dnx_assessment_levels`; runtime evaluator pending in M4 |
| **M4a** Assessment instance CRUD | ✅ done | Start-assessment dialog (picks published template + due date); per-project + global lists; instance shell page with metadata hero |
| **M4b** Checklist runtime | ✅ done | Recursive per-data-type field renderer, response upsert (create-or-update), conditional visibility hiding, autosave indicator, text-field debounce, smooth reveal animation |
| **M4c.1** Version bump + submit/reopen workflow | ✅ done | Per-save `dnx_version` increment, Submit-for-review with required-field validation, lock + Reopen workflow when status ≥ PendingReview |
| **M4c.2** Per-save audit snapshots | ✅ done | JSON snapshot of (instance + all responses) lands in `dnx_assessment_versions.dnx_snapsho_tjson` (File column) on every save, submit, and reopen. Fire-and-forget so it never blocks the assessor's save. |
| **M4d** Reviewer Approve / Reject + per-level flags | ✅ done | Approve dialog (outcome + notes) and Reject dialog (overall notes + optional per-question flags with their own notes) on PendingReview instances. Flags persist as `dnx_reviewer_comments` rows linked to the level. Assessor sees an amber banner with a cycling "Next flag / X of N" jumper and an inline amber-tinted card under each flagged question with a green "Mark resolved" button. |
| **M5** Evidence files + SharePoint | not started | Upload, link, and surface evidence files alongside each assessment. Needs a Power Automate flow + SharePoint connector. |
| **M6** AI pipeline (OCR + extraction) | not started | Auto-populate answers from uploaded evidence using Azure AI Document Intelligence. Builds on M5. |
| **M7a** Question-level pass/fail rules | ✅ done | Author a single Boolean-scoring rule per Question from the level edit dialog (`When the answer <op> <value>`, outcome-if-pass / outcome-if-fail). Pure TypeScript evaluator in `src/features/rules/engine.ts`. Runtime renders a green "Met / Suitable / Pass" or red "Not met / Not suitable / Fail" chip beside each answered question. Foundation for the M7b cascade. |
| **M7b** Rule cascade (Subsection / Section / Assessment) | ✅ done | Sub/Section/Assessment roll-up with "Every child must pass" or "At least X% must pass". Per-Question Importance multiplier. Dedicated **Scoring & evaluation** tab on the template editor with a color-coded matrix (purple/blue/teal by level type). Live outcome chips on section/subsection headers + overall banner; hover tooltips explain the math in plain English. Outcomes collapsed to a single Suitable / Not suitable pair. Persisting onto the instance is deferred to M7c (today only the reviewer Approve dialog writes `dnx_outcome`). Grouped scoring is still TODO. |
| **M7c** Persistence + hero chip + assessment-level rules + Approve guards | ✅ done | Submit / Reopen write `dnx_outcome` (computed via `evaluateAssessment` at submission time, Pending on reopen). New `HeroOutcomeChip` on the AssessmentPage hero — live preview during Draft/InProgress, persisted value when locked. Submit dialog previews the outcome with explanation. Approve dialog blocks until every reviewer flag is resolved + always overwrites `dnx_outcome_notes` so stale reject text can't leak into the green "Approved — suitable" banner. **Assessment outcome is now author-able**: a hidden Root level (`dnx_assessment_level_type = 0`) is auto-created per template via `useEnsureRootLevel` and carries its own criteria — the Scoring matrix gets a top "Assessment / Overall outcome" row with an amber accent that runs through the same `CriteriaEditor`. `findRootCriteria(levels, criteriaByLevelId)` feeds it to the runtime evaluator. |
| **M7d** Grouped scoring | ✅ done | Third parent scoring mode **"By groups (N of M)"** — define named groups of descendant questions where at least `minToPass` members must pass for the group to count as 1 vote. Ungrouped children still must pass individually. Groups persist as JSON in `dnx_target_value` (the dedicated `dnx_scoring_groups` table is left empty — see gotcha R). Engine's `aggregateGrouped` produces a per-group breakdown tooltip. |
| **M8a** Outcome letter preview + PDF download | ✅ done | `LetterPreview` + `LetterDialog` under `src/features/letter/`. Fixed-layout HTML letter (candidate / project / template / outcome / reviewer notes / per-section included responses). One-click PDF via `html2canvas` + `jspdf` — rasterises the rendered DOM, paginates across A4, downloads as `outcome-letter-<name>.pdf`. "View letter" button always visible in the AssessmentPage hero. |
| **M8b** Custom letter builder + reason-grouped qualifications | not started | **Future work, deferred until explicitly requested.** Two pieces: (1) author-controlled letter layout — pick what fields/sections appear where, persisted on the template (likely JSON column or new related table); (2) reason-grouped qualifications — when a subsection's outcome is Not suitable, attach an authored "reason"; letter renderer groups subsections sharing the same reason instead of listing them flatly. Multiple qualifications can share a reason. Need to scope the reason model (free-text vs picklist vs both) with the user before building. |
| **M8c.1** Dashboard with real counts | ✅ done | DashboardPage now derives every tile + outcome breakdown + assessor workload + recent-assessments table from a single `useAssessmentInstances()` query. Status pills + outcome pills on each recent row, click-through to instance. |
| **M8c.2** Threaded comments + question tagging | ✅ done | General comments (no level lookup) live in a Fluent `OverlayDrawer` triggered from a hero "Comments (N)" button — discoverable, doesn't consume page real estate. Threads + one-deep replies. Composer has a subtle `+ Tag a question` affordance that swaps in a search-as-you-type Combobox; selecting a question shows a removable purple chip. Tags persist as a `[Q:<levelId>\|<name>]` token at the start of `dnx_comment_text` (schema unchanged — see gotcha S). On display, the token renders as a clickable chip that closes the drawer and smooth-scrolls the question row into view (each row gets `id="level-<id>"`). Author falls back through ownerid → createdby → signed-in user (`useCurrentUser` via `app.getContext()`) → "You". |
| **M8c.3** Version history drawer + diff preview | ✅ done | Right-side drawer over `dnx_assessment_versions` snapshots. Each row: version number, colour-coded reason chip (Autosave / Submitted / Reopened / Approved / Rejected), author, timestamp, **Compare** and **JSON download** buttons. Compare opens a `SnapshotDiffDialog` showing instance metadata + per-question responses side-by-side (snapshot left, current right) with Changed / Added / Removed categorisation and a summary count. Filter by reason in the drawer header. |
| **M8c.4** Revert to a previous version | deferred (future TODO) | Add a "Revert to this version" button at the bottom of `SnapshotDiffDialog`. Should restore instance metadata + every response value to match the snapshot, bump version, and write a fresh 'Reverted' snapshot for audit. Needs a destructive-action confirmation dialog and careful handling of responses present today but absent in the snapshot (delete? archive?). Held until the diff view sees real use. |
| **M9** NFRs, QA, deployment | not started | |

## Currently working features

- **Projects** — full CRUD (list, detail, create, edit, delete) wired to `Dnx_projectsService`. Flat cards with status pills (Active / On Hold / Archived / Inactive).
- **Templates** — full CRUD on top-level template records (`Dnx_assessment_templatesService`). Lifecycle status (Draft / Published / Deprecated), **Publish** action that bumps version + stamps `dnx_published_on` (uses `Edm.Date` format, see gotcha B).
- **Template tree editor** — Section → Subsection → Question authoring under each template via `Dnx_assessment_levelsService`. Contextual add menus respect the allowed-children rules. Question fields support all 5 data types (Boolean / Option set single / Option set multi / Text / Date) with inline custom option sets stored as JSON in `dnx_option_set_reference`. Required flag + Include-in-letter flag (purple dot in tree) + hint text + document-type reference. Cascade-delete walks the subtree depth-first.
- **Drag-reorder + duplicate** — Drag the 6-dots grip handle on any tree row to reorder. **Cross-parent moves now supported** (Question between Sections, Subsection between Sections) — `useMoveLevel` re-binds the `dnx_Parent_Assessment_Level` lookup + bumps trailing siblings; drops between mismatched level types are silently rejected. Each row's kebab menu also exposes **Duplicate**, which deep-copies the subtree in parallel within each level and **inserts the copy immediately after the source** (trailing siblings shifted up by 1). Reorders write only the rows whose order actually changed; cache updates optimistically with rollback on failure. Every icon button has a Fluent tooltip.
- **Conditional visibility (authoring + runtime)** — Each Question's edit dialog has a *Visibility* section. Toggle "Conditional visibility" on, pick a source Question (Boolean / OptionSet / Multiselect), pick an operator (`equals`/`not equals` for single-value sources, `includes`/`does not include` for Multiselect), pick a value from the source's option list. The rule JSON is stored in `dnx_visibility_condition`. **At runtime** the checklist evaluates each rule against the current responses and hides non-matching questions with a smooth `max-height + opacity + translateY` reveal transition (CSS classes `reveal-show` / `reveal-hide` in `index.css`). Multiselect parents follow contains-semantics per the contract in `visibility.ts`. The source-question dropdown is grouped by parent path (`Section › Subsection`) so duplicate names are disambiguated.
- **Assessment instance CRUD** — *Start assessment* button on each project's detail page opens a dialog that lets the user pick a Published template (Draft/Deprecated templates filtered out) and optionally set a due date. Name pre-fills to `<project> — <today>`. Both `dnx_Project` and `dnx_AssessmentTemplate` lookups bound via `@odata.bind`. The project detail page shows all instances under that project; the global `/assessments` page lists every instance across all projects with status pills (Draft / In progress / Pending review / Complete).
- **Assessment runtime (M4b)** — Open any assessment instance and you get a fillable checklist of the template's level tree. Each Section is a collapsible card with a *N / M answered* summary. **Subsections render as their own bordered blocks with a tinted header bar** (purple bullet + `SUBSECTION` label + title + own `N/M` counter), and the subsection header is also clickable to collapse / expand — keyboard accessible via Enter/Space on the header, same chevron pattern as Sections. Questions render with their label, required asterisk, purple letter-flag dot, and per-data-type input (Boolean Yes/No toggle • OptionSet single dropdown • Multiselect checkbox group • multi-line Text textarea • native Date picker). Every change upserts a row in `dnx_assessment_responses` keyed by (instance, level); the matching `dnx_response_*` column is written and the other four are explicitly blanked. Text fields **debounce at 800 ms** so we get one write per pause; Boolean/OptionSet/Multi/Date fire immediately. A small **autosave indicator** in the hero meta row cycles through *Autosave on* → *Saving...* (purple pulse) → *Saved at HH:MM* (green check) → *Save failed — retry* (red error).
- **Submit / Reopen workflow (M4c.1)** — Every successful response save bumps `dnx_assessment_instances.dnx_version` and the `v{n}` chip in the hero refreshes optimistically. The hero exposes a **Submit for review** button (Draft / InProgress states only) that opens a confirmation dialog. The dialog calls `validateSubmission()` — walks the level tree and surfaces a scrollable list of required visible questions that are still unanswered, blocking submit until they're all answered. Submit flips `statuscode` to PendingReview (778540003), stamps today's date into `dnx_submittedon`, bumps version. Once submitted, the checklist becomes read-only: a lock banner appears at the top with a **Reopen for edits** button (PendingReview) or a finalised message (Complete). Reopen flips `statuscode` back to InProgress (778540002), bumps version, and unlocks every input. `dnx_submittedon` is deliberately retained across reopen cycles as the historical fact of submission.
- **Per-save audit snapshots (M4c.2)** — Every save, submit, and reopen also writes a `dnx_assessment_versions` row with a JSON snapshot of the full instance state (metadata + every response value) attached to its `dnx_snapsho_tjson` File column. The snapshot includes `capturedAt`, `reason` (`Autosave` / `Submitted` / `Reopened`), the instance fields, and a flat array of `{ levelId, questionName, boolean, option, multi, text, date }`. Calls are fire-and-forget — a snapshot failure logs to console but never blocks the assessor's save. Read by reviewers via the maker portal until a reviewer-side history UI is built. See gotcha O for the two-call File-column write pattern this uses.
- **Dashboard + threaded comments + question tagging (M8c.1 + M8c.2)** — Dashboard derives everything from a single `useAssessmentInstances()` query: four tiles (Total · In progress · Pending review · Completed this month), an outcome-breakdown card (Suitable / Not suitable / Pending bars with counts and percent; denom excludes editing states), an assessor workload list (top 6 by owner), and a Recent assessments table (8 most recent, click-through to instance). Status pills + outcome pills on each row. **Comments** live in a Fluent `OverlayDrawer` triggered from the hero button "Comments (N)" — count is derived live from the same `dnx_reviewer_comments` query the per-question flags use, filtered to rows without a level lookup. Threads are one-deep replies; each comment surfaces author (resolved through ownerid → createdby → signed-in user via `useCurrentUser` (`app.getContext()`) → "You") + created time. Composer has a subtle `+ Tag a question` affordance that swaps in a search-as-you-type `Combobox` grouped by section breadcrumb. Selecting a question shows a removable purple chip; on post the tag is serialised as `[Q:<levelId>|<name>]` at the start of `dnx_comment_text` (parser + serializer in `commentTags.ts`, schema unchanged — see gotcha S). On display the token renders as a clickable purple link-chip; click closes the drawer and smooth-scrolls the question into view via `id="level-<id>"` anchors on each `QuestionItem`. The drawer composer also handles errors, optimistic pending states, and resets the tag on submit / cancel.
- **Grouped scoring (M7d)** — A third option in the parent scoring-mode dropdown alongside "Every child must pass" and "At least X% must pass": **"By groups (N of M)"**. Selecting it reveals a `GroupListEditor` underneath where the author defines named groups of descendant Questions. Each group has a name, a `minToPass` integer, and a checkbox list of every descendant question (with breadcrumb path for disambiguation). Groups serialise as JSON into the parent criteria's `dnx_target_value` field (unused by parents in the other modes); reused on load via `parseGroups`. Engine's `aggregateGrouped` evaluates each group independently (group passes when `passedCount >= minToPass`), then the parent passes when **every group passes AND every ungrouped child also passes** — so leftover answers can't be silently ignored. Tooltips read like *"Identity 1/2 ≥ 1 ✓ · Quals 2/3 ≥ 2 ✓. Ungrouped failed: Q5."* Edge cases: `minToPass > memberCount` shows an inline amber warning ("can never pass"); Grouped selected with zero groups produces a "bad-config" not-evaluable outcome rather than silently passing. The Scoring matrix chip reads `By groups (3)`. See gotcha R for why the dedicated `dnx_scoring_groups` table stays unused.
- **Outcome persistence + hero chip + author-able assessment outcome + Approve guards (M7c)** — Submit / Reopen / Approve all now keep the persisted `dnx_outcome` honest. `useSubmitForReview` accepts `{ outcome }` and `SubmitAssessmentDialog` computes the verdict client-side via `evaluateAssessment` before posting — assessor sees a preview chip + the plain-English explanation in the dialog body before confirming. `useReopenAssessment` resets `dnx_outcome` back to Pending (2) since pulling the work back invalidates the submitted verdict. `useApproveAssessment` (a) refuses to fire while any `dnx_reviewer_comments` row has `dnx_is_resolved = false` (dialog shows an amber "Unresolved reviewer flags" warning + disables the green button), and (b) always writes `dnx_outcome_notes` as a string (empty string if none) so the previous Reject → Reopen → Approve cycle can't leave stale reject text behind the green "Approved — suitable" banner. The AssessmentPage hero gets a new `HeroOutcomeChip` next to the save badge — shows the **live preview** ("Suitable (preview)" / "Not suitable (preview)") while editable, switches to the plain persisted value once locked, hides itself when there's no signal. **Author-able assessment outcome**: a hidden Root-typed level (`dnx_assessment_level_type = 0`) is auto-created per template via `useEnsureRootLevel` (idempotent — checks first, creates only if missing). The Scoring tab gets a top "Assessment · Overall outcome" row with an amber accent + Trophy icon that runs the same `CriteriaEditor` against the Root. `findRootCriteria(levels, criteriaByLevelId)` is the helper every runtime caller uses to pluck this rule; `evaluateAssessment` now takes an optional `rootCriteria` and falls back to "every section must pass" when absent so legacy templates behave unchanged. See gotcha Q.
- **Rule cascade + Scoring tab (M7b)** — The template editor has a new tab switcher: **Structure** (existing tree editor) and **Scoring & evaluation** (a flat indented matrix where every level shows its rule as a colour-coded chip). Per type: Section = purple, Subsection = blue, Question = teal. Click any row to expand the `CriteriaEditor` inline. Questions with non-default Importance show an amber `×N` badge next to the rule chip. Parent rules use one of two modes: **Every child must pass** (strict) or **At least X% must pass** (threshold, default 50). The pure evaluator (`evaluateNode` / `evaluateAssessment` in `src/features/rules/engine.ts`) cascades bottom-up: question outcomes feed subsection rules, which feed section rules, which feed the assessment-level verdict (any failing section fails the whole assessment). At runtime the checklist shows outcome chips on each section and subsection header plus an **Overall outcome** banner above the sections. Hover any chip for a Fluent tooltip explaining the math: *"Answer 'Yes' satisfies rule 'Is true (Yes)'."* on questions, *"3 of 5 weighted points passed (60%) — needed 50%. Failed: Q3."* on parents, *"All 3 sections suitable."* on the overall. Outcomes are collapsed to a single **Suitable / Not suitable** pair everywhere (legacy Met/Pass/Fail values still render consistently). The full mental model is documented in `README.md`. See gotcha P for the schema's `weight` column wiring.
- **Question-level pass/fail rules (M7a)** — Each Question's edit dialog has a new **Evaluation** section with a *Pass / fail rule* toggle. Switch it on and pick an operator (the dropdown filters to what the question's data type supports — `IsTrue/IsFalse` for Boolean, `Equals` for OptionSet, `Contains` for Multiselect, `Equals/Contains` for Text, `Equals/GreaterThan/LessThan` for Date), a target value (the input adapts: dropdown for OptionSet/Multiselect, native date picker for Date, free text otherwise — hidden for unary `IsTrue/IsFalse`), an outcome-if-pass (Met / Suitable / Pass), and outcome-if-fail (Not met / Not suitable / Fail). Rules persist as `dnx_evaluationcriteria` rows with `scoring_type = Boolean`, `source_type = QuestionValue`, both `dnx_Assessment_Level` and `dnx_Source_Assessment_Level` bound to the question itself. The **runtime** calls `evaluateQuestion(level, criteria, response)` from `src/features/rules/engine.ts` for each answered question and renders a coloured outcome chip beside the label — green-soft for pass, red-soft for fail, nothing for not-evaluable. The evaluator is pure (no DOM/network) so M7b can reuse it for the cascade. Rules can only be authored after a question exists (the dialog shows a hint in add mode); reopen the question to add one. New rules-feature folder at `src/features/rules/`.
- **Reviewer Approve / Reject + per-level flags (M4d)** — On a PendingReview instance the hero exposes two reviewer actions. **Approve** opens a green-themed dialog with an outcome radio (Suitable / Not suitable) + optional notes; flips status to Complete (778540004), stamps outcome on the instance, bumps version, snapshots. **Reject** opens an amber-themed dialog with a required "What needs to change?" textarea plus an optional **Flag specific questions** section: pick any question from a dropdown grouped by parent path, hit *Add flag*, and a per-flag notes textarea appears for each tagged level. On submit, all flag rows are created in parallel as `dnx_reviewer_comments` (with `dnx_Assessment` + `dnx_Assessment_Level` lookups) then status flips back to InProgress so the assessor can fix things. **Assessor side**: the checklist queries unresolved comments via `useReviewerComments(instanceId)`. If any exist, a top-of-list amber banner shows a count + a **Jump to first flag / Next flag** button that cycles through flagged rows in DOM order (using `compareDocumentPosition` on registered refs — not API insertion order) with a "X of N" chip alongside. Each flagged question gets a thin amber `box-shadow` left accent (inset, no negative margins so the `reveal` wrapper can't clip it) and a tinted amber card directly below the label containing the reviewer's note + a solid green **Mark resolved** button vertically centred against the whole card. Resolving sets `dnx_is_resolved: true` and removes the flag from the running view.
- **App shell** — 52 px sticky topbar with brand mark + horizontal nav tabs (Dashboard / Projects / Assessments / Templates), notification icon + avatar on the right.

## Stack

- **React 19** + **TypeScript** + **Vite 7**
- **@microsoft/power-apps** SDK (v1.0.3) — auto-generated typed services for every Dataverse table
- **@microsoft/power-apps-vite** plugin — handles auth/dev-server integration
- **Fluent UI React v9** — accessible primitives, heavily re-themed (see Design language below)
- **@tanstack/react-query** — server-state + cache invalidation pattern
- **react-router-dom v7** — routing
- **@fluentui/react-icons** — iconography
- **@dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities** — drag-and-drop reorder for the tree editor

## Key directories

```
intelliassessment-v1/
├── .power/schemas/dataverse/         # Dataverse table schemas (synced via pac code)
├── design.md                         # UI design spec — flat aesthetic, color tokens
├── src/
│   ├── generated/                    # Auto-generated by pac code add-data-source
│   │   ├── models/                   # Type-only interfaces for each table
│   │   └── services/                 # CRUD services
│   ├── features/
│   │   ├── projects/                 # Projects CRUD
│   │   ├── templates/                # Templates CRUD
│   │   │   └── levels/               # Tree editor (M3a)
│   │   ├── assessments/              # Stubs for M4 (list + detail)
│   │   └── dashboard/                # Stub tiles + outcome breakdown
│   ├── layout/AppLayout.tsx          # 52 px topbar shell
│   ├── lib/
│   │   ├── theme.ts                  # Custom Fluent purple theme override (shadows: none)
│   │   ├── dataverse.ts              # lookupName() / lookupId() helpers (see gotcha G)
│   │   └── queryClient.ts            # Shared React Query client
│   ├── App.tsx                       # Router
│   ├── main.tsx                      # Providers (FluentProvider, QueryClient, BrowserRouter)
│   └── index.css                     # Inter font, design.md CSS variables, reset
├── power.config.json                 # Code App config (appId, environmentId)
└── vite.config.ts                    # Vite + powerApps plugin
```

## Architecture patterns (established — keep doing this)

### 1. Feature folder structure per entity

For each domain entity, the folder contains:

- `api.ts` — query keys, query hooks (`use<Entity>s`, `use<Entity>`), mutation hooks (`useCreate<Entity>`, `useUpdate<Entity>`, `useDelete<Entity>`). React Query owns cache; mutations invalidate list, write back to detail via `setQueryData`.
- `<Entity>FormFields.tsx` — shared form fields used by both Create and Edit dialogs.
- `New<Entity>Dialog.tsx` / `Edit<Entity>Dialog.tsx` / `Delete<Entity>Dialog.tsx` — Fluent Dialog wrapping the shared form.
- `<Entity>sPage.tsx` — list grid.
- `<Entity>DetailPage.tsx` / `<Entity>EditorPage.tsx` — detail with hero + Edit/Delete actions.

For nested entities (e.g. levels under a template) use a sub-folder pattern: `features/templates/levels/` contains `api.ts`, `treeBuilder.ts` (pure tree functions), `LevelTree.tsx` (container), `LevelTreeNode.tsx` (recursive row), shared dialogs.

### 2. Mutation pattern (per Microsoft's CRUD docs)

When creating: **exclude primary key + ownership fields** (`ownerid`, `owneridtype`, `owneridname`, etc.). The platform fills these from the signed-in user. Cast with `as unknown as Omit<...Base, 'pkfield'>` to bypass required-field types in the generated interface.

When updating: send **only changed (editable) fields** — sending unchanged values would trigger business rules / corrupt audit logs.

When setting lookups: use the `@odata.bind` annotation with the **SchemaName-cased** key (not lowercase logical name). See gotcha K.

### 3. Visual design language (per `design.md`)

- **Typography:** Inter variable font, weights 400 / 500 only (no bold). Type ramp: 18 px page titles, 14 px card headings, 13 px body, 11–12 px labels/meta. Sentence case everywhere — no Title Case in prose.
- **Color tokens** in `src/index.css` as `--color-*` CSS variables:
  - Surfaces: `--color-background-{primary,secondary,tertiary}` (white / `#f5f5f4` / `#fafaf9`)
  - Text: `--color-text-{primary,secondary,tertiary}` (`#1a1a1a` / `#56565a` / `#888780`)
  - Borders: `--color-border-tertiary` (rgba 0.08) / `--color-border-secondary` (rgba 0.16)
  - Categorical (each with `-soft` and `-text` variants): `--color-{purple,green,amber,red,blue,teal,gray}`
- **Cards:** `--color-background-primary` surface, `0.5px solid --color-border-tertiary`, `border-radius: 12px`. Card header with bottom border + 14 / 18 px padding; card body 18 px padding. **No box-shadow, no gradients.** Hover swaps to `--color-background-secondary`.
- **Status pills:** `inline-flex`, `padding: 3px 8px`, `border-radius: 20px` (pill). Soft background + dark text from the matching `--color-{semantic}-{soft,text}` pair.
- **Dialog headers:** custom solid-color **soft icon chip** (32×32, `border-radius: 8px`) + 14 px medium title + 12 px sub. Chip color per action archetype:
  - Create → `--color-purple-soft` / `--color-purple-text`
  - Edit → `--color-blue-soft` / `--color-blue-text`
  - Delete → `--color-red-soft` / `--color-red-text`
- **Dialog surface:** `border-radius: 12px`, `max-width: 480–560 px` depending on form length, `width: 92vw` on mobile. Field gap: 20 px.
- **Global Fluent flattening** in `index.css` — kills `box-shadow` on Input/Textarea/Dropdown/SpinButton globally and replaces the default brand-blue focus underline with `--color-purple`.

## Gotchas & lessons learned (don't relearn these)

### A. Edit dialogs: never use `useEffect` to prefill state from props

`useMutation` returns a **new object reference on every render**, so listing it in a `useEffect` deps array causes the effect to re-run on every keystroke, clobbering in-flight edits. **Prefill in an `onOpenChange` handler** — runs once on the closed→open transition only.

```tsx
function handleOpenChange(next: boolean) {
  setOpen(next);
  if (next) {
    setName(record.field_name);
    // ... reset all state, call mutation.reset()
  }
}
```

### B. Dataverse `DateTimeType` may actually be `Edm.Date`

The schema JSON labels `dnx_published_on` as `DateTimeType`, but the column was configured with **Date Only** behavior in Dataverse. OData enforces `Edm.Date` literal format: must send `YYYY-MM-DD`, not full ISO. Use `new Date().toISOString().slice(0, 10)` for date-only fields. The error message `Cannot convert the literal '...' to the expected type 'Edm.Date'` is the tell.

### C. Griffel `makeStyles` rejects shorthand `borderColor` in nested selectors

Inside `:hover { ... }` blocks, `borderColor: '...'` errors with `Type 'string' is not assignable to type 'undefined'`. Use the full `border: '0.5px solid ...'` shorthand instead.

### D. Fluent `DialogSurface` already has 24 px padding

Don't override with custom `padding` — it shrinks the inner content area and makes inputs touch the rounded edges. Use `borderRadius`, `maxWidth`, `width` only.

### E. Cast around required ownership fields on create

The generated `<Entity>Base` interface marks `ownerid`, `owneridtype`, etc. as required, but the docs explicitly tell us **not** to send them. Use `as unknown as Omit<<Entity>Base, '<pk_field>'>` — this is the official sample pattern.

### F. Code App auth is transparent

Generated services use `getClient(dataSourcesInfo)` internally — no `<PowerProvider>` wrapper needed, no token plumbing. Just call `Dnx_xxxService.create/get/update/delete` and the SDK handles bearer tokens via the host iframe.

### G. Lookup display names live on the OData annotation key, NOT the typed field

The generated `<Entity>` interfaces include fields like `owneridname: string`, `createdbyname?: string` — but at runtime **the SDK does not flatten the OData annotation onto those typed fields**. The display value lives on the raw key `_<lookup>_value@OData.Community.Display.V1.FormattedValue` and the GUID on `_<lookup>_value`.

Use the helpers in `src/lib/dataverse.ts`:
```ts
import { lookupName, lookupId } from '../../lib/dataverse';

lookupName(project, 'ownerid');    // "Ahmad Aleem"
lookupName(project, 'createdby');  // "Ahmad Aleem"
lookupName(instance, 'dnx_project'); // "Q2 Skill Assessments"
lookupId(project, 'ownerid');      // "01e47fe3-aecd-ef11-b8e8-7c1e522b249e"
```

Do **not** read `record.owneridname` / `record.createdbyname` directly — they're typed as present but undefined at runtime. The SDK *does* request `odata.include-annotations=*` so the data is always there, just at the awkward key.

### H. Inline `<span>` ignores width/height

For decorative dots / dividers (e.g. the purple "include in letter" indicator), the `<span>` element defaults to `display: inline` which ignores `width` and `height`. Always set `display: inline-block` (or use a `<div>`/flex parent) on dot-like decorations.

### I. Reset native `<button>` chrome when using bare buttons for icon actions

Tight 18–20 px icon buttons need explicit `background: transparent; border: none; padding: 0` — otherwise the browser's default button background + bevel + padding clips or hides the SVG icon inside. The chevron expand/collapse on the tree was invisible until this reset was applied. The other icon buttons in the codebase (`iconBtn` class) already follow this pattern.

### J. Fluent `<Field required>` propagates `required` to child `<Input>` via context

If you wrap a complex composite (e.g. a chip editor with an internal draft input) in `<Field required>`, Fluent will mark the inner `<Input>` as `required` via context. Submitting with the draft field empty (even when the actual data is present elsewhere) triggers the browser's HTML5 validation popup.

**Fix:** drop `required` from the Field; enforce the rule via the disabled state on the submit button instead.

### K. Dataverse lookups use `@odata.bind` with SchemaName casing

To create/update a record with a lookup field, send the navigation property using the **SchemaName-cased** key and the `@odata.bind` annotation. Note the casing: it's NOT the lowercase logical name.

```ts
const record = {
  dnx_name: 'Qualification Section',
  // SchemaName-cased + @odata.bind + entity-set path
  'dnx_Assessment_Template@odata.bind': `/dnx_assessment_templates(${templateId})`,
  'dnx_Parent_Assessment_Level@odata.bind': `/dnx_assessment_levels(${parentId})`,
};
```

The generated `<Entity>Base` interface includes the `"<SchemaName>@odata.bind"?: string` field for each lookup — use that as a hint for the right key.

### L. Use `CSS.Translate.toString()` (not `Transform`) for dnd-kit drag styles

`@dnd-kit/utilities` exports two helpers for serializing a sortable item's `transform`:

- `CSS.Transform.toString(transform)` → `translate3d(...) scaleX(...) scaleY(...)`
- `CSS.Translate.toString(transform)` → `translate3d(...)` only

For nested trees with siblings of vastly different heights (e.g. a tall expanded Section next to a single-row Question), `Transform` scales the dragged element to match its over-target — producing a visible "squish/stretch" while dragging. Use `Translate` for pure motion.

```tsx
const { transform } = useSortable({ id });
const style = { transform: CSS.Translate.toString(transform) };
```

### M. `@odata.bind` "Does Not Exist" 404 means the lookup column points at the wrong table

If a record creation with `@odata.bind` to an existing record fails with `Entity 'X' With Id = <valid GUID> Does Not Exist` — and you can `GET` that same GUID from the same entity set via the SDK — the cause is almost always a **lookup column on the source table pointing at the wrong target table**.

This happens when:
- A table was renamed or recreated, leaving an orphan duplicate (e.g. both `dnx_project` singular and `dnx_projects` plural exist as actual tables).
- A lookup was added before the table rename, freezing the lookup's target on the old/wrong table.

The 404 wording is misleading — Dataverse doesn't say "wrong table", it just says "Does Not Exist", because internally the lookup expects the record from a different entity set than the bind URL targets.

**How to verify:** open the lookup column in the maker portal (Tables → source → Columns → the lookup → Edit) and check the **Related table** field. If it's `dnx_projects` (plural) but your SDK reads from `dnx_project` (singular), or vice versa, that's the bug.

**How to fix:** Dataverse won't let you change a lookup's Related table after creation.
1. Delete the wrong lookup column (existing rows lose the link — usually fine pre-launch).
2. Add a new lookup column with the same name pointing at the correct table.
3. Inspect the new relationship's auto-generated SchemaName — confirm the suffix references the correct target table (e.g. `dnx_assessment_instance_Project_dnx_project` not `_dnx_projects`).
4. Delete the orphan duplicate table once you've confirmed nothing depends on it.
5. Re-sync: `pac code add-data-source -a dataverse -t <source_table>`.

### N. Custom option sets stored as JSON in an existing text column

`dnx_assessment_levels.dnx_option_set_reference` was originally designed to hold a Dataverse choice logical name, but assessment authors often want inline custom option lists. We re-use the same text column to store a JSON-encoded array of label strings:

```text
["Yes","No","Not applicable"]
```

No schema change needed. Use `parseOptions(stored)` / `serializeOptions(arr)` from `features/templates/levels/options.ts`. Legacy plain-text values fall back to a single-entry list so existing data still loads.

### O. Dataverse File-type columns need a two-call write (`create` + `uploadFileToRecord`)

File and Image columns can't be written via the normal `create()` / `update()` request body — the column is just a string reference in the model, not a value field. Write in two steps:

```ts
import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../../.power/schemas/appschemas/dataSourcesInfo';

// 1. Create the row with all the normal scalar/lookup fields.
const row = await Dnx_assessment_versionsService.create({
  dnx_version_number: '5',
  dnx_change_summary: 'Autosave',
  'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${instanceId})`,
  statecode: 0,
  statuscode: 1,
});

// 2. Upload the file contents to that row's file column. The SDK accepts
//    string | Uint8Array | ArrayBuffer | Blob — strings (JSON, CSV, plain
//    text) are uploaded as UTF-8 bytes.
const client = getClient(dataSourcesInfo);
await client.uploadFileToRecord(
  'dnx_assessment_versions',          // entity-set name
  row.data!.dnx_assessment_versionid, // row GUID from step 1
  'dnx_snapsho_tjson',                 // file column logical name
  'snapshot.json',                     // file name as it'll appear in Dataverse
  jsonContent,
);
```

The generated TS model exposes `<Entity>UploadColumnName` as a type listing every File/Image column. The Power Apps maker portal sometimes mangles column logical names (e.g. `snapshot_json` became `snapsho_tjson` here — note the underscore migration) — use the model's `UploadColumnName` constant rather than re-typing.

Fire-and-forget pattern recommended for non-critical uploads (audit snapshots, attachments) so a file-upload failure can't block the user's primary mutation.

### P. Evaluation criteria — Importance lives in `dnx_weight`, threshold in `dnx_pass_threshold`

The Dataverse `dnx_evaluationcriterias` table has columns that the simplified M7b UI maps to friendly concepts:

| Column | UI concept |
|---|---|
| `dnx_scoring_type` (Boolean / Weighted / Grouped) | "How does this level pass?" — Boolean = "Every child must pass", Weighted = "At least X% must pass" |
| `dnx_pass_threshold` (0.0–1.0 decimal) | Surfaced as a 0–100 percent input; persisted by dividing by 100 |
| `dnx_weight` (decimal) | Per-question **Importance** field — only meaningful when the parent rule uses Weighted. Default 1. Parents always save 1. |
| `dnx_outcome_if_pass` / `dnx_outcome_if_fail` (3-value picklists) | UI no longer exposes the picker — every save is `Suitable` / `NotSuitable`. The label maps in `types.ts` collapse all three pass values to "Suitable" and all three fail values to "Not suitable" so legacy rows render consistently. |
| `dnx_source_type` | Auto-derived from level type: Question = 0 (Question Value), Subsection = 1 (Subsection Outcome), Section = 2 (Section Outcome). Not user-visible. |

Grouped scoring (`dnx_scoring_type = 1` + `dnx_scoring_groups` table) is intentionally unimplemented in M7b — the aggregator falls back to Boolean semantics if it encounters one. See `src/features/rules/engine.ts` `aggregateChildOutcomes`.

### Q. Assessment-level rules attach to a hidden Root level, not the template

The schema only allows criteria to bind to a `dnx_assessment_levels` row (via the `dnx_Assessment_Level` lookup). To make the **assessment outcome** author-able like sections / subsections / questions, we keep a single row of `dnx_assessment_level_type = 0` per template — created on demand by `useEnsureRootLevel`, never shown in `LevelTree` (filtered out by `buildTree`), and named `_root_` as a placeholder.

`evaluateAssessment` accepts an optional `rootCriteria` argument. Callers derive it via the `findRootCriteria(levels, criteriaByLevelId)` helper. When present, sections are aggregated through `aggregateChildOutcomes` against this criteria; when absent, the evaluator falls back to "every section must pass" — preserves behaviour for any template that doesn't have an assessment-level rule.

The `LevelType` union (`1 | 2 | 3`) deliberately excludes 0 since the Root is implementation detail. `CriteriaEditor` internally widens its `levelType` to `number` so it can branch on the Root case (different description copy + criteria name `"Assessment outcome rule"`).

### R. Grouped scoring stores groups as JSON in `dnx_target_value`, not in `dnx_scoring_groups`

The schema includes a dedicated `dnx_scoring_groups` table with a single `dnx_evaluation_criteria` lookup, `dnx_group_weight`, and `dnx_scoring_group_name` — but the membership story (which criteria belong to which group, how the group ties back to its owning parent) is ambiguous and would need several rows per group plus a name-based join to reconstruct.

M7d takes the pragmatic path: each group is `{ name, minToPass, memberLevelIds[] }`, serialised by `serializeGroups` into the parent criteria's existing `dnx_target_value` field (unused by parents in the other scoring modes). The whole group definition lives in one Dataverse row that's already loaded by `useCriteriaForLevels`, no second query, no membership reconciliation. `parseGroups` is defensive — bad JSON or shape mismatches return an empty array.

Consequences:
- `dnx_scoring_groups` table stays empty for all M7d-authored rules. Don't surface it in any UI.
- If a future use case truly needs the dedicated table (cross-criteria grouping, reusable group definitions), migration is straightforward — write the groups into rows, point `dnx_target_value` at a group key, swap the parser.
- `parseGroups` ignores `dnx_target_value` when `scoringType !== 'Grouped'`, so the same column is reused safely across modes.

### S. Comment question tags live in `dnx_comment_text`, not the level lookup

The `dnx_reviewer_comments` table already has a `dnx_Assessment_Level` lookup, but it's reserved for the per-question reviewer-flag flow (`useCreateReviewerComments`) — that flag's whole UI is gated on `levelId !== null` to keep flags inline on questions and general comments inside the drawer.

To let general comments **also** reference a specific question without collapsing the flag/comment distinction, the tag is stored in-band at the start of the comment body:

```
[Q:<levelId>|<questionName>] actual comment text…
```

`parseCommentText` / `serializeCommentText` in `commentTags.ts` round-trip the token. The display side renders the parsed `taggedLevelId` + `taggedName` as a clickable chip; click handler closes the drawer + smooth-scrolls the question (each `QuestionItem` gets `id="level-<levelId>"`).

Consequences:
- Comment tags don't add a row to `dnx_reviewer_comments` per tag — the tag IS part of the existing comment row.
- Tag name is captured at compose time; if the question is later renamed, the tag chip shows the old name until the comment is edited. That's a deliberate trade — keeps display cheap (no extra level lookup at render time).
- Older comments without the token render as plain text (parser returns `body` as the full input).

## Dataverse entity reference (publisher prefix `dnx_`)

| Table | Logical name | Use |
|---|---|---|
| Project | `dnx_projects` | top-level workspace, contains many assessments |
| Assessment Template | `dnx_assessment_templates` | reusable definition; versioned on publish |
| Assessment Instance | `dnx_assessment_instances` | live working copy bound to one project + one template |
| Assessment Level | `dnx_assessment_levels` | self-referencing tree (Root / Section / Subsection / Question) |
| Assessment Response | `dnx_assessment_responses` | answer per question per instance |
| Evaluation Criteria | `dnx_evaluationcriterias` | rule engine config |
| Scoring Group | `dnx_scoring_groups` | grouped field clusters for composite scoring |
| Evidence File | `dnx_evidence_files` | file metadata + SharePoint URL + OCR verification flags |
| Assessment Version | `dnx_assessment_versions` | audit log of state snapshots |
| Reviewer Comment | `dnx_reviewer_comments` | threaded comments |

Each table has a generated TS interface at `src/generated/models/Dnx_xxxModel.ts` and service at `src/generated/services/Dnx_xxxService.ts`. **Treat both folders as build artifacts** — regenerate via `pac code add-data-source` if the schema changes.

### Common option-set codes

- **Projects** `statuscode`: `1` Active · `2` Inactive · `778540001` Archived · `778540002` OnHold
- **Templates** `statuscode`: `1` Active · `2` Inactive · `778540001` Draft · `778540002` Published · `778540003` Deprecated
- **Assessment Instances** `statuscode`: `1` Active · `2` Inactive · `778540001` Draft · `778540002` InProgress · `778540003` PendingReview · `778540004` Complete
- **Assessment Levels** `dnx_assessment_level_type`: `0` Root · `1` Section · `2` Subsection · `3` Question
- **Assessment Levels** `dnx_data_type`: `0` Boolean · `1` OptionSet · `2` Multiselect · `3` Text · `4` Date

## Routes

```
/                              → redirects to /dashboard
/dashboard                     → DashboardPage (stub tiles + outcome breakdown)
/projects                      → ProjectsPage (list)
/projects/:projectId           → ProjectDetailPage
/templates                     → TemplatesPage (list)
/templates/:templateId/edit    → TemplateEditorPage (overview + Publish + tree editor)
/assessments                   → AssessmentsListPage (stub for M4)
/assessments/:assessmentId     → AssessmentPage (stub for M4)
```

## Running locally

```bash
npm install         # install deps
npm run dev         # vite dev server at http://localhost:3000
npm run build       # tsc -b && vite build
npx tsc -b          # type-check only (fast)
```

To run inside the Model-Driven host, use Power Platform CLI: `pac code run`. Auth flows through the host automatically.

## Next session — start here

**M4 is fully shipped** (M4a → M4c.2). The assessor side of the product is end-to-end: instance creation, fillable checklist with autosave, conditional visibility, submit-for-review with required-field validation, lock + reopen workflow, and full per-save audit snapshots. The next logical milestone is **M5 — Reviewer experience and / or evidence files**.

### Option A — Reviewer-side UI (recommended)

The snapshots we now write to `dnx_assessment_versions` are pure waste without a reviewer who reads them. Build the reviewer side:

1. **Reviewer dashboard** — list of instances in `PendingReview` status, sorted by submitted date. Probably gated to the Reviewer role (see Option D below for the role-detection plumbing).
2. **Snapshot viewer** — open a version row, fetch the file via `downloadFileFromRecord('dnx_assessment_versions', versionId, 'dnx_snapsho_tjson')`, render the JSON as a read-only view of the assessment state at that point. Bonus: a diff view between two versions.
3. **Approve / reject actions** — flip statuscode to Complete (778540004) or kick back to Draft (778540001). Sets the final outcome on the instance.
4. **Threaded comments** — PRD §6.10's `dnx_reviewer_comments` table is ready. Self-reference via `parent_comment_id` for threading.

### Option B — M5: Evidence files

PRD §2.4 / §6.8. File upload at the section/subsection level → SharePoint via Power Automate → `dnx_evidence_files` row with `sharepoint_url`. Needs the SharePoint connector configured + a Power Automate flow. Bigger build, requires platform plumbing. Less urgent if assessors aren't yet asking for it.

### Option C — Smaller polish (any of these)

- **Role-gated actions** — Submit + Reopen + Delete + Approve + Reject + Mark resolved are currently visible to every signed-in user. Wire up Entra/Dataverse role detection (Assessor / Reviewer / Admin per PRD §5.1) and hide actions accordingly. Server-side enforcement is the real barrier (Dataverse security roles already gate the writes), UI hiding is just polish — but it's worth getting right before the reviewer dashboard ships, since the reviewer dashboard needs to know who's a reviewer.
- **Code-split with `React.lazy()`** — bundle is ~830 kB / 240 kB gzipped; route-level splitting would meaningfully drop the first-paint cost.
- **Multi-value visibility rules** — currently a rule has a single RHS value. The runtime contract is forward-compatible (`value: string[]` would migrate cleanly with a parser update). Add when there's actual demand.
- **Section progress bars** in the assessment runtime header — visual `answered / total` ring per section, plus an overall instance progress.
- **Mobile responsiveness audit** — the topbar nav + tree editor haven't been tested at narrow viewports.
- **Throttle audit snapshots** — currently every keystroke (after debounce) writes one version row + one file. For long assessment sessions this fills `dnx_assessment_versions` quickly. Reasonable optimization: skip the snapshot when fewer than ~30 s have passed since the last Autosave snapshot; always snapshot on Submit/Reopen.

## Useful links

- Microsoft docs for CRUD against Dataverse: https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse
- The official Code Apps sample: https://github.com/microsoft/PowerAppsCodeApps/tree/main/samples/Dataverse
