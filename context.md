# IntelliAssessment V1 — Project Context

> Read this first when returning to the project. Last updated: 2026-07-22 (Letter **page-level letterhead** (M8b.1+): a custom **header, footer, and background image** are now authorable in a collapsible "Page settings" panel on the Letter tab. Header/footer are rich text (same editor as blocks) and become **repeating page headers/footers** in the Word export; the background image is uploaded to a new `dnx_letter_background` **File** column on the template (File not Image — Image columns downscale/re-encode and pixelate a crisp logo) — see the new **gotcha AB**. Earlier the same day: M9 started (persisted **outcome pill** on the `AssessmentList`), and the Letter got a genuine **Word (.docx) export** alongside the PDF. M8b (custom letter builder + grouped subsections) remains fully shipped — see below.)

## What this is

A Power Apps **Code App** (React + TypeScript) embedded in a Model-Driven App, backed by Microsoft Dataverse. The product is a configurable, multi-level **Assessment Module** — assessors run structured checklists against reusable templates, capture evidence, auto-evaluate outcomes, and generate outcome letters.

The detailed product spec lives in two places:
- **PRD** — the original PDF the user attached on 2026-05-23 (also summarised in the personal plan file outside the repo).
- **`design.md`** at the repo root — the UI design specification we're now matching. Flat aesthetic, 0.5 px borders, no shadows, no gradients, purple (`#7F77DD`) brand.

## Demo & walkthrough

