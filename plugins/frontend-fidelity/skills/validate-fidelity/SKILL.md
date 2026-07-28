---
name: validate-fidelity
description: Validate specs and implementations against the reverse-UI oracle. Catches drift before it ships. Use when checking if a spec accurately describes the original UI or if an implementation matches the original.
metadata:
  author: Big Emotion
  version: "1.0.0"
  argument-hint: --phase <spec|visual|all> [--domain <NNN-name>] [--focus <component>] [--oracle <path>]
allowed-tools: Read, Glob, Grep, Bash(ls:*), Bash(cat:*), Agent(Explore), mcp__claude-in-chrome__*, mcp__playwright__*, Bash(npm:*), Bash(npx:*)
---

# Validate Fidelity — Spec & Visual Drift Detection

Compare specs and running implementations against the reverse-UI oracle to catch drift before it ships.

**Input:** `$ARGUMENTS` = `--phase <spec|visual|all> [--domain <NNN-name>] [--focus <component>] [--oracle <path>]`

## Arguments

- `--phase` (required): `spec` | `visual` | `all`
  - `spec` — validate spec document against oracle JSON data
  - `visual` — validate running app against oracle screenshots + structure
  - `all` — run both phases sequentially for all matching domains
- `--domain` (optional): spec number or name, e.g., `004-home`, `002-app-shell`. If omitted, validates all domains that have both a spec and an oracle source.
- `--focus` (optional): component name to narrow scope, e.g., `sidebar`, `module-card`. Only validates requirements related to this component.
- `--oracle` (optional): path to reverse-UI output directory. Auto-detected if omitted.

### Examples

```
/validate-fidelity --phase spec --domain 004-home
/validate-fidelity --phase visual --domain 004-home
/validate-fidelity --phase all
/validate-fidelity --phase spec --domain 002-app-shell --focus sidebar
/validate-fidelity --phase spec --oracle ./reverse-ui-localhost-3000
```

## Phase 0: Parse Input & Locate Oracle

1. Parse `$ARGUMENTS` for `--phase`, `--domain`, `--focus`, `--oracle`.
2. If `--phase` is missing, ask the user which phase to run.
3. Locate the oracle in this priority order:
   a. `--oracle` flag (explicit path)
   b. `specs/assets/manifest.json` → read `meta.baseUrl` to derive `reverse-ui-{domain}/`
   c. Glob for `reverse-ui-*/manifest.json` in current working directory
   d. Ask user if not found
4. Verify the oracle directory exists and contains `manifest.json`.
5. If `--domain` is specified, locate the corresponding spec file: `specs/{domain}.md`
6. If `--domain` is omitted, glob for all `specs/*.md` files and match each to an oracle page directory.
7. Check for component-kit availability: `component-kit-{domain}/manifest.json` — if present, use it for more precise validation.

## Phase 1: Spec Validation (`--phase spec`)

Validate a spec document against the oracle's raw JSON data.

### Step 1: Parse Spec Requirements

Read the spec `.md` file and extract each `REQ-NNN-XX` block. For each requirement, identify quantitative claims:

- Grid column counts
- Dimensions (width, height, gap)
- Color values (hex, rgb, rgba)
- Font families, sizes, weights
- Component counts (nav items, cards, sections)
- Text content (labels, titles, placeholders)
- Animation parameters (duration, easing, keyframes)
- Border radius, opacity, blur values
- Z-index values
- Breakpoint-specific behaviors

### Step 2: Find Oracle Counterpart

For each claim, locate the matching data in the oracle:

| Claim type | Oracle source |
|-----------|---------------|
| DOM structure, counts, text | `structure.json` → sections, textContent |
| Computed styles, dimensions | `structure.json` → nodes[].styles, boundingBox |
| Colors, typography, spacing | `design-tokens.json` |
| Shadows, borders, effects | `design-tokens.json` → shadows, borders |
| WebGL/shader parameters | `canvas.json` → shaders, uniforms |
| Grid layout, responsive | `structure.json` + `structure-768.json` + `structure-375.json` |
| Component blueprints | `component-kit/components/*.json` (if available) |
| Page composition | `component-kit/layout/*.json` (if available) |
| Semantic tokens | `component-kit/tokens/semantic-tokens.json` (if available) |

If `--focus` is set, only process requirements whose REQ block or description mentions the focused component.

### Step 3: Compare

For each claim, classify the result:

| Result | Criteria | Symbol |
|--------|----------|--------|
| **PASS** | Value matches oracle exactly | `✅` |
| **WARN (close)** | Value within tolerance (±5% for dimensions, same color family for colors) | `⚠️` |
| **FAIL** | Value contradicts oracle | `❌` |
| **WARN (not in oracle)** | Claim has no counterpart in any JSON — possible invention | `⚠️` |
| **INFO (omission)** | Oracle has data that spec doesn't mention | `ℹ️` |

**Tolerance rules:**
- Dimensions: ±5% or ±2px (whichever is larger)
- Colors: exact hex/rgb match required (no "close enough" for colors)
- Counts: exact match required (3 columns ≠ 2 columns)
- Text: case-insensitive match, trimmed whitespace
- Font families: primary family must match (fallback stack can differ)

### Step 4: Output Fidelity Report

