# Blueprint Quality Checklist

Six audit check categories used by Phase 5 (Refine). Each check defines what to scan, pass/fail criteria, severity classification, and how to generate the `RF-NN` item description.

---

## Check 1: Verbatim Completeness

**Purpose:** Ensure that content types which must never be paraphrased are present verbatim in the specs.

### What to scan
Grep all `specs/*.md` files for these paraphrase signals:
- `"describes"` — suggests the content was described rather than copied
- `"similar to"` — suggests approximation
- `"outlines"` — suggests summarization
- `"roughly"` — suggests approximation
- `"appears to"` — suggests inference rather than copy
- `"approximately"` — suggests rounding

### Content types that must be verbatim
For each spec, verify these content types appear verbatim (not paraphrased):

| Spec | Content type | Verbatim required |
|------|-------------|------------------|
| `prompts.md` | System prompts, user prompt templates | Every character |
| `prompts.md` | Tool/function JSON schemas | Full schema including descriptions |
| `prompts.md` | Model config objects | Exact values (temperature, max_tokens) |
| `visual-foundations.md` | GLSL shader source | Full shader verbatim |
| `visual-foundations.md` | CSS custom property values | Exact hex/rgba/hsl |
| `visual-foundations.md` | `@keyframes` definitions | Full keyframe verbatim |
| `animation-trace.md` | Framer Motion variant objects | Full object verbatim |
| `animation-trace.md` | Spring/physics config | Exact stiffness/damping values |
| `types.md` | TypeScript interfaces/types/enums | Full definition verbatim |
| `types.md` | Zod/Yup schemas | Full schema verbatim |
| `assets.md` | Inline SVG `<path d="...">` | Full path data verbatim |
| `i18n.md` | Translation string values | Exact English text |
| `i18n.md` | Inline ternary string expressions | Full ternary expression |
| `interaction-catalog.md` | Form validation error messages | Exact error text |

### Pass criteria
- No paraphrase signals found in sections covering the above content types
- Each listed content type is present in the corresponding spec

### Fail criteria
- Paraphrase signal found in a verbatim-required section
- A verbatim-required content type is missing entirely from its spec

### Severity classification
- **Fatal:** Prompts, shaders, GLSL, type definitions, Zod schemas paraphrased or missing
- **High:** Animations config, SVG paths, form error messages paraphrased or missing
- **Medium:** Translation values, inline ternaries described rather than copied

### RF-NN item format
```
`RF-NN` {spec-file}: {content-type} {paraphrased/missing} — {specific location, e.g., "extract verbatim from Component.tsx:108"}
```

Examples:
- `RF-01` prompts.md: system prompt paraphrased at line 45 — extract verbatim from AIService.ts:23-67
- `RF-02` types.md: `UserPreferences` interface missing — extract from types/user.ts verbatim

---

## Check 2: Cross-Reference Completeness

**Purpose:** Ensure specs are linked to their companion docs so the spec set is navigable as a whole.

### What to scan
For each spec file, check for the presence of a `**Companion docs:**` line at the top.

### Required cross-references per spec

| Spec | Must link to |
|------|------------|
| `{view}.md` | `visual-{view}.md`, `edge-cases.md`, `interaction-catalog.md` |
| `visual-{view}.md` | `{view}.md`, `visual-foundations.md`, `visual-mobile.md`, `animation-trace.md` |
| `visual-foundations.md` | `animation-trace.md`, `visual-mobile.md` |
| `animation-trace.md` | `visual-foundations.md`, `interaction-catalog.md` |
| `interaction-catalog.md` | `edge-cases.md`, `animation-trace.md` |
| `i18n.md` | `interaction-catalog.md` |
| `types.md` | `{view}.md`, `edge-cases.md` |
| `assets.md` | `visual-foundations.md` |
| `edge-cases.md` | `{view}.md`, `interaction-catalog.md` |
| `visual-mobile.md` | `visual-foundations.md` |
| `prompts.md` | `edge-cases.md`, `{view}.md` |
| `known-gaps.md` | `rebuild-readiness.md` |