- **`/admin/seed`** route (not linked from the nav, URL-only) renders a one-click seeder that builds a coherent demo dataset: one Project, one rich Template exercising every rule mode + per-question Importance + `include_in_letter` flags, and three Assessments at varied states (Draft, InProgress with reviewer flag + comment threads, Complete + Suitable). See `src/features/admin/seedDemo.ts`.
- **`demo-guide.md`** at the repo root — click-by-click walkthrough through every feature in ~10–15 minutes. Cleanup steps at the bottom.

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
| **M5** Evidence files + SharePoint | ✅ done | New `src/features/evidence/` folder: `EvidenceCard` mounted on the AssessmentPage between Overview and the checklist. Drag-and-drop + click-to-upload `FileDropzone` reads files via FileReader, base64-encodes, calls the `UploadSharepointFile` flow with the whole assessment's files in one shot. `FileList` lists files via `GetSharepointFiles`, renders Download (decodes embedded base64 → Blob → anchor click) / Extract / Delete per row. Card is disabled (visually) when status is PendingReview or Complete. See gotchas T + U for the flow contract + base64 normalisation quirks. |
| **M6a** AI text extraction | ✅ done | Per-file **Extract** button on `FileList` calls the `DocumentTextExtractionFlow` (passes file name + assessment name). Result renders in `ExtractedTextDialog` — read-only monospace viewer with header, scrollable body. Foundation for M6b. |
| **M6b** AI-assisted answer auto-population | ✅ done | Per-question **evidence binding** (file variable + extraction query) authored in the template editor, stored as JSON in `dnx_document_type_reference` (gotcha V). At assessment time the **AI auto-fill** button opens a two-phase dialog: **Map** (bind each declared file variable → a real uploaded file, best-guess pre-filled, persisted on the instance in `dnx_evidence_mapping` — gotcha W) then **Review** (one OCR extraction per distinct mapped file + one batched `AIAgentFlow` call per file-variable group, proposals shown with green/amber/red confidence chips; accept one or all). Accepted answers persist through the normal upsert path with `dnx_ai_populated` / `dnx_confidence_score` / `dnx_ai_source_summary` set, and render an **AI · N%** badge on the question that demotes itself once a human edits the answer (`dnx_manual_override`). Pure prompt-build + lenient-JSON-parse + value-coercion core in `aiPopulate.ts`. **TODO (follow-ups):** (1) ~~Application-details JSON source~~ — **DONE** (M10, see gotcha AD): a question's evidence binding can bind application-details JSON attributes that get injected into its AI prompt. (2) **Subsection file-variable catalog** — let a subsection declare the expected file variables its questions pick from, instead of each question typing its own freely. |
| **M7a** Question-level pass/fail rules | ✅ done | Author a single Boolean-scoring rule per Question from the level edit dialog (`When the answer <op> <value>`, outcome-if-pass / outcome-if-fail). Pure TypeScript evaluator in `src/features/rules/engine.ts`. Runtime renders a green "Met / Suitable / Pass" or red "Not met / Not suitable / Fail" chip beside each answered question. Foundation for the M7b cascade. |
| **M7b** Rule cascade (Subsection / Section / Assessment) | ✅ done | Sub/Section/Assessment roll-up with "Every child must pass" or "At least X% must pass". Per-Question Importance multiplier. Dedicated **Scoring & evaluation** tab on the template editor with a color-coded matrix (purple/blue/teal by level type). Live outcome chips on section/subsection headers + overall banner; hover tooltips explain the math in plain English. Outcomes collapsed to a single Suitable / Not suitable pair. Persisting onto the instance is deferred to M7c (today only the reviewer Approve dialog writes `dnx_outcome`). Grouped scoring is still TODO. |
| **M7c** Persistence + hero chip + assessment-level rules + Approve guards | ✅ done | Submit / Reopen write `dnx_outcome` (computed via `evaluateAssessment` at submission time, Pending on reopen). New `HeroOutcomeChip` on the AssessmentPage hero — live preview during Draft/InProgress, persisted value when locked. Submit dialog previews the outcome with explanation. Approve dialog blocks until every reviewer flag is resolved + always overwrites `dnx_outcome_notes` so stale reject text can't leak into the green "Approved — suitable" banner. **Assessment outcome is now author-able**: a hidden Root level (`dnx_assessment_level_type = 0`) is auto-created per template via `useEnsureRootLevel` and carries its own criteria — the Scoring matrix gets a top "Assessment / Overall outcome" row with an amber accent that runs through the same `CriteriaEditor`. `findRootCriteria(levels, criteriaByLevelId)` feeds it to the runtime evaluator. |
| **M7d** Grouped scoring | ✅ done | Third parent scoring mode **"By groups (N of M)"** — define named groups of descendant questions where at least `minToPass` members must pass for the group to count as 1 vote. Ungrouped children still must pass individually. Groups persist as JSON in `dnx_target_value` (the dedicated `dnx_scoring_groups` table is left empty — see gotcha R). Engine's `aggregateGrouped` produces a per-group breakdown tooltip. |
| **M8a** Outcome letter preview + PDF download | ✅ done | `LetterPreview` + `LetterDialog` under `src/features/letter/`. Fixed-layout HTML letter (candidate / project / template / outcome / reviewer notes / per-section included responses). One-click PDF via `html2canvas` + `jspdf` — rasterises the rendered DOM, paginates across A4, downloads as `outcome-letter-<name>.pdf`. "View letter" button always visible in the AssessmentPage hero. |
| **M8b.1** Custom letter builder (layout) | ✅ done | Drag-drop block designer on a new **Letter** tab (4th, after AI conditioning). Blocks: heading, rich text, details grid (pick which meta fields), outcome, reviewer notes, responses, signature, spacer — reorder via `@dnd-kit`, singletons (outcome/notes/responses/meta) can't duplicate. Heading/text/signature are **rich text** (B/I/U, font size, colour, align, lists) with inline **answer-reference chips** (any question's answer, inserted via a `/` slash menu or picker, colourable). Layout autosaves as sanitized HTML in `dnx_letter_template_json` (gotcha X); `LetterPreview` renders from the blocks (falls back to `DEFAULT_LAYOUT` so legacy templates + the PDF are unchanged). See gotcha X + Y. Data assembly (outcome/meta/answers/sections) lives in `letterData.ts`, shared with the Word exporter. **Download Word** button next to Download PDF — see gotcha AA. **Page-level letterhead** (a "Page settings" panel, not draggable blocks): a rich-text **header** + **footer** (fall back to the built-in brand strip / "Generated by…" line when blank) and a **background image** uploaded to the template's `dnx_letter_background` File column (fit mode Fit/Cover/Tile, default **Fit** = whole image, aspect-preserved; + size % + 9-point position + opacity). Header/footer become true repeating page headers/footers in Word; the background is a floating behind-text image sized to its real aspect ratio (never stretched). Stored as an optional `page` object on the layout JSON — see gotcha AB. |
| **M8b.2** Grouped subsections block | ✅ done | Generic version of "reason-grouped qualifications" — no fixed terminology. A **"Grouped subsections"** block (not a singleton — add several) on the Letter tab: pick **which Section**, then **which question** (found inside that section's subsections) to group by. At letter time, `buildGroupedSubsections` groups the section's direct subsections by their own same-named instance of that question's answer (matched by NAME, since each subsection has its own copy — e.g. every "Qualification N" has its own "Reason" question), and lists each subsection's `include_in_letter` fields under its group value. Subsections with no answer to that question are skipped. See gotcha Z. |
| **M8c.1** Dashboard with real counts | ✅ done | DashboardPage now derives every tile + outcome breakdown + assessor workload + recent-assessments table from a single `useAssessmentInstances()` query. Status pills + outcome pills on each recent row, click-through to instance. |
| **M8c.2** Threaded comments + question tagging | ✅ done | General comments (no level lookup) live in a Fluent `OverlayDrawer` triggered from a hero "Comments (N)" button — discoverable, doesn't consume page real estate. Threads + one-deep replies. Composer has a subtle `+ Tag a question` affordance that swaps in a search-as-you-type Combobox; selecting a question shows a removable purple chip. Tags persist as a `[Q:<levelId>\|<name>]` token at the start of `dnx_comment_text` (schema unchanged — see gotcha S). On display, the token renders as a clickable chip that closes the drawer and smooth-scrolls the question row into view (each row gets `id="level-<id>"`). Author falls back through ownerid → createdby → signed-in user (`useCurrentUser` via `app.getContext()`) → "You". |
| **M8c.3** Version history drawer + diff preview | ✅ done | Right-side drawer over `dnx_assessment_versions` snapshots. Each row: version number, colour-coded reason chip (Autosave / Submitted / Reopened / Approved / Rejected), author, timestamp, **Compare** and **JSON download** buttons. Compare opens a `SnapshotDiffDialog` showing instance metadata + per-question responses side-by-side (snapshot left, current right) with Changed / Added / Removed categorisation and a summary count. Filter by reason in the drawer header. |
| **M8c.4** Revert to a previous version | ✅ done | The version history drawer's per-row **Replace** button opens `SnapshotDiffDialog` in confirm mode (`startInConfirm`). `useRevertToVersion` restores the instance metadata + reconciles every response against the snapshot (update existing levels, create missing, delete ones present today but absent at snapshot time), bumps version, and writes a fresh `'Reverted'` audit snapshot. The dialog's dual-mode footer shows an inline amber confirmation panel before firing — destructive-action gate. |
| **M9** NFRs, QA, deployment | in progress | The remaining real milestone. **Done:** (1) Persisted outcome pill on the assessment list — `AssessmentList.tsx` (shared by the global `/assessments` page and the project-detail page) shows a green "Suitable" / red "Not suitable" pill next to the status pill for `Complete` instances, reading `dnx_outcome`. (2) **Role-gated actions** — `useCurrentUserRoles()` (`src/lib/roles.ts`) reads the signed-in user's Dataverse security roles and gates the action surfaces: Submit / Reopen / AI auto-fill / Mark resolved + checklist editing require **Assessor**; Approve / Reject require **Reviewer**; project & template **Delete** require **Admin** (the explicit `Admin` role only — the built-in System Administrator is kept independent). Actions are hidden when the role isn't held. See gotcha AC. **TODO:** (1) **a11y** — axe-core scan + keyboard nav across every field type. (2) **Perf** — 200-question template render ≤ 3 s (PRD §8), virtualize long sections with `@tanstack/react-virtual` if needed. Smaller polish: code-split with `React.lazy()` (bundle ~2.1 MB / 600 kB gzipped after `docx`); throttle audit snapshots (skip when < ~30 s since last Autosave); multi-value visibility rules; mobile responsiveness audit; clean up the two baseline `react-hooks/set-state-in-effect` lint errors (`AssessmentPage` + `LevelDialog`). Note: template-internal authoring (add/edit/delete levels, scoring, letter) is deliberately left open to everyone for now — only top-level record Delete + the assessor/reviewer workflow actions are gated. The topbar shows the user's app role(s) as a pill (`appRoleLabel` in `roles.ts`) next to the (now real name/initials) avatar. **Future (planned, not built):** (a) a fuller **per-role capability matrix** — e.g. Admin gates project/template *create/edit* (not just delete); (b) **row-level scoping by assignment** — Reviewers see only assessments assigned to them, Assessors only their own, needing an assignment/ownership filter on the `/assessments` + project lists (owner is already on the instance; a reviewer-assignment lookup would be new). Both build on the existing `useCurrentUserRoles()` foundation. |
| **M10** Application details (JSON) | ✅ done | A structured per-assessment **application-details JSON** (fixed shape per template). New **Details** tab on the template editor: paste a **sample JSON** (`dnx_application_schema`), which is flattened into a pickable attribute catalog; then drag-drop which attributes to surface on any **Section/Subsection** (`dnx_details_layout` per level). In the **AI conditioning** tab, a question's evidence binding can now bind specific JSON attributes (`applicationDataPaths`) that get injected into that question's AI prompt as structured facts, and the AI echoes back which it **used** (persisted in `dnx_ai_source_attributes`, shown in the AI badge tooltip). At assessment time an **Application details** card uploads the per-assessment JSON (`dnx_application_details` File column); each authored Section/Subsection shows its chosen attributes resolved from that JSON. Shared JSON path core in `src/features/applicationDetails/appData.ts` (`flattenSchema`/`resolvePath`/`formatValue`). See gotcha AD. |

## Currently working features

- **Projects** — full CRUD (list, detail, create, edit, delete) wired to `Dnx_projectsService`. Flat cards with status pills (Active / On Hold / Archived / Inactive).
- **Templates** — full CRUD on top-level template records (`Dnx_assessment_templatesService`). Lifecycle status (Draft / Published / Deprecated), **Publish** action that bumps version + stamps `dnx_published_on` (uses `Edm.Date` format, see gotcha B).
- **Template tree editor** — Section → Subsection → Question authoring under each template via `Dnx_assessment_levelsService`. Contextual add menus respect the allowed-children rules. Question fields support all 5 data types (Boolean / Option set single / Option set multi / Text / Date) with inline custom option sets stored as JSON in `dnx_option_set_reference`. Required flag + Include-in-letter flag (purple dot in tree) + hint text. (The per-question AI evidence binding that also lives in `dnx_document_type_reference` is authored separately in the AI conditioning tab — see gotcha V.) Cascade-delete walks the subtree depth-first.
- **Drag-reorder + duplicate** — Drag the 6-dots grip handle on any tree row to reorder. **Cross-parent moves now supported** (Question between Sections, Subsection between Sections) — `useMoveLevel` re-binds the `dnx_Parent_Assessment_Level` lookup + bumps trailing siblings; drops between mismatched level types are silently rejected. Each row's kebab menu also exposes **Duplicate**, which deep-copies the subtree in parallel within each level and **inserts the copy immediately after the source** (trailing siblings shifted up by 1). Reorders write only the rows whose order actually changed; cache updates optimistically with rollback on failure. Every icon button has a Fluent tooltip.
- **Conditional visibility (authoring + runtime)** — Each Question's edit dialog has a *Visibility* section. Toggle "Conditional visibility" on, pick a source Question (Boolean / OptionSet / Multiselect), pick an operator (`equals`/`not equals` for single-value sources, `includes`/`does not include` for Multiselect), pick a value from the source's option list. The rule JSON is stored in `dnx_visibility_condition`. **At runtime** the checklist evaluates each rule against the current responses and hides non-matching questions with a smooth `max-height + opacity + translateY` reveal transition (CSS classes `reveal-show` / `reveal-hide` in `index.css`). Multiselect parents follow contains-semantics per the contract in `visibility.ts`. The source-question dropdown is grouped by parent path (`Section › Subsection`) so duplicate names are disambiguated.
- **Assessment instance CRUD** — *Start assessment* button on each project's detail page opens a dialog that lets the user pick a Published template (Draft/Deprecated templates filtered out) and optionally set a due date. Name pre-fills to `<project> — <today>`. Both `dnx_Project` and `dnx_AssessmentTemplate` lookups bound via `@odata.bind`. The project detail page shows all instances under that project; the global `/assessments` page lists every instance across all projects with status pills (Draft / In progress / Pending review / Complete).
- **Assessment runtime (M4b)** — Open any assessment instance and you get a fillable checklist of the template's level tree. Each Section is a collapsible card with a *N / M answered* summary. **Subsections render as their own bordered blocks with a tinted header bar** (purple bullet + `SUBSECTION` label + title + own `N/M` counter), and the subsection header is also clickable to collapse / expand — keyboard accessible via Enter/Space on the header, same chevron pattern as Sections. Questions render with their label, required asterisk, purple letter-flag dot, and per-data-type input (Boolean Yes/No toggle • OptionSet single dropdown • Multiselect checkbox group • multi-line Text textarea • native Date picker). Every change upserts a row in `dnx_assessment_responses` keyed by (instance, level); the matching `dnx_response_*` column is written and the other four are explicitly blanked. Text fields **debounce at 800 ms** so we get one write per pause; Boolean/OptionSet/Multi/Date fire immediately. A small **autosave indicator** in the hero meta row cycles through *Autosave on* → *Saving...* (purple pulse) → *Saved at HH:MM* (green check) → *Save failed — retry* (red error).
- **Submit / Reopen workflow (M4c.1)** — Every successful response save bumps `dnx_assessment_instances.dnx_version` and the `v{n}` chip in the hero refreshes optimistically. The hero exposes a **Submit for review** button (Draft / InProgress states only) that opens a confirmation dialog. The dialog calls `validateSubmission()` — walks the level tree and surfaces a scrollable list of required visible questions that are still unanswered, blocking submit until they're all answered. Submit flips `statuscode` to PendingReview (778540003), stamps today's date into `dnx_submittedon`, bumps version. Once submitted, the checklist becomes read-only: a lock banner appears at the top with a **Reopen for edits** button (PendingReview) or a finalised message (Complete). Reopen flips `statuscode` back to InProgress (778540002), bumps version, and unlocks every input. `dnx_submittedon` is deliberately retained across reopen cycles as the historical fact of submission.
- **Per-save audit snapshots (M4c.2)** — Every save, submit, and reopen also writes a `dnx_assessment_versions` row with a JSON snapshot of the full instance state (metadata + every response value) attached to its `dnx_snapsho_tjson` File column. The snapshot includes `capturedAt`, `reason` (`Autosave` / `Submitted` / `Reopened`), the instance fields, and a flat array of `{ levelId, questionName, boolean, option, multi, text, date }`. Calls are fire-and-forget — a snapshot failure logs to console but never blocks the assessor's save. Read by reviewers via the maker portal until a reviewer-side history UI is built. See gotcha O for the two-call File-column write pattern this uses.
- **Evidence files + AI text extraction (M5 + M6a)** — `src/features/evidence/` exposes a new **Evidence files** card on every assessment, sitting between the Overview card and the checklist. `FileDropzone` accepts drag-and-drop or click-to-pick (multi-file). Files are read via `FileReader.readAsDataURL`, the data-URL prefix stripped, and shipped to the `UploadSharepointFile` Power Automate flow as a JSON array `[{file_name, file_content}]` (`text` field) + the assessment name (`text_1` field). `FileList` calls `GetSharepointFiles` (text = assessment name), parses the returned `[{file_name, file_content, file_path}]` array (unwrapping Power Automate's `{$content-type, $content}` envelope when present — see gotcha T), and renders one row per file with three buttons: **Download** (decodes the embedded base64 client-side after normalisation — see gotcha U — and triggers a Blob download), **Extract** (runs `DocumentTextExtractionFlow`, opens result in `ExtractedTextDialog`), **Delete** (runs `DeleteaSharepointfile`). The card is visually disabled when the instance is PendingReview/Complete. Hooks live in `evidence/api.ts`: `useEvidenceFiles`, `useUploadEvidence`, `useDeleteEvidence`, `useExtractDocumentText`, `useAskAI`.
- **AI auto-fill (M6b)** — the headline AI feature, in two halves.
  - **Authoring (AI conditioning tab).** The template editor has a dedicated **AI conditioning** tab (third tab, parallel to Structure and Scoring & evaluation — `AiConditioningMatrix`). It mirrors the scoring matrix's flat layout: Section / Subsection rows are display-only tinted group headers (purple / blue, indented by depth, no chevron), Questions are the editable leaf rows. Expanding a question opens `EvidenceBindingEditor` inline with two inputs: an **Evidence file variable** (a stable placeholder like `q1-resume` the author types — they don't know real upload names yet) and an **Extraction query** (natural-language instruction, e.g. *"If the extracted text contains a bachelor's degree, set this to true."*). Saved via `useUpdateEvidenceBinding` — a targeted PATCH of only `dnx_document_type_reference` so it never round-trips the whole level form. Stored as JSON via `parseEvidenceBinding` / `serializeEvidenceBinding` (`features/templates/levels/evidenceBinding.ts`); no schema change, legacy plain-text preserved as the `query`. See gotcha V. (The old per-question "AI auto-fill" section inside `LevelDialog` was removed; that dialog now leaves `dnx_document_type_reference` untouched so editing a question's display/visibility can't clobber its binding.)
  - **Assessment time.** An **AI auto-fill** button in the Evidence-files card header (hidden when PendingReview/Complete) opens `AiPopulateDialog`, a two-phase flow. **Phase 1 — Map + select:** every distinct file variable is listed (with its question count) beside a dropdown of the real uploaded files; a name-match best guess pre-fills each, and the effective mapping is **persisted on the instance** in `dnx_evidence_mapping` (`useSaveEvidenceMapping` + `parseEvidenceMapping`) so reopening restores it — see gotcha W. Under each mapped variable is a **per-question checklist** — only ticked questions are sent to the AI (cost control: the agent is queried as little as possible). **All bound questions are offered**, answered or hidden — already-answered ones start *unticked* (with an amber `answered` tag) so they aren't re-queried by default, but the assessor can tick them to re-fill; questions hidden on screen by a visibility rule are still offerable. **Phase 2 — Review:** `useAiPopulateMapped` extracts each *distinct* mapped file once (deduped), then fires **one batched `AIAgentFlow` call per file-variable group** over only the selected questions, each prompt carrying the author's per-question `instruction`. Proposals render with a value, one-line rationale, and a green/amber/red **confidence chip**; a proposal that would overwrite an existing answer shows a *"replaces current answer"* tag. Accept individually or **Accept all**. Nothing writes until accepted; per-file failures surface as warnings.
  - **Persistence + badge.** Accepting a suggestion flows through the normal `useUpsertResponse` path with an `ai` payload, setting `dnx_ai_populated` / `dnx_confidence_score` / `dnx_ai_source_summary` (+ clearing `dnx_manual_override`). `QuestionRow` shows an **AI · N%** badge with a tooltip (confidence + rationale); a later manual edit of that answer clears the AI flag and sets `dnx_manual_override`, so the badge self-demotes to "edited by assessor". The prompt-building, lenient-JSON parsing (strips ```fences```, tolerates a lone object, clamps 0–1 / 0–100 confidence), and per-data-type value coercion (enforces allowed-option membership, normalises dates) all live as pure functions in `aiPopulate.ts`.
- **Custom letter builder (M8b.1)** — the template editor's **Letter** tab (`LetterBuilder`) is a drag-drop block designer for the outcome letter. Palette adds blocks: **heading**, **rich text**, **details grid** (checkbox which meta fields show), **outcome**, **reviewer notes**, **responses**, **signature**, **spacer**; reorder via `@dnd-kit`, and the singleton blocks (outcome / notes / responses / meta) disable in the palette once present. Heading / text / signature use `TokenTextEditor`, a content-editable rich-text field with a toolbar (**bold / italic / underline**, a small **font-size** set, **font colour** — black/purple/blue/green/red/yellow, **alignment**, **bullet + numbered lists**; colour & size require a selection). Inline **answer-reference chips** let an author drop any question's answer into prose — insert via a **`/` slash menu** at the caret (type to filter, ↑↓/Enter) or a picker; each chip carries the question's level id (`<span class="tok-chip" data-level>`), can be **colour-styled**, and is followed by a zero-width space so the caret can sit to its right (stripped on save). The right pane shows a **live preview** with placeholder sample data. Layout autosaves (debounced) as **sanitized HTML** in the template's `dnx_letter_template_json` via `useSaveLetterLayout`. `LetterPreview` renders from the block list (`resolveLetterHtml` resolves `{placeholder}` merge tokens + swaps each chip for its answer value, then sanitizes) — and falls back to `DEFAULT_LAYOUT` (the original fixed letter as blocks) when a template has no custom layout, so existing letters + the one-click PDF are unchanged. Model + resolver in `letterLayout.ts`, allowlist sanitizer in `sanitizeHtml.ts`. See gotchas X + Y. **Page-level letterhead**: above the block palette, a collapsible **Page settings** panel holds a rich-text **header** and **footer** (`TokenTextEditor`, chips + placeholders; blank = the built-in brand strip / footer) and a **background image** uploader. The image uploads to the template's `dnx_letter_background` **File column** via `useSaveLetterBackground` (`uploadFileToRecord`, gotcha O/AB — File over Image so a crisp logo isn't downscaled); the layout JSON only stores an `image: true` flag + display settings (`backgroundMode` fit/cover/tile, `backgroundOpacity`, `backgroundScale` size %, `backgroundPosition` 9-point anchor). "Remove" just flips the flag off (the SDK has no delete-file method — bytes stay, ignored). The preview downloads the bytes → object URL (`useLetterBackgroundObjectUrl`) and renders header once at top, footer once at bottom, background as an absolute behind-content layer. See gotcha AB.
- **Word export (.docx)** — the letter dialog has a **Download Word** button beside Download PDF. Unlike the PDF path (which rasterises the rendered DOM via `html2canvas` — an image, not real text), the Word export builds an actual `docx.Document` via the `docx` library, straight from the same data. `letterData.ts` extracts the letter's data assembly (outcome, meta values, every question's formatted answer, the section/subsection tree, reviewer notes) out of `LetterPreview` into a pure function (`buildLetterData`) so the on-screen/PDF renderer and `letterToDocx.ts` can never disagree about *what* the letter contains — only how each medium presents it. `letterToDocx.ts` walks the same block list `LetterPreview` renders (heading/text/meta/outcome/notes/responses/groupedSubsections/signature/spacer) and emits `docx` Paragraphs/Tables/Headings; rich-text blocks go through `htmlToDocx.ts`, which maps the sanitizer's allowlisted tags/styles (bold/italic/underline/font-size/colour/lists) onto real `docx` `TextRun` properties. Result is a genuinely editable `.docx` — real text, not an image. A custom letter **header/footer** become **repeating docx page headers/footers** (not a one-off block), and the **background image** is embedded as a floating behind-text full-page `ImageRun` on the header (bytes fetched via `downloadFileFromRecord` at export time). See gotchas AA + AB.
- **Grouped subsections block (M8b.2)** — a second, non-singleton block type on the Letter tab for grouping a repeated structure (e.g. 5 "Qualification" subsections under one Section) by a field inside each of them. The block editor has two dependent dropdowns: pick a **Section** (lists top-level sections), then pick a **question** — the dropdown lists the distinct Question names found inside *that section's* direct subsections (computed live; resets if the section changes). Nothing about "qualification" or "reason" is hardcoded — it works for any section whose subsections share a common question layout. At render time (`buildGroupedSubsections` in `LetterPreview.tsx`), for each of the chosen section's direct subsections: find its own child question matching the picked name (matched by **name**, not level id — every subsection has its own distinct instance of that question), read that question's answer, and bucket the subsection under that answer value (first-seen order; subsections with no answer are skipped). Each bucket renders every grouped subsection's `include_in_letter` questions (label + answer), same as the Responses block. Because the builder's live preview always uses placeholder sample data with zero responses, this block **never shows content there** — the editor panel says so explicitly; verify on a real assessment's View letter instead. See gotcha Z.
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

