# Assessment Module — UI Design Specification

**Project:** CodeApps Assessment Module  
**Platform:** Microsoft Power Platform (Model-Driven App)  
**Component:** React / TypeScript (CodeApps)  
**Version:** 1.0  
**Status:** Design Draft

---

## 1. Design Principles

The interface follows a flat, minimal aesthetic that integrates natively with the Power Platform shell. The goal is to minimise visual noise so assessors can focus on data capture and decision-making.

- **Flat surfaces** — no gradients, drop shadows, or decorative effects
- **Information density** — show what is relevant at the current task level; collapse what is not
- **Status at a glance** — colour-coded badges and progress indicators make assessment state readable without opening records
- **AI transparency** — AI-populated fields are always labelled with a confidence score and flagged for review when below threshold
- **Live feedback** — outcome letter preview and evaluation summary update in real time alongside the checklist

---

## 2. Colour System

All colours use CSS custom properties for automatic light/dark mode adaptation.

### Semantic colours (CSS variables)

| Token | Usage |
|---|---|
| `--color-background-primary` | Card surfaces, inputs |
| `--color-background-secondary` | Section headers, collapsed states, metric cards |
| `--color-background-tertiary` | Page background, progress tracks |
| `--color-text-primary` | Body text, headings |
| `--color-text-secondary` | Labels, hints, metadata |
| `--color-text-tertiary` | Placeholders, disabled states |
| `--color-border-tertiary` | Default borders (0.5px) |
| `--color-border-secondary` | Hover/emphasis borders |

### Brand & categorical colours

| Ramp | Hex (mid) | Usage |
|---|---|---|
| Purple | `#7F77DD` | Primary action, AI tags, active navigation, letter highlights |
| Green | `#639922` | Suitable outcome, passed section, on-track workload |
| Amber | `#EF9F27` | In-progress state, low-confidence AI warnings, overloaded workload |
| Red | `#E24B4A` | Not suitable, overdue, OCR mismatch |
| Blue | `#378ADD` | In-progress badge |
| Teal | `#1D9E75` | Completed progress fills |
| Gray | `#888780` | Neutral / pending states |

### Status badge mapping

| Status | Badge style |
|---|---|
| In progress | Blue |
| Pending review | Amber |
| Complete | Green |
| Overdue | Red |
| Not started | Gray |
| Suitable | Green |
| Not suitable | Red |
| Pending evaluation | Gray |
| AI-populated | Purple |

---

## 3. Typography

| Role | Size | Weight |
|---|---|---|
| Page title | 18px | 500 |
| Card / section heading | 14px | 500 |
| Body / table cells | 13px | 400 |
| Labels, hints, metadata | 11–12px | 400 |
| Uppercase labels | 11px | 500 · 0.4–0.5px letter-spacing |

Font family: `var(--font-sans)` throughout. Sentence case everywhere — no ALL CAPS headings, no Title Case in prose.

---

## 4. Layout

### Global shell

