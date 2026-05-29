# IntelliAssessment V1 — Project Context

> Read this first when returning to the project. Last updated: 2026-05-30 (M4b + polish round shipped).

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
| **M4c** Version bump + audit snapshots | ⏳ next | Bump `dnx_assessment_instances.dnx_version` on save, snapshot to `dnx_assessment_versions`, surface "v14" in the autosave badge per design.md §11 |
| **M5** Evidence files + SharePoint | not started | |
| **M6** AI pipeline (OCR + extraction) | not started | |
| **M7** Rule engine & scoring | not started | |
| **M8** Collaboration, versions, reporting | not started | |
| **M9** NFRs, QA, deployment | not started | |

## Currently working features

- **Projects** — full CRUD (list, detail, create, edit, delete) wired to `Dnx_projectsService`. Flat cards with status pills (Active / On Hold / Archived / Inactive).
- **Templates** — full CRUD on top-level template records (`Dnx_assessment_templatesService`). Lifecycle status (Draft / Published / Deprecated), **Publish** action that bumps version + stamps `dnx_published_on` (uses `Edm.Date` format, see gotcha B).
- **Template tree editor** — Section → Subsection → Question authoring under each template via `Dnx_assessment_levelsService`. Contextual add menus respect the allowed-children rules. Question fields support all 5 data types (Boolean / Option set single / Option set multi / Text / Date) with inline custom option sets stored as JSON in `dnx_option_set_reference`. Required flag + Include-in-letter flag (purple dot in tree) + hint text + document-type reference. Cascade-delete walks the subtree depth-first.
- **Drag-reorder + duplicate** — Drag the 6-dots grip handle on any tree row to reorder. **Cross-parent moves now supported** (Question between Sections, Subsection between Sections) — `useMoveLevel` re-binds the `dnx_Parent_Assessment_Level` lookup + bumps trailing siblings; drops between mismatched level types are silently rejected. Each row's kebab menu also exposes **Duplicate**, which deep-copies the subtree in parallel within each level and **inserts the copy immediately after the source** (trailing siblings shifted up by 1). Reorders write only the rows whose order actually changed; cache updates optimistically with rollback on failure. Every icon button has a Fluent tooltip.
- **Conditional visibility (authoring + runtime)** — Each Question's edit dialog has a *Visibility* section. Toggle "Conditional visibility" on, pick a source Question (Boolean / OptionSet / Multiselect), pick an operator (`equals`/`not equals` for single-value sources, `includes`/`does not include` for Multiselect), pick a value from the source's option list. The rule JSON is stored in `dnx_visibility_condition`. **At runtime** the checklist evaluates each rule against the current responses and hides non-matching questions with a smooth `max-height + opacity + translateY` reveal transition (CSS classes `reveal-show` / `reveal-hide` in `index.css`). Multiselect parents follow contains-semantics per the contract in `visibility.ts`. The source-question dropdown is grouped by parent path (`Section › Subsection`) so duplicate names are disambiguated.
- **Assessment instance CRUD** — *Start assessment* button on each project's detail page opens a dialog that lets the user pick a Published template (Draft/Deprecated templates filtered out) and optionally set a due date. Name pre-fills to `<project> — <today>`. Both `dnx_Project` and `dnx_AssessmentTemplate` lookups bound via `@odata.bind`. The project detail page shows all instances under that project; the global `/assessments` page lists every instance across all projects with status pills (Draft / In progress / Pending review / Complete).
- **Assessment runtime (M4b)** — Open any assessment instance and you get a fillable checklist of the template's level tree. Each Section is a collapsible card with a *N / M answered* summary; Subsections render as nested blocks; Questions render with their label, required asterisk, purple letter-flag dot, and per-data-type input (Boolean Yes/No toggle • OptionSet single dropdown • Multiselect checkbox group • multi-line Text textarea • native Date picker). Every change upserts a row in `dnx_assessment_responses` keyed by (instance, level); the matching `dnx_response_*` column is written and the other four are explicitly blanked. Text fields **debounce at 800 ms** so we get one write per pause; Boolean/OptionSet/Multi/Date fire immediately. A small **autosave indicator** in the hero meta row cycles through *Autosave on* → *Saving...* (purple pulse) → *Saved at HH:MM* (green check) → *Save failed — retry* (red error).
- **Dashboard** — placeholder stat tiles + outcome breakdown card (counts are `—` until M8).
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

**M4b is shipped** along with a polish round (autosave badge, smooth conditional reveal, insert-duplicate-adjacent-to-source, cross-parent drag in the template tree). The natural next chunk is **M4c — Version bump + audit snapshots**.

Concrete starting tasks for M4c:

1. **Bump `dnx_assessment_instances.dnx_version`** inside `useUpsertResponse`'s `onSuccess` — read current version from cache, increment by 1, write back. Surface the new version in the autosave badge ("Saved at 14:32 · v15") per design.md §11.
2. **Snapshot to `dnx_assessment_versions`** on every save (or batched at submit-time). Each row stores `dnx_snapshot_json` (full instance state at this version), `dnx_version_number`, and `_dnx_assessment_value` link. Snapshot the responses array + outcome + statuscode.
3. **Submit-for-review action** — currently `statuscode` stays at `Draft` forever. Add a "Submit" button that flips it to `PendingReview` (778540003) when all required questions answered. Block submit + show inline validation when any required question is empty or invisible-but-required.
4. **(Stretch) Reviewer comments** — PRD §6.10 has `dnx_reviewer_comments`. A "Comments" tab on the instance page; threaded via `parent_comment_id`. Probably its own milestone (M5+); skip unless asked.

Remaining polish items that didn't fit this round:

- **Code-split with React.lazy()** — bundle is ~830 kB / 240 kB gzipped; route-level splitting would meaningfully drop the first-paint cost.
- **Multi-value visibility rules** — currently a rule has a single RHS value. The runtime contract is forward-compatible (`value: string[]` would migrate cleanly with a parser update). Add when there's actual demand.
- **Section progress bars** in the assessment runtime header — visual `answered / total` ring per section, plus an overall instance progress.
- **Mobile responsiveness audit** — the topbar nav + tree editor haven't been tested at narrow viewports.

## Useful links

- Microsoft docs for CRUD against Dataverse: https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse
- The official Code Apps sample: https://github.com/microsoft/PowerAppsCodeApps/tree/main/samples/Dataverse