### T. Power Automate flow contracts — input/output reference

Five flows are wired into the Code App via `power-apps add-flow` (npm CLI, requires `@microsoft/power-apps` v1.1.1+). Each flow has a manual PowerApps trigger; multiple inputs surface as `text`, `text_1`, etc. on the generated `ManualTriggerInput`. Generated services live at `src/generated/services/<FlowName>Service.ts`; the wrapper hooks in `src/features/evidence/api.ts` hide the parameter naming.

| Flow | Input | Output | Notes |
|---|---|---|---|
| `UploadSharepointFile` | `text` = `JSON.stringify([{file_name, file_content}, …])` (base64 file bodies)<br>`text_1` = assessment name | `response: string` (e.g. `"Files Uploaded Successfully"`) | Multi-file in one call. Flow scopes the SharePoint folder by `text_1`. |
| `GetSharepointFiles` | `text` = assessment name | `file_data: string` — JSON-stringified `[{file_name, file_content, file_path}]`. `file_content` is wrapped as `{"$content-type": "...", "$content": "<base64>"}` because the flow embeds `body('Get_file_content_using_path')` directly. See gotcha U. | Parser unwraps `$content` to a bare base64 string. |
| `DeleteaSharepointfile` | `text` = file name (with extension)<br>`text_1` = assessment name | (void) | File name must include the extension — derive from `file_path`, not the SharePoint `Name` token. |
| `DocumentTextExtractionFlow` | `text` = file name (with extension)<br>`text_1` = assessment name | `content: string` — extracted plain text | OCR / Azure AI Document Intelligence under the hood. |
| `AIAgentFlow` | `text` = free-text prompt | `response: string` — LLM completion | Hook (`useAskAI`) exported, no UI consumer yet (M6b). |

