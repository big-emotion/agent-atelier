---
name: blueprint
description: >-
  Produce a specs/ directory of flat markdown files from any frontend codebase.
  Covers 12 axes needed for rebuild/migration. Use when the user asks to
  "spec a codebase", "create a blueprint", "extract specs for migration",
  or wants to document a frontend app for rebuild.
metadata:
  author: Big Emotion
  version: "1.0.0"
  argument-hint: <command> [options] — commands: run, discover, scope, extract, incorporate, refine, finalize
allowed-tools: Read, Write, Glob, Grep, Bash(ls:*), Bash(cat:*), Bash(wc:*), Bash(mkdir:*), Agent(Explore)
---

# Blueprint — Frontend Spec Pipeline

Extract a complete `specs/` directory from any frontend codebase. Covers all 12 axes needed to rebuild or migrate a frontend app. Produces ~80% quality on first pass, refined to ~95% through guided iteration.

**Input:** `$ARGUMENTS` = `<command> [options]`

Commands:
- `discover` — Scan codebase, create `specs/_pipeline.md`
- `scope` — Interactive: select views and axes to spec
- `extract [--view <name>] [--axis <name>]` — Extract specs (all, or resume one)
- `incorporate [--dir <path>]` — Analyze screenshots against visual specs
- `refine [--fix <RF-NN>]` — Quality audit, generate checklist
- `finalize` — Cross-references, known-gaps, rebuild-readiness
- `run` — Auto-advance state machine through all phases

Examples:
- `/blueprint run` — full pipeline from scratch (pauses at scope)
- `/blueprint discover` — scan only, create `_pipeline.md`
- `/blueprint scope` — select views interactively
- `/blueprint extract` — extract all pending axes
- `/blueprint extract --view home` — re-extract one view's functional spec
- `/blueprint extract --axis types` — re-extract just the types axis
- `/blueprint incorporate` — analyze screenshots in `specs/baseline/`
- `/blueprint refine` — run quality audit
- `/blueprint refine --fix RF-03` — address one checklist item
- `/blueprint finalize` — generate cross-refs + meta docs

---

## Phase 0: Parse `$ARGUMENTS`

Read `$ARGUMENTS`. The first token is the command. Parse as follows:

```
If $ARGUMENTS is empty or missing:
  → Print usage help (command list + examples above) and stop.

Commands:
  discover    → Jump to Phase 1
  scope       → Jump to Phase 2
  extract     → Jump to Phase 3
    Flags: --view <name>  (extract only the named view's functional + visual specs)
           --axis <name>  (extract only the named axis)
  incorporate → Jump to Phase 4
    Flags: --dir <path>  (custom screenshot directory; default: specs/baseline/)
  refine      → Jump to Phase 5
    Flags: --fix <RF-NN>  (address a specific checklist item only)
  finalize    → Jump to Phase 6
  run         → Jump to Orchestrator

Unknown command:
  → Print "Unknown command: {token}. Valid commands: run, discover, scope, extract, incorporate, refine, finalize." and stop.
```

---

## Phase 1: Discover (autonomous)

**Goal:** Scan the codebase. Build the inventory. Write `specs/_pipeline.md`.

### Step 1.1 — Detect framework

Read `package.json` (in the current working directory). Check `dependencies` and `devDependencies`:

| Dependency | Framework | Component glob |
|-----------|-----------|---------------|
| `react` or `react-dom` | React | `**/*.{tsx,jsx}` |
| `vue` | Vue | `**/*.vue` |
| `svelte` | Svelte | `**/*.svelte` |
| `@angular/core` | Angular | `**/*.component.ts`, `**/*.component.html` |
| `astro` | Astro | `**/*.astro` |

If none match, set framework = "Unknown" and continue.

### Step 1.2 — Detect styling approach

- If `tailwind.config.ts` or `tailwind.config.js` exists → Tailwind
- If `*.scss` files exist → SCSS
- If `*.module.css` files exist → CSS Modules
- If `styled-components` in deps → styled-components
- May be multiple (e.g., Tailwind + SCSS)

### Step 1.3 — Component inventory

Glob for component files using the framework-specific pattern. Exclude:
- `node_modules/**`
- `dist/**`, `build/**`, `.next/**`, `.nuxt/**`
- `**/*.test.*`, `**/*.spec.*`, `**/*.stories.*`

Count total components found.

### Step 1.4 — View detection