```
Validating spec {domain} against oracle...

Source: reverse-ui-{domain}/pages/{page}/structure.json
        component-kit-{domain}/components/{component}.json (if available)

ERRORS (spec contradicts oracle):
  ❌ REQ-NNN-XX — {requirement title}
     Spec: {spec value}
     Oracle: {oracle value}
     Source: {json file} → {json path}

  ❌ REQ-NNN-XX — {requirement title}
     Spec: {spec value}
     Oracle: {oracle value or "not found"}
     Source: {json file} → {json path}

WARNINGS:
  ⚠️  {description of close match or unverifiable claim}
     Spec: {spec value}
     Oracle: {oracle value}

OMISSIONS (oracle has data, spec is silent):
  ℹ️  {description of missing spec coverage}
     Oracle: {oracle value}
     Source: {json file} → {json path}

PASSES:
  ✅ REQ-NNN-XX — {requirement title} ({brief match detail})
  ✅ REQ-NNN-XX — {requirement title} ({brief match detail})

Score: {pass}/{total} requirements match | {error} errors, {warn} warnings, {omission} omissions
```

## Phase 2: Visual Validation (`--phase visual`)

Validate a running application against the oracle's screenshots and structure data.

### Step 1: Verify Dev Server

Check if the dev server is running:
```bash
npm run dev -- --port 5173 &  # or detect from spec/oracle
```

If not running, ask the user to start it.

### Step 2: Capture Current State

Use browser tools (`mcp__claude-in-chrome__*` or `mcp__playwright__*`) to:

1. Navigate to the page URL
2. Set viewport to 1440×900 (desktop)
3. Take a screenshot
4. Read the page structure (accessibility tree or DOM snapshot)
5. Extract computed styles for key elements (grid columns, dimensions, colors, fonts)

### Step 3: Structural Comparison

Compare the captured DOM against the oracle's `structure.json`:

| Check | How |
|-------|-----|
| Nav item count + labels | Count sidebar/nav children, compare text |
| Grid column count | Read `gridTemplateColumns` computed style |
| Section order + presence | Compare landmark sequence |
| Text content | Compare headings, button labels, placeholder text |
| Component dimensions | Compare bounding boxes (±10% tolerance) |
| Component presence | Verify all oracle components exist in current DOM |

### Step 4: Visual Comparison

Compare the captured screenshot against oracle screenshots:

| Check | How |
|-------|-----|
| Key element presence | WebGL canvas, badges, timestamps, avatars |
| Color tone | Sidebar dark, cards light, accent colors |
| Layout proportions | Sidebar width ratio, grid column balance |
| Responsive breakpoints | Resize to 768px and 375px, compare against oracle tablet/mobile screenshots |

### Step 5: Output Visual Fidelity Report

Same format as the spec report, but with screenshot references:

```
Validating visual output for {domain}...

Captured: {screenshot path}
Oracle:   reverse-ui-{domain}/pages/{page}/screenshot-1440.png

STRUCTURAL ERRORS:
  ❌ Nav items — Expected {n} items, found {m}
     Oracle: structure.json → sections[0].children (sidebar nav)
  
  ❌ Module grid — Expected {n} columns, found {m}
     Oracle: structure.json → sections[2].styles.gridTemplateColumns

VISUAL ISSUES:
  ⚠️  {description of visual discrepancy}

PASSES:
  ✅ Sidebar present and dark-themed
  ✅ Hero heading text matches
  ✅ Search bar present with correct placeholder

Score: {pass}/{total} checks | {error} errors, {warn} warnings
```

## Phase 3: All Validation (`--phase all`)

1. Glob for all specs: `specs/*.md`
2. For each spec, run Phase 1 (spec validation)
3. For each spec with a running page, run Phase 2 (visual validation)
4. Output combined report with per-domain scores and overall score

```
=== Fidelity Report — All Domains ===

002-app-shell:  Spec 8/10 ✅  |  Visual 7/9 ✅
004-home:       Spec 5/7  ⚠️  |  Visual 6/8 ⚠️
005-ideation:   Spec 9/9  ✅  |  Visual — (no dev server)

Overall: 22/26 spec (84%) | 13/17 visual (76%)
Top issues:
  1. ❌ 004-home REQ-004-06 — Module grid columns (2 vs 3)
  2. ❌ 004-home REQ-004-05 — Search bar gradient (invented)
  3. ❌ 002-app-shell REQ-002-03 — Nav item count (4 vs 8)
```

## Oracle Path Resolution

The skill locates oracle data in this priority:

1. `--oracle <path>` — explicit, used as-is
2. `specs/assets/manifest.json` → read `meta.baseUrl`, derive domain, look for `reverse-ui-{domain}/`
3. `reverse-ui-*/manifest.json` — glob in cwd, use the first match (or ask if multiple)
4. `component-kit-*/manifest.json` — check alongside reverse-ui for enhanced validation
5. Ask user if nothing found

## Limitations

- Spec validation is only as good as the requirement extraction — freeform prose without `REQ-NNN-XX` markers may be missed
- Visual validation requires a running dev server and browser automation tools
- Color comparison is exact (no perceptual color distance) — rgba(255,255,255,0.2) ≠ rgba(255,255,255,0.19)
- Screenshot comparison is structural, not pixel-diff — subtle spacing or shadow differences may not be caught
- Component-kit data (Phase 10 of reverse-ui) significantly improves validation precision — run `/reverse-ui` with `--components` first for best results
- WebGL/canvas content cannot be structurally compared in visual mode — only presence/absence is checked