The Get flow's `file_name` field uses SharePoint's `Name` token which **strips the extension**. `useEvidenceFiles` re-derives the name from `file_path`'s basename so downstream Delete + Extract calls receive `passport.pdf`, not just `passport`. If you ever change the Get flow to use `{FilenameWithExtension}` or `Display Name`, the fallback becomes dead code (harmless).

### U. Base64 from Power Automate is RFC-2045-wrapped — normalise before `atob`

Power Automate's `body('Get_file_content_using_path')['$content']` returns base64 with line-wraps every 76 characters (RFC 2045) and may include `\r\n` or stray whitespace. The browser's `window.atob` is strict — any whitespace throws `InvalidCharacterError`.

`downloadBase64` in `FileList.tsx` normalises before decoding:

```ts
let b64 = file.fileContent
  .replace(/\s+/g, '')   // strip CR/LF/space (RFC 2045 wrapping)
  .replace(/-/g, '+')    // URL-safe → standard (defensive — some HTTP layers swap these)
  .replace(/_/g, '/');
while (b64.length % 4 !== 0) b64 += '=';  // re-pad if trimmed
```

If decode still fails, the function logs the first 80 chars + length to the console — usually points at a payload that's HTML-escaped or double-stringified by the flow.

### V. Per-question AI evidence binding reuses `dnx_document_type_reference` as JSON