A "view" is a component that represents a route or page. Look for:
- Files in `pages/`, `views/`, `routes/`, `app/` directories
- Files matching `*Page.tsx`, `*View.tsx`, `*Screen.tsx`, `+page.svelte`
- Components referenced directly in a router config (`<Route>`, `createBrowserRouter`, `createRouter`, `RouterModule`)
- The app entry point: `App.tsx`, `main.ts`, `app.component.ts`, `App.svelte`

For each detected view, record: view name (slug-friendly), component file path.

### Step 1.5 — Service layer detection

Glob for:
- `**/*{service,api,store,hook,composable}*`
- Files importing from `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `cohere`, `mistralai`

If AI/LLM service files exist → mark `prompts` axis as applicable.

### Step 1.6 — Determine applicable axes

All projects: functional (per view), visual-foundations, visual-per-view, animations, interactions, i18n, types, assets, edge-cases, visual-mobile.

Optional (if detected):
- `prompts` — if AI service files found
- `known-gaps` — always generated in finalize (not extracted)

### Step 1.7 — Create `specs/_pipeline.md`

Run: `mkdir -p specs/baseline`

Write `specs/_pipeline.md`:

```markdown
# Blueprint Pipeline

## Meta

| Field | Value |
|-------|-------|
| Framework | {detected framework} |
| Styling | {detected styling} |
| Source root | {detected root, e.g., src/} |
| Created | {ISO timestamp} |
| Last phase | discover |
| Last run | {ISO timestamp} |

## Views

| View | Component | Status |
|------|-----------|--------|
{one row per detected view, Status = pending}

## Axes

| Axis | Output file | Status | Notes |
|------|------------|--------|-------|
| functional | {view}.md (per view) | pending | |
| visual-foundations | visual-foundations.md | pending | |
| visual-per-view | visual-{view}.md (per view) | pending | |
| animations | animation-trace.md | pending | |
| interactions | interaction-catalog.md | pending | |
| i18n | i18n.md | pending | |
| types | types.md | pending | |
| assets | assets.md | pending | |
| edge-cases | edge-cases.md | pending | |
| visual-mobile | visual-mobile.md | pending | |
{if prompts detected:}
| prompts | prompts.md | pending | |

## Screenshots

| File | Matched to | Status |
|------|-----------|--------|
(none yet)

## Refine Checklist

(not yet run)
```

### Step 1.8 — Report to user

```
Blueprint Discover complete.

Framework: {framework}
Styling: {styling}
Views found: {N} ({view-name-1}, {view-name-2}, ...)
Components found: {N}
Axes applicable: {N}
Prompts axis: {applicable/not applicable}

Created: specs/_pipeline.md
Created: specs/baseline/ (drop screenshots here for /blueprint incorporate)

Next step: Run /blueprint scope to select which views to spec.
```

---

## Phase 2: Scope (human input required)

**Goal:** Human narrows which views and axes to spec. Update `_pipeline.md`.

### Step 2.1 — Read current state

Read `specs/_pipeline.md`. Extract the Views table and Axes table.

### Step 2.2 — Present views for selection

Output:
```
Views discovered:

{numbered list of views with component file}

Which views do you want to spec?
- Type view names separated by commas (e.g., home, ideation)
- Or press Enter to spec ALL views
- Or type "skip: {names}" to exclude specific views
```

Wait for user response. Update Views table:
- Selected views → Status: `scoped`
- Skipped views → Status: `skipped`

### Step 2.3 — Present axes for selection

Output:
```
Axes that will be extracted:

{list of applicable axes with output file}

All axes are selected by default. Skip any? (type axis names to skip, or Enter to keep all)
```

Wait for user response. Update Axes table:
- Kept axes → Status: `pending`
- Skipped axes → Status: `skipped`

### Step 2.4 — Screenshot reminder

Output:
```
Screenshot integration:
- If you have screenshots of the app, drop PNGs into specs/baseline/
- Run /blueprint incorporate after /blueprint extract to match them against visual specs
- Screenshots are optional — you can skip incorporate and go straight to refine
```

### Step 2.5 — Update `_pipeline.md`

Update Last phase → `scope`. Update Last run timestamp.

Output:
```
Scope saved. {N} views scoped, {M} axes selected.

