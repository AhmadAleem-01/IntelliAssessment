# IntelliAssessment Design System (v1.0 — "Calm Efficiency")

**Status:** Active — this is the **single canonical UI reference**. All new pages
and all migrations of existing pages MUST follow this document. The Dashboard,
Projects list, Project detail, Assessments list, Assessment detail (incl.
checklist), the app shell, and the AI auto-fill dialog are the reference
implementations — match their patterns.

> History: this replaces an earlier flat-purple spec. The `--color-purple*` brand
> tokens are legacy; new work uses the `--ds-*` tokens below.

---

## 0. How to use this document

When building or changing any screen:

1. Use the **`--ds-*` design tokens** (Section 2) — never hard-code hex except the
   few documented text-on-tint exceptions (e.g. `#047857`, `#b45309`, `#b91c1c`).
2. Reuse the **component patterns** in Section 4 verbatim (cards, pills, buttons,
   segmented control, AI surfaces). Don't reinvent a card or a status pill.
3. Obey the **AI motif rule** (Section 3): violet is for AI only.
4. Obey the **honesty rule** (Section 5): never fabricate a metric the data model
   can't back — omit it or show a truthful equivalent.
5. Verify: `npx tsc --noEmit`, `npx eslint <files>`, `npx vite build` before done.

Tokens live in [`src/index.css`](src/index.css) under the `Design System v1.0`
block. Legacy `--color-*` tokens remain only until every surface is migrated.

---

## 1. Brand & Design Direction

The product is a **focused AI assistant**, not a dense data tool. Core philosophy:
**Calm Efficiency.**

- **Personality:** authoritative, precise, minimalist, reassuring.
- **Colour intent:** **Blue** = standard / interactive. **Navy** = structure &
  navigation. **Violet** = AI, and *only* AI — a non-semantic "this was generated,
  verify it" signal. **Green / Amber / Red** = outcome & status semantics.
- **Feel:** spacious white cards on a light-grey base, generous whitespace, soft
  hover lift, one clear focal action per area.

---

## 2. Design Tokens

Defined in [`src/index.css`](src/index.css). Use the CSS variable, not the hex.

### Brand & surfaces
| Token | Hex | Usage |
|---|---|---|
| `--ds-brand-primary` | `#1A2B3C` | Deep navy — app shell brand mark, nav, high-level headers, segmented-control indicator, dashboard AI hero background |
| `--ds-brand-accent` | `#3B82F6` | Professional blue — primary buttons, links, active nav/tab, icon chips |
| `--ds-brand-accent-hover` | `#2F6FE0` | Primary button hover |
| `--ds-brand-accent-soft` | `#EAF1FE` | Blue tint — icon chips, active nav pill, "in progress" status |
| `--ds-surface-base` | `#F9FAFB` | App/page background, progress tracks, inset areas |
| `--ds-surface-card` | `#FFFFFF` | Cards, workspace containers |
| `--ds-border` | `#E5E7EB` | Standard 1px border for cards, rows, controls |

### AI identity (violet — AI only)
| Token | Hex / value | Usage |
|---|---|---|
| `--ds-ai-primary` | `#8B5CF6` | AI icons, AI value text, glow ring, confidence, AI buttons |
| `--ds-ai-surface` | `#F5F3FF` | Background for AI cards / AI-suggested content |
| `--ds-ai-glow` | `rgba(139,92,246,0.1)` | Soft outer glow on AI-active surfaces |
| `--ds-ai-border` | `rgba(139,92,246,0.45)` | Border on AI surfaces |

### Semantic (outcome & status)
| Token | Hex | Soft tint | Text-on-tint |
|---|---|---|---|
| Suitable / success | `--ds-suitable` `#10B981` | `--ds-suitable-soft` `#E7F7F1` | `#047857` |
| Not suitable / danger | `--ds-not-suitable` `#EF4444` | `--ds-not-suitable-soft` `#FDEAEA` | `#b91c1c` |
| Pending / warning | `--ds-pending` `#F59E0B` | `--ds-pending-soft` `#FDF3E2` | `#b45309` |