The M6b authoring config — `{ fileVariable, query }` — has no dedicated columns, so it piggybacks on the existing `dnx_document_type_reference` text column on `dnx_assessment_levels` (same trick as options in `N` and visibility). `parseEvidenceBinding` / `serializeEvidenceBinding` (`features/templates/levels/evidenceBinding.ts`) round-trip it. It's authored in the **AI conditioning** tab (`AiConditioningMatrix` → inline `EvidenceBindingEditor`, saved via `useUpdateEvidenceBinding` — a PATCH of only this column). The old free-text "Document type reference" field in `LevelDialog` is gone; `LevelDialog` now passes `documentTypeReference: undefined` on save so a question edit never clobbers the binding (PATCH skips undefined fields).

```text
{ "fileVariable": "q1-resume",
  "query": "If the extracted text contains a bachelor's degree, set true." }
```

Back-compat: a legacy plain-string value (or any non-JSON) is preserved as the `query` so authored intent is never dropped — it re-serialises into the JSON shape on next save. The runtime reads it via `toAiQuestions` in `aiPopulate.ts`, surfacing `query` to the model as a per-question `instruction`. Forward-compatible: widening `fileVariable` to an array, or adding an `applicationDataQuery` for the (future) JSON-application-details scenario, won't break the parser.

### W. Evidence file mapping persists in `dnx_evidence_mapping` (a real column — the one exception)

Unlike the JSON-in-existing-column tricks elsewhere, the assessment-time variable → uploaded-file mapping is stored in a **dedicated** `dnx_evidence_mapping` multiline-text column on `dnx_assessment_instances` (created + synced by the user). The instance table had no spare free-text column to safely reuse (`dnx_outcome_notes` is taken by reviewer feedback), so a new column was the clean call.

