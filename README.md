# IntelliAssessment V1

A Power Apps **Code App** (React + TypeScript + Vite) embedded in a Model-Driven App, backed by Microsoft Dataverse. Configurable, multi-level assessment module — assessors run structured checklists against reusable templates, capture evidence, auto-evaluate outcomes, and generate outcome letters.

See `context.md` at the repo root for the up-to-date state of the project (milestones, gotchas, schemas).

---

## Evaluation rules — how scoring works

The Assessment Module turns assessor answers into a **Suitable / Not suitable** verdict by cascading pass/fail outcomes up the template tree. This section explains the mental model so a non-engineer can author rules without help.

### The hierarchy

A template has four level types:

```
Template
└── Section            (top-level group, e.g. "Qualifications")
    └── Subsection     (optional middle group, e.g. "Qualification 1")
        └── Question   (a single field the assessor answers)
```

Every level — Section, Subsection, **and** Question — can have **one rule** attached to it. Rules cascade **bottom-up**: question outcomes feed their subsection's rule, subsection outcomes feed the section's rule, and the overall assessment is "Suitable" only when **every section** is suitable.

### Question rules — "did the answer satisfy the rule?"

A question rule has two parts:

| Field | Meaning | Example |
|---|---|---|
| **When the answer** | Which operator to apply | `Is true (Yes)`, `Equals`, `Contains`, `Greater than`, `Less than` |
| **this value** | What to compare the answer against (hidden for unary operators like `Is true`) | `"Passport"`, `2026-01-01` |

The operator dropdown auto-filters to operators that make sense for the question's data type — a Boolean question only offers `Is true` / `Is false`, a Date question offers `Equals` / `Greater than` / `Less than`, etc.

Plus one optional knob:

- **Importance** (default 1) — how heavily this question counts when its parent rolls up with a **% threshold**. A question with Importance 2 counts as two normal questions. Has no effect when the parent uses "Every child must pass". Shown in the Scoring tab as an amber `×2` badge next to the rule.

### Parent rules — "how do the children roll up?"

Subsections and Sections don't have an "answer" — they aggregate their children's outcomes. There are two modes:

- **Every child must pass** — even one failing child fails this level. The strict, audit-friendly default.
- **At least X% must pass** — pass when the share of passing children (weighted by Importance) meets the threshold. Use this for "most of the qualifications must be met" style rules.

### The cascade — worked example

Imagine a subsection "Qualification 1" with three questions:

| Question | Rule | Importance | Assessor's answer | Question outcome |
|---|---|---|---|---|
| Q1 — Valid? | `Is true` | **3** (very important) | Yes | **Suitable** |
| Q2 — Issuer accredited? | `Is true` | 1 | No | Not suitable |
| Q3 — Expiry > today? | `Greater than 2026-05-31` | 1 | 2027-08-01 | **Suitable** |

If the subsection rule is **"At least 50% must pass"**, the math is:
- Weighted points passed: 3 (Q1) + 1 (Q3) = **4**
- Total weighted points: 3 + 1 + 1 = **5**
- Ratio: 4 / 5 = **80%** ≥ 50% → **Suitable**

If you change the rule to **"Every child must pass"**, Q2's failure flips the subsection to **Not suitable** regardless of weights.

The subsection's outcome then becomes one of the inputs to its parent Section's rule, and so on up the tree.

### Where you author rules

Open any template → **Scoring & evaluation** tab. The matrix shows every level in indented hierarchy. Each row is color-coded by type so you can scan it:

- 🟣 Section (purple)
- 🔵 Subsection (blue)
- 🟢 Question (teal)

Click any row to expand the inline editor. Questions with a non-default Importance show an amber `×N` badge alongside the rule chip.

### Where outcomes show up at runtime

While the assessor fills in answers, live outcome chips appear in three places:

1. **Beside each answered question** — green "Suitable" or red "Not suitable" chip
2. **Beside each section / subsection header** — rolled-up outcome based on that level's rule + descendant outcomes
3. **Top-of-checklist Overall outcome banner** — the assessment-level verdict

Hover any chip for a plain-language tooltip explaining why it decided what it did, e.g. *"4 of 5 weighted points passed (80%) — needed 50%. Failed: Q2."* This is what lets reviewers audit the verdict without re-reading the rule definitions.

### Outcomes always read as Suitable / Not suitable

The Dataverse schema retains three pass values (Met / Suitable / Pass) and three fail values (Not met / Not suitable / Fail) for backwards compatibility, but the UI surfaces only **Suitable / Not suitable** everywhere — including legacy rules that picked one of the alternate values. One verdict, no ambiguity.

---

## Stack

- React 19 + TypeScript + Vite 7
- `@microsoft/power-apps` SDK (auto-generated typed services for every Dataverse table)
- Fluent UI React v9 — re-themed flat (purple `#7F77DD` brand, 0.5 px borders, no shadows)
- `@tanstack/react-query` for server state + cache invalidation
- `react-router-dom` v7

---

## React + TypeScript + Vite (original scaffold notes)

This project was bootstrapped from the official Vite + Power Apps Code App template, which provides minimal HMR and ESLint setup.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