### Pass criteria
All required companion doc links present in each spec.

### Fail criteria
A required link is missing from the Companion docs line.

### Severity classification
- **Medium:** Missing cross-reference (navigability issue, not content issue)

### RF-NN item format
```
`RF-NN` {spec-file}: missing cross-reference to {companion-spec}
```

Example:
- `RF-05` visual-ideation.md: missing cross-reference to animation-trace.md

---

## Check 3: Interaction Completeness

**Purpose:** Verify every interactive element in source code is documented in `interaction-catalog.md`.

### What to scan
Grep all scoped view and component files for event handler patterns:

| Pattern | Framework |
|---------|-----------|
| `onClick=` | React |
| `onChange=` | React |
| `onKeyDown=` | React |
| `onHover=` (Framer) | React |
| `onDragEnd=` | React |
| `@click` | Vue |
| `@change` | Vue |
| `@keydown` | Vue |
| `on:click` | Svelte |
| `on:change` | Svelte |
| `bind:value` | Svelte |
| `(click)` | Angular |
| `(change)` | Angular |
| `disabled=` / `:disabled` / `[disabled]` | All |

Also grep for `<button`, `<input`, `<select`, `<textarea` elements.

### Cross-reference against `interaction-catalog.md`
For each found interactive element (by component + line number), verify an entry exists in the catalog.

### Pass criteria
Every interactive element found in grep appears in `interaction-catalog.md`.

### Fail criteria
An interactive element is found in source but has no entry in the catalog.

Count: number of uncatalogued interactions.

### Severity classification
- **High:** Interactive elements with side effects (API calls, navigation, state mutations) not catalogued
- **Medium:** Display-only interactive elements (tooltips, hover states) not catalogued

### RF-NN item format
```
`RF-NN` interaction-catalog.md: {N} interactive elements in {component-file} not catalogued — add entries for {handler-names}
```

Example:
- `RF-07` interaction-catalog.md: 3 interactive elements in SettingsPanel.tsx not catalogued — add entries for onSaveClick, onThemeToggle, onClose

---

## Check 4: Edge Case Completeness

**Purpose:** Verify every error, loading, and empty state in source code is documented in `edge-cases.md`.

### What to scan
Grep all scoped view and component files for:

| Pattern | What it indicates |
|---------|------------------|
| `try {` / `try{` | Error handling block |
| `.catch(` | Promise error handling |
| `onError` | Error callback |
| `isError` / `hasError` / `error !== null` | Error state variable |
| `loading` / `isLoading` / `isPending` | Loading state |
| `length === 0` / `!items` / `items?.length` | Empty state check |
| `null` / `undefined` check on data | Null safety |
| `AbortController` | Race condition guard |
| `debounce(` / `throttle(` | Race condition guard |
| `retry` / `retryCount` / `maxRetries` | Retry logic |

### Cross-reference against `edge-cases.md`
For each found pattern (by component + approximate line), verify a corresponding entry exists.

### Pass criteria
Every try/catch, error state, loading state, and empty state found in source appears in `edge-cases.md`.

### Fail criteria
A pattern is found in source with no corresponding entry in `edge-cases.md`.

Report count of undocumented patterns grouped by type (error / loading / empty / race).

### Severity classification
- **Fatal:** Uncatalogued error states for critical paths (data fetching, auth)
- **High:** Uncatalogued loading states, uncatalogued race conditions
- **Medium:** Uncatalogued empty states, uncatalogued null checks

### RF-NN item format
```
`RF-NN` edge-cases.md: {N} {error/loading/empty} states in {component} not documented — see {file}:{lines}
```

Examples:
- `RF-08` edge-cases.md: 2 try/catch blocks in DataService.ts not documented — see DataService.ts:45, DataService.ts:89
- `RF-09` edge-cases.md: loading state in ChatView.tsx:34 not documented

---

## Check 5: Responsive Completeness