Next step: Run /blueprint extract to begin extraction.
```

---

## Phase 3: Extract (autonomous, resumable)

**Goal:** For each pending axis, read source, write spec file. Honor dependency order.

### Step 3.1 — Read state

Read `specs/_pipeline.md`. Get scoped views, pending axes.

If `--view <name>` flag: only process functional + visual axes for that view.
If `--axis <name>` flag: only process that specific axis.

### Step 3.2 — Dependency order

Run axes in this order (skip skipped axes, skip done axes):

**Group 1 — Independent (run first):**
1. `types` → `types.md`
2. `i18n` → `i18n.md`
3. `assets` → `assets.md`
4. `functional` → `{view}.md` for each scoped view (can run per-view in order)

**Group 2 — Depends on Group 1:**
5. `visual-foundations` → `visual-foundations.md`
6. `interactions` → `interaction-catalog.md`
7. `prompts` (if applicable) → `prompts.md`

**Group 3 — Depends on Groups 1+2:**
8. `visual-per-view` → `visual-{view}.md` for each scoped view
9. `animations` → `animation-trace.md`
10. `edge-cases` → `edge-cases.md`
11. `visual-mobile` → `visual-mobile.md`

### Step 3.3 — Per-axis extraction process

For each axis to process:

1. Read the corresponding template from `references/axis-templates.md` (the section matching the axis name)
2. Glob and read the source files specified in the template's "What to read" section
3. Extract content following the template's "What to extract" bullet list
4. Write the output file to `specs/{output-file}` using the template's "Output structure"
5. Apply the template's "Quality rules" — especially verbatim requirements
6. Update `_pipeline.md`: set axis Status → `done`

**If the extraction cannot be completed** (source files not found, framework unclear):
- Set axis Status → `partial` with a note in the Notes column
- Continue to next axis

### Step 3.4 — Key extraction rules (always enforced)

These rules apply regardless of which template is being used:

- **Verbatim over paraphrase:** Prompts, schemas, GLSL shaders, SVG paths, translation strings, type definitions — include the actual source code, never summarize
- **Line references:** Cite source as `Component.tsx:108-117` style for every specific finding
- **Companion docs line:** Every spec file opens with a `**Companion docs:**` line linking to related specs
- **Observations section:** Every spec ends with 3-5 non-obvious insights discovered during extraction

### Step 3.5 — Progress reporting

After each axis completes, output one line:
```
✓ {axis-name} → specs/{output-file} ({line-count} lines)
```

After all axes complete:
```
Extraction complete. {N} spec files written to specs/.

{list of output files with line counts}