```
┌─────────────────────────────────────────────────┐
│ Topbar  Logo · Nav tabs · Actions · Avatar       │  52px
├─────────────────────────────────────────────────┤
│ Content area  (20px padding)                    │
│                                                 │
│   Page header  (title + primary action)         │
│   ─────────────────────────────────────────     │
│   Screen content                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Topbar

- Height: 52px, 1px bottom border
- Left: logo wordmark → divider → navigation tabs
- Right: notification icon → user avatar (initials)
- Active tab: `background-secondary` fill, `font-weight: 500`

### Navigation tabs (top-level screens)

1. Dashboard
2. Assessments
3. Checklist
4. Templates

### Card anatomy

```
┌─────────────────────────────────────────────┐
│ Card header  title · subtitle · actions     │  border-bottom 0.5px
├─────────────────────────────────────────────┤
│ Card body    content                        │  18px padding
└─────────────────────────────────────────────┘
```

- Background: `--color-background-primary`
- Border: `0.5px solid --color-border-tertiary`
- Radius: `--border-radius-lg` (12px)

---

## 5. Screens

### 5.1 Dashboard

**Purpose:** High-level operational view for team leads and administrators.

**Layout:** Stat row → two-column middle row → full-width recent assessments table

#### Metric cards (stat row — 4 columns)

| Card | Value | Subtext |
|---|---|---|
| Total assessments | 142 | +12 this month |
| In progress | 38 | 5 overdue (amber) |
| Pending review | 21 | Awaiting sign-off |
| Completed this month | 47 | 83% suitable rate (green) |

Card style: `background-secondary`, no border, `border-radius-md`, 14px/24px label/value.

#### Assessor workload panel

- List of assessors with avatar initials, horizontal progress bar, count, and a status badge (On track / Overloaded / At capacity)
- Progress fill colour: purple for high, teal for mid, coral for critical
- Badge thresholds configured by admin

#### Outcome breakdown panel

- Named horizontal progress bars: Suitable / Not suitable / Pending review
- Second sub-section: AI-assisted field stats (auto-populated %, manual override %)

#### Recent assessments table

Columns: Candidate/Project · Template · Assessor · Status · Due · Outcome · Open link

---

### 5.2 Assessments list

**Purpose:** Full filterable list of all assessment instances.

**Layout:** Page header → toolbar → data table

#### Toolbar

- Search input (220px, left-padded search icon)
- Filter dropdowns: Status · Assessor · Template
- Export button (right-aligned)

#### Table columns

| Column | Notes |
|---|---|
| Assessment | Name (bold) + ID (muted, 11px) |
| Project | Project code |
| Template | Template name |
| Assessor | Abbreviated name |
| Status | Badge |
| Progress | Inline progress bar + % label |
| Due date | Red text if overdue |
| Outcome | Badge |
| Action | "Open →" text link |

Row hover: `background-secondary` fill on all cells.

---

### 5.3 Checklist workspace

**Purpose:** Primary assessment workspace for assessors. The most complex screen.

**Layout:** Page header → two-pane layout (checklist left, summary panel right)

```
┌──────────────────────────────┬────────────────┐
│  Checklist card (tabs)       │  Evaluation    │
│                              │  summary card  │
│                              │                │
│                              │  Outcome       │
│                              │  letter        │
│                              │  preview card  │
└──────────────────────────────┴────────────────┘
   flex: 1                        width: 320px
```

#### Page header actions

- Back arrow → Assessments list
- Autosave version badge (purple)
- Letter preview button
- Run evaluation button
- Submit for review button (primary)

#### Checklist tab

Renders the four-level template hierarchy:

**Level 1 — Section header**

```
[ folder icon ]  Section title         [progress bar]  4/5  [outcome badge]  [chevron]
background-secondary, border-radius-md, cursor pointer (toggle collapse)
```

**Level 2 — Subsection block**

```
┌─ subsection header ──────────────────────────────┐
│  ● Subsection title              [badge]  [Lock] │
├──────────────────────────────────────────────────┤
│  Question list (14px gap between questions)      │
└──────────────────────────────────────────────────┘
border: 0.5px, border-radius-md
```

**Level 3 — Question row**

Each question renders:

1. Label row: question text · required asterisk · AI tag (if applicable) · letter-flag dot (purple, right-aligned, indicates inclusion in outcome letter)
2. Hint text (11px, secondary colour)
3. Input control (type-appropriate — see section 6)
4. If AI-populated: confidence bar + percentage
5. If confidence below threshold: amber alert block

**Collapsed section state**

Collapsed sections show a summary line: "Expand to view N questions · X answered · [Evidence required if applicable]"

#### Details tab

Two-column grid of read-only field pairs: label (11px uppercase) → value (13px). Full-width fields for multi-line content such as notes.

#### Evidence tab

**Uploaded files list**

Each file item: file-type icon (coloured by type) → name + metadata row → download button

Metadata row format: `Section · Declared type · OCR status · Upload date`

OCR mismatch: amber border on item, warning text in metadata ("OCR: Driver's Licence ⚠ Mismatch")

**Upload zone**

Dashed border, centred icon + text + size/type constraint note. Full-width, padding 20px.

#### Comments tab

- Threaded comment list: avatar → author name · timestamp · context (which question/section) → comment body → Mark resolved button
- Replies indented 38px (avatar width + gap)
- New comment: full-width textarea → Post comment button (right-aligned, primary)
- Internal-only disclaimer on textarea placeholder

#### Version history tab

List of version entries: version number → change summary → author · timestamp → Restore button (purple text link). Current version shows a purple "Current" badge instead of a restore button.

#### Right panel — Evaluation summary card

- Overall progress bar (purple fill)
- Section-by-section outcome list: name → badge
- Outcome block (`background-secondary` fill): title label → outcome value → descriptive note

#### Right panel — Outcome letter preview card

- Letter content with live-updating highlighted spans (purple background, darker purple text) for fields pulled from checklist answers
- Legend note: purple dot icon + "Purple-highlighted fields are pulled live from checklist answers"
- Pending fields shown in italic secondary text

---

### 5.4 Templates

**Purpose:** Template management and rule configuration for admins.

**Layout:** Page header → 4-column template card grid → rule chain panel

#### Template cards

- Template icon (36×36, purple background, 18px icon)
- Template name (13px, 500)
- Version + status + section/question counts (11px, secondary)
- Badge row: Published/Draft/Deprecated · AI-enabled (if applicable)
- Usage count + last updated (11px, secondary)
- Action row: Edit button (flex:1) + Duplicate icon button

New template card: dashed border, centred plus icon + label, no fill.

#### Evaluation rule chain panel

Four stacked rule rows connected by down arrows, representing the bottom-up evaluation order:

| Level | Example rule | Config badge |
|---|---|---|
| Question | Institution in Australia → set field = Domestic | Weighted · 20% |
| Subsection | "Is qualification valid?" = Yes → Qualification 1 = Suitable | Boolean · threshold 3 |
| Section | 3 of 5 subsections = Suitable → Qualification Section = Passed | Grouped · 40% weight |
| Assessment | All 3 required sections = Passed → Assessment Outcome = Suitable | All pass |

---

## 6. Input controls

| Question data type | Control |
|---|---|
| Boolean | Two-button toggle group: Yes (green when selected) / No (red when selected) |
| Option set (single) | Native `<select>` dropdown, auto-width |
| Option set (multi) | Checkbox group |
| Text | Single-line `<input type="text">` |
| Multi-line text | `<textarea>` with `resize: vertical`, `min-height: 60px` |
| Date | `<input type="date">` |

All inputs: `0.5px solid --color-border-tertiary` border, `border-radius-md`, `background-primary`, 13px font, 7px vertical padding.

---

## 7. AI field indicators

### AI tag

Inline pill attached to question label. Purple background, sparkle icon, "AI" text. Applied to any field where the answer was or can be auto-populated.

### Confidence bar

Displayed below AI-populated inputs:

```
AI confidence  [──────────────────────]  91%
               progress track (3px high)