`useSaveEvidenceMapping` writes `JSON.stringify({ [variable]: realFileName })` (empty string when nothing's mapped) and patches the detail cache optimistically. It deliberately **does not bump `dnx_version` or write a snapshot** — the mapping is auto-fill scaffolding, not an answer, so it must not pollute the version count or audit trail. `AiPopulateDialog` takes the raw JSON string as a prop (not a parsed object — keeps the parent from churning object identity every render) and parses it inside a `useMemo`; the persisted pick is the base the assessor's per-session overrides layer on top, with a name-match guess as the final fallback.

### X. Custom letter layout is sanitized HTML in `dnx_letter_template_json`

The letter builder (M8b.1) persists an ordered **block list** as JSON in the dedicated `dnx_letter_template_json` column on `dnx_assessment_templates` (user-created + synced). Each block is `{ id, type, … }` — see `LetterBlock` in `letterLayout.ts`. Rich-text blocks (heading / text / signature) store **HTML** in their `text` field, so the whole thing must be sanitized on the way in and out.

- **Sanitizer** (`sanitizeHtml.ts`): a hand-rolled allowlist (no dependency). Keeps `b/i/u/strong/em/span/br/div/p/ul/ol/li` + only safe inline styles (`font-weight/style/text-decoration/font-size/color/text-align`), clamps `font-size` to 9–48px, preserves the answer chip's `class`+`data-level`+`color`, drops everything else. Run on **save** (in `TokenTextEditor.emit`) and again on **render** (in `LetterPreview`, before `dangerouslySetInnerHTML`).
- **Rendering**: `resolveLetterHtml(stored, values, answerByLevelId, sanitize)` turns a block's stored value into final letter HTML — swaps each `<span class="tok-chip" data-level>` for that question's formatted answer (`—` when blank; keeps the chip's colour), expands `{placeholder}` merge tokens (`{candidate}`, `{outcome}`, …) inside text nodes, then sanitizes. Handles a legacy plain-text value too (escape + newline→`<br>`).
- **Back-compat**: no layout → `DEFAULT_LAYOUT` (the original fixed letter expressed as blocks), so old templates + the `html2canvas`+`jsPDF` export render exactly as before. `useSaveLetterLayout` is a targeted PATCH of just this column.
- Answer tokens have two on-disk shapes: the chip span (HTML blocks) and a legacy `{{q:<levelId>|name}}` string — both resolve. The editor migrates the legacy token to a chip on load.

### Y. contentEditable answer chips — caret + selection quirks

`TokenTextEditor` is a content-editable rich-text field; the answer chips are `contenteditable=false` inline spans (atomic — backspace removes the whole chip). Three quirks that bit us and how they're handled:

1. **Caret can't sit "after" a trailing atomic element.** A plain trailing space gets trimmed at block end (trapping the caret inside/against the chip); an `&nbsp;` renders as a visible gap that stacks with a typed space. Fix: insert a **zero-width space** (`U+200B`, the `ZWSP` const) after each chip as an invisible, non-collapsing landing spot, and **strip it on serialize** so it never reaches storage.
2. **Colour / font-size need a real selection.** `execCommand('foreColor' | 'fontSize')` with a collapsed caret tries to "arm" the next keystroke, which mis-attaches to the wrong character. So `applyColor` / `applyFontSize` **no-op unless text is selected**.
3. **Colouring a chip.** The chip's `.tok-chip` class sets a default purple; to recolour it the code sets the chip's **inline `color`** (inline beats class). The touched chips must be read from the selection **before** `execCommand` runs (it collapses the range), and `.tok-chip` must NOT be `user-select: none` or the selection can't include it.

Render-from-model only happens when `value` differs from what we last emitted (`lastEmitted` ref), so typing never resets the caret; the imperative insert handle is routed through a ref updated in an effect to avoid a render-time forward reference (`react-hooks/refs`).

### Z. Grouped-subsections block matches its group-by question by NAME, not level id

M8b.2's design went through three revisions before landing here — worth recording why. The first cut tagged individual subsections with an author-picked reason code (a `dnx_reason_code` column). That was wrong: the actual structure is repeated subsections (e.g. 5 "Qualification" subsections under one Section), each containing its **own instance** of a grouping question (e.g. each has its own "Reason" option-set question — same name, distinct level id, distinct answer). There is no single question whose id could drive the grouping; the only thing that generalises across the repeated subsections is the question's **name**.

So `buildGroupedSubsections` (`letterData.ts` — moved out of `LetterPreview.tsx` when the Word exporter needed the same logic, see gotcha AA) takes a `sectionLevelId` + `groupByQuestionName` from the block config, and for each of that section's *direct* subsections, does `sub.children.find(c => c.level.dnx_name.trim() === groupByQuestionName)` to locate that subsection's own copy of the question, then reads its answer. This is why the block config asks for a **name string**, not a level-id reference like the answer-chip tokens (`{{q:<levelId>|name}}`) use elsewhere in the letter builder — those resolve one specific question on one specific assessment path, while this needs to resolve "the same-named question, wherever it recurs."

Consequences:
- Renaming the group-by question on one subsection but not its siblings breaks matching for that subsection only (silently — it just won't be grouped). No warning surfaces today.
- The block is deliberately **not** a singleton (unlike outcome/meta/notes/responses) — a letter can have several, one per section that needs this treatment.
- The `dnx_reason_code` column (created for the abandoned first revision) is still synced in the schema but unused by any code — harmless to leave, safe to drop if you want to tidy the table.
- The builder's live preview always uses placeholder sample data with **zero responses**, so this block can never show content there by construction (every subsection's group-by answer resolves blank → filtered out). The block's own editor panel says so; verify grouping only on a real assessment's View letter.

### AA. Word export builds a real `docx.Document`, not a rasterised image — and why `letterData.ts` exists

The PDF export (`html2canvas` + `jsPDF`) rasterises the rendered letter DOM into a PNG and pages it into a PDF — fine for a fixed, non-editable output, but it means the PDF has no real text, just an image. Word needed a genuinely different approach: build actual `docx.Paragraph`/`TextRun`/`Table` elements via the `docx` library (client-side, no server) so the result is real, editable text.

Doing that required a second full walk of the letter's blocks — `letterToDocx.ts` mirrors `LetterPreview`'s render switch exactly (heading/text/meta/outcome/reviewerNotes/responses/groupedSubsections/signature/spacer), but emits `docx` elements instead of JSX. Rather than let the data assembly (outcome computation, meta values, per-question answers, the section/subsection tree, `buildGroupedSubsections`) live duplicated in two places and risk drift, it was extracted into `letterData.ts` as a pure function `buildLetterData(assessment, levels, responses, criteriaByLevelId)`. Both `LetterPreview` (JSX render) and `letterToDocx` (docx render) call it and get identical `LetterData` — the same outcome label, the same resolved answers, the same section tree. Only the *painting* differs.

Rich-text blocks (heading/text/signature) store sanitized HTML (gotcha X); `htmlToDocx.ts` walks that HTML and maps the sanitizer's allowlisted tags/styles onto `docx` run properties — `B`/`STRONG`→bold, `I`/`EM`→italics, `U`→underline, inline `font-size`→`size` (converted px→half-points), inline `color`→hex (`rgb()` and `#hex` both handled), `UL`/`OL`/`LI`→bulleted/numbered paragraphs via a text prefix (`docx`'s native numbering requires more setup than this app's letter needs). `htmlToDocxRuns` (flat runs, for single-line blocks like the heading) and `htmlToDocxParagraphs` (one paragraph per DIV/P/list-item) share one internal line-walker so there's exactly one place that knows the sanitizer's allowlist.

The Word document sets its **default run font to Calibri** (`styles.default.document.run.font`) so the export matches the app's sans-serif look — without it, Word falls back to Times New Roman. Inter (the on-screen font) isn't Word-installed and embedding it would bloat the file, so Calibri is the close, zero-cost stand-in; every paragraph + heading inherits it since no run sets its own font. (The PDF is unaffected — it rasterises the Inter DOM, so it always matches the preview exactly.)

Both exports ultimately read from the SAME `LetterLayout` + `LetterData` — a change to one export's block handling that isn't mirrored in the other will only show up as an inconsistency between the PDF/preview and the Word file, not a build error. When adding a new block type, update both `LetterPreview`'s switch and `letterToDocx`'s switch.

### AB. Letter header/footer/background — page-level, not blocks; image in a File column (not Image)

The letterhead (M8b.1+) is deliberately **not** part of the draggable block stream — it's a `page?: PageSettings` object on `LetterLayout` (`letterLayout.ts`): `{ header?, footer? (both sanitized rich HTML), image?: boolean, backgroundMode?: 'cover'|'contain'|'tile', backgroundOpacity?: number, backgroundScale?: number (0.1–1 fraction of page width), backgroundPosition?: 9-point anchor }`. Scale + position let an author place a small corner logo or a faint full-page watermark from the one image; aspect ratio is always preserved (scale acts on width, height follows) so it can never distort. Default mode is **contain**, scale 1, position center. `parseLetterLayout` carries it through (`coercePage`, all fields optional, an all-empty object collapses back to `undefined`), `serializeLetterLayout` persists it inside the same `dnx_letter_template_json` as the blocks. Absent `page` = today's behaviour (built-in brand strip + "Generated by…" footer), so old templates render unchanged.

**Why the image isn't in the JSON, and why it's a File column (NOT Image).** A background image is large binary; base64-ing it into the letter JSON would bloat every autosave + every render of that text column. It lives in a **dedicated Dataverse File column `dnx_letter_background` on `dnx_assessment_templates`** (user-created in the maker portal, synced via `pac code add-data-source -t dnx_assessment_templates`). **Use File, not Image** — Dataverse Image columns downscale + re-encode the upload (thumbnail/max-dimension cap, JPEG re-encode), which visibly pixelated a crisp logo; a **File column stores the exact bytes**. To add it again: Tables → Assessment Templates → new column, **type File**, name `dnx_letter_background`. The generated model then exposes `dnx_letter_background` (ref), `dnx_letter_background_name` (filename), and `Dnx_assessment_templatesUploadColumnName = 'dnx_letter_background'`. (A File column has **no** `_url` or `_timestamp` field — those were Image-only; the first cut used an Image column and had to be migrated.)

**Write path** (gotcha O two-call pattern): the template row already exists, so `useSaveLetterBackground` just pushes bytes via `getClient(dataSourcesInfo).uploadFileToRecord('dnx_assessment_templates', id, 'dnx_letter_background', file.name, bytes)`, then invalidates the detail query so the fresh `dnx_letter_background_name` arrives. The JSON's `page.image` flag is set `true` in the same commit so the renderer knows to load the image. **There is no delete-file SDK method** — "Remove background" flips `page.image = false` (the bytes stay in Dataverse, ignored). The builder guards uploads to ≤ 8 MB.

**Getting a displayable URL.** A File column isn't servable by URL, so `useLetterBackgroundObjectUrl(id, enabled, refreshKey)` (`templates/api.ts`) `downloadFileFromRecord`s the bytes and wraps them in an `URL.createObjectURL` blob URL — the same download call the Word export uses. It only fetches when `enabled` (the layout uses a background) and re-downloads when `refreshKey` changes. Since a File column has no timestamp, the refresh key is `dnx_letter_background_name` **plus a client-side counter** the builder bumps on each upload (so a *same-name* replacement still re-downloads). Both `LetterBuilder` and `LetterDialog` use this hook to feed `LetterPreview`'s `backgroundUrl` prop. (The hook clears its URL asynchronously in the disabled branch to avoid a synchronous `setState`-in-effect lint violation.)

**Rendering.** On screen/PDF: `LetterPreview` takes a `backgroundUrl` prop, renders the header once at top (replacing the brand strip), footer once at bottom, and the background as an absolutely-positioned behind-content layer — a flex `bgAnchor` container spanning the page (its `justify/align` set from the 9-point position) holding a real `<img>` sized to `scale × 100%` of page width with `object-fit: contain|cover` (NOT a CSS `background-image` div; the `<img>` renders reliably and object-fit avoids distortion), or a repeated CSS background for `tile`. Fit mode defaults to **contain** so the whole logo shows aspect-correct; cover fills+crops. The positioned (contain) anchor is **inset to the page's content margins** (the `.page` padding on screen; the docx page margin in Word) so a "top-left" logo lines up with the text, not the paper edge — unless the **Bleed to page edge** toggle (`page.backgroundBleed`, contain-only) is on, which makes it full-bleed like cover. Cover is always full-bleed; tile always tiles the whole page. In **Word** (`letterToDocx.ts` `buildLetterDocxBlob`): a custom header/footer become real **repeating page** `Header`/`Footer` (so the inline brand strip + trailing "Generated by…" paragraph are suppressed when set), and the background is a floating, `behindDocument` `ImageRun` placed on the header. Word has no `background-size`, so `backgroundTransformation(mode, imgW, imgH, scale, position)` computes the image's px width/height from its **intrinsic dimensions** (measured in `LetterDialog` via a throwaway `Image()` load) per the fit mode, multiplies by scale, and anchors it via EMU offsets — this is what stops the earlier full-page stretch. `tile` falls back to `contain` in Word. Bytes are fetched by `LetterDialog` via `downloadFileFromRecord` just before export — non-fatal if it fails. This is a *third* thing to keep in sync per gotcha AA's warning: header/footer/background handling lives in both `LetterPreview` and `letterToDocx`.

### AC. Role gating reads Dataverse security roles via a filtered `roles` query (no `$expand`)

The Power Apps host context (`getContext().user`) exposes the signed-in user's Entra `objectId` but **not** their security roles, and the SDK has **no `$expand`** (verified: `IOperationOptions`/`IGetAllOptions` only have select/filter/orderBy/top; `executeAsync`'s `IDataverseRequest` is metadata/custom-API only — not a raw OData retrieve). The `systemuserrole` intersect table also **couldn't be added as a data source** in this environment. So `useCurrentUserRoles()` (`src/lib/roles.ts`) reads roles in **two filtered queries** against data sources that *could* be added (`systemusers` + `roles`, the latter added as data source `securityroles` → generated `RolesService`):

1. `SystemusersService.getAll({ filter: azureactivedirectoryobjectid eq <objectId>, select: [systemuserid] })` → the caller's `systemuserid`.
2. `RolesService.getAll({ filter: systemuserroles_association/any(u:u/systemuserid eq <systemuserid>), select: [name] })` → the caller's role names.

The `association/any(...)` filter is the key trick — it reaches the many-to-many membership **without** an intersect data source or `$expand`, using only the allowed `filter` string. (Confirmed working at runtime.) Roles are matched by **name** (`ROLE_NAMES`: `Assessor` / `Reviewer` / `Admin`), cached for the session (`staleTime: Infinity`). The built-in `System Administrator` role is **not** treated as app-admin — the three app roles are independent by design, so an admin must hold the explicit `Admin` role. The hook returns `{ isAssessor, isReviewer, isAdmin, canAssess, canReview, canAdmin, isLoading }` where the `can*` flags fold Admin in (Admin implies everything).

**Where it gates** (actions hidden when the role isn't held): Submit / Reopen / AI auto-fill / Mark-resolved + checklist editing → `canAssess` (`AssessmentPage`, `ChecklistRenderer` via a `canAssess` prop that forces read-only + swaps the lock-banner copy); Approve / Reject reviewer panel → `canReview` (`AssessmentPage`); project & template **Delete** → `canAdmin` (`ProjectDetailPage`, `TemplateEditorPage`). Level-delete and the rest of template authoring are deliberately **left open** for now (see the M9 row).

**This is UI-level gating only.** Hiding a button doesn't stop a determined user hitting Dataverse directly — real enforcement comes from the **table privileges** granted to each security role (e.g. a Reviewer role without write on `dnx_assessment_responses`). The UI gating + the role's Dataverse privileges together are what make it enforceable. To set roles up: create `Assessor` / `Reviewer` / `Admin` security roles in the maker portal, grant each the appropriate table privileges, and assign users.

### AD. Application-details JSON (M10) — one sample-shape, three consumers

An assessment can carry a structured **application-details JSON** (facts about the applicant) whose shape is fixed per template. Four new columns:

| Table | Column | Type | Holds |
|---|---|---|---|
| `dnx_assessment_templates` | `dnx_application_schema` | text | author's **sample** JSON (the shape) |
| `dnx_assessment_instances` | `dnx_application_details` | **File** | the per-assessment JSON (bytes) |
| `dnx_assessment_levels` | `dnx_details_layout` | text | per-Section/Subsection list of attribute paths to show |
| `dnx_assessment_responses` | `dnx_ai_source_attributes` | text | JSON array of attribute paths an AI judgement used |

**Path core** (`src/features/applicationDetails/appData.ts`, pure + unit-tested behaviourally): `flattenSchema(sample)` walks the sample into a de-duped list of dot-paths (`applicant.name`, `quals[].title` where `[]` = "each item / first" and `quals[0].title` = an index); `resolvePath(root, path)` / `resolvePaths` read a real instance's JSON by those paths; `formatValue` display-coerces. Authors **never type paths** — they pick from the flattened catalog (same idea as the letter answer-chip picker).

**The three consumers, all off the same flattened catalog:**
1. **Details tab** (`DetailsBuilder.tsx`): paste/edit the sample JSON (autosaved to `dnx_application_schema` via `useSaveApplicationSchema`), then pick a Section/Subsection and **drag-drop** attributes into its details layout (`detailsLayout.ts` parse/serialize, persisted per-level via `useUpdateDetailsLayout` → `dnx_details_layout`). Reuses the letter builder's @dnd-kit + debounced-commit scaffold. A 5th template-editor tab.
2. **AI binding** (`evidenceBinding.ts` gained `applicationDataPaths?: string[]`, edited via a multi-picker in `EvidenceBindingEditor.tsx` — the picker only appears once the template has a valid sample JSON): at auto-fill time `useAiPopulateMapped` resolves each question's bound paths against the instance JSON into a per-question `applicationData` map that `buildPrompt` injects as trusted facts; the model echoes `usedAttributes`, validated against the offered paths, persisted via the upsert `ai.sourceAttributes` → `dnx_ai_source_attributes` and shown in the `QuestionRow` AI badge tooltip. A question can be AI-filled from **evidence only, application-data only, or both**: file-variable questions run in per-file groups (with any bound attrs merged in), while questions with attrs but **no** file variable run in one extra no-evidence AI call (`applicationOnlyQuestions`, gated on the instance actually having an application-details file). `askForGroup` runs as long as there's evidence text OR resolved `applicationData`. The `AiPopulateDialog` Map phase shows these under a "Judged from application data" group (checkboxes, no file dropdown).
3. **Assessment render**: `ApplicationDetailsCard` (on `AssessmentPage`, assessor-only) uploads/replaces the File column (validates JSON client-side; gotcha O one-step `uploadFileToRecord`). `useApplicationDetails(instanceId, enabled, refreshKey)` downloads + parses it (File columns aren't URL-servable — same download-to-value approach as the letter background; refresh key is `dnx_application_details_name` + a client counter). `AssessmentPage` fetches it once and threads it into both the AI dialog and `ChecklistRenderer`, where `DetailsPanel` renders each authored level's attributes.

**Back-compat**: every column is optional — a template/assessment with none behaves exactly as before (no Details tab content, no card file, no prompt injection, no badge attrs). The evidence-binding parser tolerates the new key alongside the legacy shapes (gotcha V).

**Upload validation**: the card warns when the uploaded JSON is missing attributes the template actually **uses** — `collectUsedPaths(levels)` (`usedPaths.ts`) gathers every path bound to an AI question (`applicationDataPaths`) or shown in a details panel (`dnx_details_layout`); `missingPaths(data, paths)` (`appData.ts`) reports which of those don't resolve. `AssessmentPage` passes the used paths as `requiredPaths`; the card shows a warning MessageBar listing the missing ones (they'd otherwise render as “—” / be skipped by AI). Invalid-JSON / oversize still *block* upload; a merely-incomplete file is allowed but warned.

**Repeating-array panels**: a details panel splits its fields into scalar (shown once, two-col grid) and repeating (`[]` path) — repeating fields render **one block per array item** (`#1`, `#2`, …), so a list attribute shows every element. `DetailsPanel` uses `isRepeatingPath` / `arrayLengthForPath` (longest array across the panel's repeating fields = item count) / `resolvePathAt(root, path, i)` (substitutes the first `[]` with `[i]`), all in `appData.ts`. A panel can mix both. **Array-index pin** (`DetailsLayout.arrayIndex`, 0-based, authored 1-based in the Details tab's "Show array item #"): pins the panel's `[]` paths to ONE element instead of iterating — the "N fixed subsections ↔ one JSON array" case (e.g. three "Qualification N" subsections each pinned to `qualifications[0/1/2]`). Unset = list every item. The Details-tab preview renders through the real `DetailsPanel` against the sample JSON so pin/iterate behave identically to the assessment.

**Not yet done** (raised in the plan, deferred): deeper schema-shape validation beyond used-path presence; nested/multi-array panels (one `[]` level only). Provenance (`dnx_ai_source_attributes`) is written on accept but, like the other `dnx_ai_*` columns, is **not** in the audit snapshot (gotcha at `snapshotResponseToColumns`). A **"Seed application-details demo"** seeder exists (`seedApplicationDetailsDemo.ts`) with a sample + instance JSON; `demo-guide.md` §12 walks the feature.

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

**The full assessor → reviewer → AI loop is shipped.** M0–M7d, M8a, M8c.1–4, and **M6b** are all done: template authoring (tree + scoring + conditional visibility + per-question AI bindings), assessment runtime with autosave, submit/reopen/approve/reject, evidence upload + OCR, AI auto-fill with file mapping, outcome letter + PDF, dashboard, threaded comments, version history + revert.

What's left is folded into the **Where we are right now** milestone table near the top — see the `TODO:` notes on the **M6b** (AI follow-ups) and **M9** (hardening + polish) rows. **M8b is fully shipped** (both M8b.1 and M8b.2).

### Known baseline lint debt

`react-hooks/set-state-in-effect` (a recent plugin rule) flags two pre-existing form-reset effects — `AssessmentPage` (`setLastSavedAt`) and `LevelDialog` (form prefill). `npm run lint` reports these as errors but the build is unaffected. Don't add new violations; clean these up if touching those effects.

## Useful links

- Microsoft docs for CRUD against Dataverse: https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse
- The official Code Apps sample: https://github.com/microsoft/PowerAppsCodeApps/tree/main/samples/Dataverse