**Purpose:** Verify every view with responsive behavior has coverage in `visual-mobile.md`.

### What to scan
Grep all scoped view and component files for:

| Pattern | Meaning |
|---------|---------|
| `sm:` | Tailwind `sm` breakpoint |
| `md:` | Tailwind `md` breakpoint |
| `lg:` | Tailwind `lg` breakpoint |
| `xl:` | Tailwind `xl` breakpoint |
| `2xl:` | Tailwind `2xl` breakpoint |
| `@media` | CSS media query |
| `useMediaQuery` | JS breakpoint detection |
| `useWindowSize` | JS viewport size |

For each view file that contains responsive patterns, verify coverage in `visual-mobile.md`.

### Pass criteria
- Every view containing responsive classes/queries has a section in `visual-mobile.md`
- Each responsive class found in a view is referenced in its `visual-mobile.md` section

### Fail criteria
- A view has responsive classes but no section in `visual-mobile.md`
- Specific responsive classes found in source are absent from the spec

### Severity classification
- **High:** An entire view with responsive behavior has no mobile spec coverage
- **Medium:** A view has partial mobile spec coverage (some responsive classes documented, some missing)

### RF-NN item format
```
`RF-NN` visual-mobile.md: {view} has {N} responsive breakpoint usages not documented — covers {sm/md/lg} prefixes in {component}
```

Example:
- `RF-11` visual-mobile.md: SearchView has 8 responsive classes not documented — `md:` and `lg:` prefixes in SearchView.tsx uncovered

---

## Check 6: File Completeness

**Purpose:** Verify every axis marked "done" in `_pipeline.md` has a non-empty output file.

### What to scan
1. Read `specs/_pipeline.md` — extract all rows from the Axes table where Status = `done`
2. For each done axis, check: does the output file exist in `specs/`? Is it non-empty (> 10 lines)?

### Pass criteria
For every axis with Status = `done`:
- Output file exists at `specs/{output-file}`
- File has > 10 lines of content (not just a title and empty sections)

### Fail criteria
- An axis is marked `done` but its output file is missing
- An axis is marked `done` but its output file is ≤ 10 lines (essentially empty)

### Severity classification
- **Fatal:** Any required axis (functional, types, visual-foundations, interaction-catalog, edge-cases) missing or empty
- **High:** Optional axis (prompts, i18n) missing or empty when marked done
- **Medium:** Meta docs (known-gaps, rebuild-readiness) missing or thin

### RF-NN item format
```
`RF-NN` {output-file}: axis marked done but file {missing/empty} — re-run /blueprint extract --axis {axis-name}
```

Examples:
- `RF-13` types.md: axis marked done but file is missing — re-run /blueprint extract --axis types
- `RF-14` visual-mobile.md: axis marked done but file has only 3 lines — re-run /blueprint extract --axis visual-mobile

---

## Severity Classification Summary

| Severity | Meaning | Action required |
|----------|---------|----------------|
| **Fatal** | Blocks rebuild fidelity — critical content is missing or wrong | Must fix before `/blueprint finalize` |
| **High** | Significantly degrades spec quality — likely to cause errors during rebuild | Should fix before shipping specs |
| **Medium** | Minor gaps — navigability or coverage issues, unlikely to block rebuild | Fix if time allows |

## Checklist Item ID Convention

- IDs are sequential across all checks: `RF-01`, `RF-02`, ..., `RF-NN`
- IDs are assigned fresh each time `/blueprint refine` runs (not persisted between runs)
- Resolved items from a previous run (where source now satisfies the check) are dropped
- Items are sorted: Fatal first, High second, Medium last

## Re-runnability

Each `/blueprint refine` run:
1. Clears the existing `## Refine Checklist` section in `_pipeline.md`
2. Re-runs all 6 checks from scratch
3. Generates a fresh ID-sorted checklist
4. Items disappear when the underlying issue is fixed — no manual marking needed (though `[x]` checkboxes are supported for human notes)