> Status pills use `soft tint` background + the darker `text-on-tint` colour + a
> dot in the full semantic colour. These three text-on-tint hexes are the only
> sanctioned hard-coded colours.

### Typography
Font: **Inter** (`--font-sans`). Fluent components hard-set their own font on some
parts (Checkbox/Radio/Field labels) — the global override in `index.css` forces
those back to Inter. When adding new Fluent text parts that mismatch, extend that
override rather than patching per-component.

| Role | Token | Size / weight | Colour |
|---|---|---|---|
| H1 (page title) | `--ds-fs-h1` | 24px / 600 | `--ds-text-strong` `#111827` |
| H2 (card/section header) | `--ds-fs-h2` | 18px / 600 | `--ds-text-heading` `#374151` |
| Body | `--ds-fs-body` | 14px / 400–500 | `--ds-text-body` `#4B5563` |
| Caption (labels, meta, provenance) | `--ds-fs-caption` | 12px | `--ds-text-muted` `#6B7280` |
| Uppercase micro-label | — | 10–11px / 600, `letter-spacing: 0.05em` | `--ds-text-muted` |

### Shape & space
| Token | Value | Usage |
|---|---|---|
| `--ds-radius-card` | `14px` | Cards, panels, hero surfaces |
| (control radius) | `6px` | Boxy inputs/dropdowns (search, sort, range) |
| (nested/pill radius) | `9–12px` | Segmented control, pill buttons |
| `--ds-radius-pill` | `999px` | Status/outcome pills |
| `--ds-space-container` | `32px` | Whitespace-as-a-tool for large containers |
| Card padding | `18–22px` | Standard card internal padding |
| Grid gap | `16px` | Between cards in a row/grid |

---

## 3. The AI Motif (violet — AI only)

AI is a first-class, *identifiable* capability. Every AI touchpoint shares one
violet identity; nothing else in the app may use violet.

**AI surfaces get, in order of prominence:**
1. **Animated glow border** (`.ai-glow-border` in `index.css`) — a rotating violet
   conic-gradient ring. Reserved for **hero AI surfaces**: the dashboard AI card,
   the AI auto-fill dialog, the AI auto-fill trigger button, the selected source
   in the auto-fill dialog. Respects `prefers-reduced-motion`.
   - **Gotcha:** on a Fluent `Button`, the ring is hidden by the button's own
     chrome — wrap the button in a `<span class="ai-glow-border">` with a small
     padding gap instead of applying the class to the button.
2. **Sparkles** (`.ai-sparkle`) — small twinkling stars around a hero AI card
   (dashboard). Decorative, `aria-hidden`, staggered via `--sparkle-delay`.
3. **Soft-violet card** — `--ds-ai-surface` fill + `--ds-ai-border`, for AI
   content that isn't the single hero (e.g. per-answer AI badge, AI-usage tiles).
4. **Violet text/icon** — `--ds-ai-primary` for AI values, the Sparkle icon,
   confidence figures.

**AI content is always a reviewable draft.** Present a clear Accept action;
accepting converts violet "AI" styling into standard navy "verified" styling.
Show confidence as a *supporting* metric, never as final truth. Link AI answers
back to their source (evidence file / application-data attribute).

---

## 4. Component Patterns (reference implementations)

### Card
White (`--ds-surface-card`), `1px solid --ds-border`, `--ds-radius-card`, 18–22px
padding. Header = H2. Optional muted caption on the right of the header
(`space-between`, `align-items: baseline`).

### Status / outcome pill
Rounded-full (`--ds-radius-pill`), **lowercase**, 12px/500, with a **leading dot**
in the full semantic colour; background = soft tint, text = text-on-tint.
Mapping: draft → grey, in progress → blue, pending review/"review" → amber,
complete/"signed off" → green; suitable → green, not suitable → red.