```

Colour mapping:
- ≥ 80%: green fill
- 60–79%: amber fill (also triggers low-confidence alert)
- < 60%: red fill (mandatory manual review)

### Low-confidence alert block

Amber background (`#FAEEDA`), amber border, warning triangle icon, 12px text. Displayed inline beneath the affected input when confidence is below the configured threshold.

### Manual override

When an assessor edits an AI-populated field, the system logs `manual_override = true` and records the change in version history with the assessor's identity and timestamp.

---

## 8. OCR document mismatch

When the declared document type and the OCR-verified type differ:

- The evidence file item gains an amber border
- The metadata row shows: `OCR: [Identified type] ⚠ Mismatch`
- An alert is surfaced to the assessor in the Evidence tab

---

## 9. Outcome letter flag

Questions flagged for inclusion in the outcome letter display a small filled purple circle (6×6px) at the right edge of the label row. These same fields are rendered as highlighted spans in the live letter preview panel.

---

## 10. Section locking

Each subsection header includes a Lock button. When activated:

- The subsection becomes `is_read_only = true` in Dataverse
- All inputs within the subsection render as read-only
- A lock icon replaces the Lock button to indicate the locked state
- Locking is only available to users with Reviewer or Admin role

---

## 11. Autosave & version badge

- Progressive autosave triggers on every field change
- The current version number is displayed as a badge in the checklist page header: `Autosaved v14`
- Each save creates a new Assessment Version record capturing the full JSON snapshot, changed-by user, and timestamp

---

## 12. Component spacing reference

| Token | Value | Usage |
|---|---|---|
| Page padding | 20px | Content area inset |
| Card padding | 18px | Card body |
| Card header padding | 14px 18px | Card header |
| Section gap | 24px | Between sections |
| Question gap | 14px | Between questions within a subsection |
| Subsection gap | 10px | Between subsection blocks |
| Grid gap (stats) | 12px | Metric card row |
| Grid gap (two-col) | 16px | Main two-column layouts |
| Right panel width | 320px | Evaluation summary + letter preview |
| Badge padding | 3px 8px | Standard badge |
| Badge radius | 20px | Pill shape |
| Border width | 0.5px | All card and input borders |
| Featured border | 2px | Highlighted/featured card only |

---

## 13. Accessibility notes

- All icon-only buttons carry `aria-label` text
- Decorative icons use `aria-hidden="true"`
- Colour is never the sole indicator of status — badges include text labels
- Required fields are marked with both a red asterisk and `is_required` validation
- Hint text is associated with its question via proximity and visual grouping
- Target WCAG 2.1 AA compliance for keyboard navigation and colour contrast