Next steps:
- Drop screenshots in specs/baseline/ then run /blueprint incorporate
- Or skip to: /blueprint refine
```

Update `_pipeline.md` Last phase → `extract`, Last run → now.

---

## Phase 4: Incorporate (needs screenshots)

**Goal:** Compare screenshots against visual specs. Flag discrepancies.

### Step 4.1 — Check for screenshots

Glob `specs/baseline/*.png` (or custom `--dir` path).

If no PNGs found:
```
No screenshots found in specs/baseline/.

Add PNG screenshots to specs/baseline/ and re-run /blueprint incorporate.
Alternatively, proceed to /blueprint refine to audit spec quality without screenshot validation.
```

Update `_pipeline.md` with note: "No screenshots provided. Visual accuracy unverified." Stop.

### Step 4.2 — Match screenshots to specs

For each PNG file, attempt to match to a visual spec:
- Filename heuristic: `home-idle.png` → look for `visual-home.md`
- `ideation-loading.png` → look for `visual-ideation.md`
- Strips state suffixes: `-idle`, `-loading`, `-hover`, `-empty`, `-error`, `-mobile`
- If no match found, note as unmatched in `_pipeline.md` Screenshots table

### Step 4.3 — Visual comparison (per matched screenshot)

For each matched pair (screenshot → spec):

1. Read the screenshot image (multimodal read)
2. Read the corresponding `visual-{view}.md`
3. Compare what is visible in the screenshot against what the spec describes
4. Identify discrepancies:
   - Elements visible in screenshot but not mentioned in spec
   - Spec describes elements not visible in screenshot
   - Color/typography/spacing appears to differ from spec description
   - Layout differs from spec description

### Step 4.4 — Write corrections

For each spec with discrepancies, append:

```markdown
## Screenshot Corrections

*Source: specs/baseline/{filename}.png*

### Added (visible in screenshot, missing from spec)
- [description of element and where to add it in the spec]

### Removed (in spec but not visible in screenshot)
- [description of element that should be removed or marked uncertain]

### Corrections
- [spec says X, screenshot shows Y — update to reflect screenshot]
```

### Step 4.5 — Update `_pipeline.md`

Update Screenshots table with match status and correction summary.
Update Last phase → `incorporate`, Last run → now.

```
Screenshot incorporation complete.

{N} screenshots matched to specs
{M} discrepancies found across {K} specs
{P} screenshots unmatched

Specs updated with ## Screenshot Corrections sections.

Next step: /blueprint refine
```

---

## Phase 5: Refine (re-runnable quality audit)

**Goal:** Run all 6 quality checks. Generate a prioritized `RF-NN` checklist.

If `--fix <RF-NN>` flag: read `_pipeline.md` to find the item, address only that item, re-run that check category only.

### Step 5.1 — Read quality checklist

Read `references/quality-checklist.md`. The 6 checks are:
1. Verbatim Completeness
2. Cross-Reference Completeness
3. Interaction Completeness
4. Edge Case Completeness
5. Responsive Completeness
6. File Completeness

### Step 5.2 — Run each check

For each check, follow the instructions in `references/quality-checklist.md` exactly:
- Grep the appropriate files with the specified patterns
- Cross-reference findings against the specs
- Classify failures by severity (Fatal / High / Medium)
- Generate `RF-NN` items using the specified item format

Assign sequential IDs starting at `RF-01` across all checks. Fatal items first, then High, then Medium.

### Step 5.3 — Update `_pipeline.md`

Replace the `## Refine Checklist` section with:

```markdown
## Refine Checklist

*Last run: {ISO timestamp}*
*{N} total items: {F} Fatal, {H} High, {M} Medium*

### Fatal (blocks rebuild fidelity)
- [ ] `RF-01` ...
- [ ] `RF-02` ...

### High (degrades quality)
- [ ] `RF-03` ...

### Medium (nice to have)
- [ ] `RF-04` ...
```

If zero items:
```markdown
## Refine Checklist

*Last run: {ISO timestamp}*
*All checks passed. 0 items.*
```

Update Last phase → `refine`, Last run → now.

### Step 5.4 — Report to user

```
Refine complete.

{N} items found: {F} Fatal, {H} High, {M} Medium

{if Fatal items:}
Fatal items must be resolved before /blueprint finalize:
{list RF-NN items with description}

{if no Fatal items:}
No fatal items. Ready to run /blueprint finalize.

To fix a specific item: /blueprint refine --fix RF-NN
To fix all and re-audit: edit specs, then re-run /blueprint refine
```

---

## Phase 6: Finalize (autonomous)

**Goal:** Add cross-references, generate `known-gaps.md` and `rebuild-readiness.md`.

### Step 6.1 — Cross-references pass

Read all spec files in `specs/`. For each spec, check the `**Companion docs:**` line against the required cross-references defined in `references/quality-checklist.md` (Check 2 table).

Add any missing companion doc links to the appropriate spec file's Companion docs line. Do not remove existing links.

### Step 6.2 — Generate `known-gaps.md`

Scan all spec files for:
- The word "unclear"
- The phrase "not documented"
- Paraphrase signals: "similar to", "appears to", "roughly", "approximately"
- Empty sections in specs (heading present but no content below it)
- `## Screenshot Corrections` sections (indicates visual inaccuracies)
- Axes with Status = `partial` in `_pipeline.md`

Write `specs/known-gaps.md` following the template in `references/axis-templates.md` (Axis 12).

### Step 6.3 — Generate `rebuild-readiness.md`

Read `specs/_pipeline.md` Refine Checklist. Count items per axis.

Assign confidence per axis:

| Condition | Confidence |
|-----------|-----------|
| No items, no gaps | High |
| 1-2 Medium items only | High |
| 1-2 High items | Medium |
| Any Fatal items | Low |
| Axis not extracted (skipped/partial) | Low |

Write `specs/rebuild-readiness.md`:

```markdown
# Rebuild Readiness

**Generated:** {ISO timestamp}

## Summary

| Axis | Output file | Confidence | Items |
|------|------------|-----------|-------|
| functional | {view}.md | {High/Medium/Low} | {N fatal, M high} |
| types | types.md | {confidence} | |
| visual-foundations | visual-foundations.md | {confidence} | |
| ... | ... | ... | ... |

**Overall confidence:** {weighted average: Fatal axes → Low, all High → High, mixed → Medium}

## Recommended Next Steps

{if Low confidence axes exist:}
Before rebuilding:
1. Resolve Fatal items in /blueprint refine checklist:
   {list fatal items}

{if Medium confidence axes exist:}
Consider resolving before rebuild:
{list High-severity items affecting those axes}

{if all High confidence:}
Spec set is ready for rebuild. All axes at High confidence.

## Known Limitations

{From known-gaps.md — list the Hard to Document items as a summary}
```

### Step 6.4 — Update `_pipeline.md`

Update Last phase → `finalize`, Last run → now.

```
Finalize complete.

specs/ now contains {N} files:
{list of all spec files with line counts}

Rebuild readiness:
{per-axis confidence summary}

Overall confidence: {High/Medium/Low}

{if Low: "Resolve fatal items before rebuilding."}
{if Medium: "Review known-gaps.md before rebuilding."}
{if High: "Spec set is ready for rebuild."}
```

---

## Orchestrator: `/blueprint run`

**Goal:** Auto-advance through phases based on `_pipeline.md` state.

Read state from `specs/_pipeline.md` if it exists. Check `Last phase` field.

```
No specs/_pipeline.md found:
  → Run Phase 1 (discover)
  → After discover: pause and print "Run /blueprint scope to select views."

Last phase = discover:
  → Pause: "Run /blueprint scope to select views and axes."

Last phase = scope:
  → Run Phase 3 (extract, all pending axes)
  → After extract: check specs/baseline/ for PNGs
      If PNGs found → Run Phase 4 (incorporate) → Run Phase 5 (refine)
      If no PNGs   → Run Phase 5 (refine)

Last phase = extract:
  → Check specs/baseline/ for PNGs
      If PNGs found → Run Phase 4 → Run Phase 5
      If no PNGs   → Run Phase 5

Last phase = incorporate:
  → Run Phase 5 (refine)

Last phase = refine:
  → Read Refine Checklist from _pipeline.md
      If Fatal items exist → Pause: "Fix fatal items first, then re-run /blueprint run"
                             List the fatal items
      If no Fatal items   → Run Phase 6 (finalize)

Last phase = finalize:
  → Print "Blueprint complete."
  → List all specs files with line counts
  → Print overall confidence from rebuild-readiness.md
```

---

## Appendix A: Axis Quick Reference

| # | Axis | Output file | Group | Optional |
|---|------|------------|-------|---------|
| 1 | Functional | `{view}.md` | 1 | No |
| 2 | Visual Design | `visual-foundations.md` | 2 | No |
| 3 | Visual Per-Page | `visual-{view}.md` | 3 | No |
| 4 | Animations | `animation-trace.md` | 3 | No |
| 5 | Interactions | `interaction-catalog.md` | 2 | No |
| 6 | i18n | `i18n.md` | 1 | No |
| 7 | Types | `types.md` | 1 | No |
| 8 | Assets | `assets.md` | 1 | No |
| 9 | Edge Cases | `edge-cases.md` | 3 | No |
| 10 | Mobile/Responsive | `visual-mobile.md` | 3 | No |
| 11 | Service Layer | `prompts.md` | 2 | Yes (if AI) |
| 12 | Known Gaps | `known-gaps.md` | — | Generated in finalize |

Extraction templates for all 12 axes are in `references/axis-templates.md`.
Quality audit rules for all checks are in `references/quality-checklist.md`.

---

## Appendix B: Output Conventions

### File naming
- Functional spec: `{view-slug}.md` (e.g., `home.md`, `ideation.md`)
- Visual per-page: `visual-{view-slug}.md` (e.g., `visual-home.md`)
- All other axes: fixed names as shown in Axis Quick Reference

### View slugs
- Derive from component name: `HomeView` → `home`, `IdeationPage` → `ideation`
- Lowercase, hyphen-separated for multi-word: `search-results`

### Markdown format
- H1 (`#`) for spec title
- H2 (`##`) for major sections
- H3 (`###`) for subsections (individual handlers, animations, etc.)
- Tables for structured data (props, state, axes, etc.)
- Fenced code blocks (``` ```) for verbatim source content — use appropriate language tag
- `**Bold:**` for labels in inline descriptions

### Cross-reference style
```markdown
**Companion docs:** [visual-home.md](visual-home.md) · [edge-cases.md](edge-cases.md) · [interaction-catalog.md](interaction-catalog.md)
```
- Use `·` (middle dot, U+00B7) as separator
- Use relative links (filename only, no path prefix)
- Place immediately after the H1 title, before any other content

### Line references
- Format: `Component.tsx:108` (single line) or `Component.tsx:108-117` (range)
- Always include line references for: handlers, animations, types, prompts, and any verbatim extract

### Observations section
Every spec ends with:
```markdown
## Observations

- [Non-obvious insight 1]
- [Non-obvious insight 2]
- [Non-obvious insight 3]
```
Minimum 3, maximum 5. These should be genuinely non-obvious — things a reader couldn't guess by skimming the tables. Examples: unusual architectural choices, potential rebuild risks, surprising constraints, patterns that differ from framework conventions.