### Buttons
- **Primary:** `--ds-brand-accent` fill, white text, `--ds-brand-accent-hover` on
  hover. (Override Fluent's `appearance="primary"` via a `className`.)
- **Secondary:** neutral, `--ds-border`.
- **Destructive:** transparent with red text + red-tint hover.
- **AI action:** hollow (transparent fill, violet text/icon) wrapped in
  `.ai-glow-border`; bold label. Never a solid violet block for a routine action.

### List row (assessments, queue)
White card row, `1px --ds-border`, `--ds-radius-card`, hover = subtle lift
(`translateY(-1px)`) + soft shadow + border darken (NOT a background swap). Two-line
cell: bold name + muted meta line (`owner · updated Nh ago`). Small square avatar
chip with initials in blue-tint.

### Segmented control (scope toggle)
White rounded container; a **single sliding indicator** (navy `--ds-brand-primary`)
behind equal-width tabs, animated with `transform: translateX(index * 100%)` and a
springy `cubic-bezier(0.34, 1.4, 0.5, 1)`. Text cross-fades muted → white as the
indicator arrives. Active text is forced white (`!important`) so equal-specificity
hover can't dim it. Inactive hover → `--ds-text-body`, never harsh black.

### Boxy inputs / dropdowns (search, sort, date-range)
Squarish `6px` radius, ~40px tall, `1px --ds-border`, white, no Fluent underline
(`::after { display: none }`). **Dropdown gotcha:** put the border on the dropdown
**root only** and make the inner `& button` `border: none` + transparent —
bordering both the root and the button produces a **double border**.

### Progress / bars
Track = `--ds-surface-base`, rounded. Fill must be a **block** element (inline
spans ignore width/height) with a `min-width` so a tiny share still shows.

### Collapsible checklist (assessment detail)
Section = card with an H2 header (hover tint); subsection = nested bordered block
with a blue-accent bullet. Progressive disclosure: don't show everything at once;
lean on collapse. Question rows separated by hairline dividers, not floating gaps.

---

## 5. Layout & Content Principles

1. **Whitespace as a tool** — generous padding; avoid the "wall of text." One
   focal action per area.
2. **Progressive disclosure** — collapse the complete/irrelevant; reveal on demand.
3. **Column ratios** — two-card rows on content-heavy pages use **60/40**
   (`gridTemplateColumns: '3fr 2fr'`), content-heavy card on the left. Collapse to
   one column under 900px.
4. **The "Verify" workflow** — AI drafts, human confirms; the UI makes that
   conversion explicit.
5. **Honesty rule (important).** Never fabricate a metric the data model can't
   back. If the data isn't there (e.g. median-days-in-stage, assessor capacity,
   first-pass approval %, per-row completion %), **omit it or show a truthful
   equivalent** — do not invent numbers. Prefer computing from already-loaded data
   over adding per-row queries.

---

## 6. Do's & Don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Use violet **only** for AI content | Use violet for standard buttons/links/nav |
| Reserve the animated glow ring for hero AI surfaces | Spin a glow ring on every tiny AI badge |
| Use `--ds-*` tokens | Hard-code hex (except the 3 text-on-tint colours) |
| Rounded-full lowercase pills with a dot | Bright bordered rectangular badges |
| Subtle hover lift + shadow on rows/cards | Background-swap or harsh black-text hover |
| Border a dropdown on its root only | Border both root and inner button (double edge) |
| Show confidence as supporting context | Present AI output as final/immutable |
| Omit metrics the data can't back | Fabricate a plausible-looking number |
| Compute from loaded data | Fire a query per row for a dashboard stat |

---

## 7. Migration status

Migrated to v1.0: **Dashboard, Projects list, Project detail, Assessments list
(+ shared `AssessmentList`), Assessment detail + checklist + question rows, app
shell/topbar, AI auto-fill dialog, evidence AI trigger, per-answer AI badge.**

Still on legacy tokens (migrate using this doc when touched): **Template editor
(tabs, tree, AI-conditioning, letter designer, application-details builder),
various dialogs/drawers (comments, history, letter, submit/approve/reject),
seed/demo pages.**

Baseline lint debt to leave alone (pre-existing, not from styling work):
`AssessmentPage` `setLastSavedAt` set-state-in-effect; `ChecklistRenderer`
`rowRefs.current` during render + empty-interface `SubsectionBlockProps`;
`LevelDialog` set-state-in-effect.
