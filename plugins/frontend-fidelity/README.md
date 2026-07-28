# Frontend Fidelity

> A pixel-fidelity pipeline for frontend rebuilds: extract ground truth from a live UI, spec the codebase for rebuild, and catch drift between spec, implementation, and the original before it ships.

Part of [Agent Atelier](../../README.md). Install:

```
/plugin marketplace add big-emotion/agent-atelier
/plugin install frontend-fidelity@big-emotion
```

## How the tools compose

The three skills compose around a shared oracle. 1) reverse-ui runs first against the original app: it produces the raw extraction directory (reverse-ui-{domain}/) and publishes the unified design-system + component kit to specs/assets/ — this is the "oracle" the rest of the pipeline trusts. 2) blueprint runs on the original codebase (it can also run standalone with no oracle) and writes the specs/*.md rebuild specs through its discover → scope → extract → incorporate → refine → finalize state machine. 3) validate-fidelity closes the loop twice: --phase spec checks the written specs' REQ-NNN-XX claims against the oracle JSON before you build, and --phase visual checks the rebuilt, running app against the oracle screenshots and structure after you build. validate-fidelity auto-locates the oracle from specs/assets/manifest.json or reverse-ui-*/ directories, so running reverse-ui first is what makes validation possible.

## Tools

### `reverse-ui` — skill

Drives the agent-browser CLI through a live web app (one or more routes, SPA-aware navigation, iframe detection) and extracts a complete reproduction kit: design tokens, semantic DOM structure at 1440/768/375px, full inline-SVG markup, GLSL shader source recovered from same-origin JS bundles, animation-library and scroll-trigger detection, downloaded images, screenshots plus a per-page animation GIF. When the target is localhost it additionally enriches the browser data from local source code (keyframes, font imports, breakpoints, WebGL component wiring, clean CSS custom properties) with per-entry provenance markers. It always generates a versionable design-system kit (tokens.css, typography.css, animations.css, colors.json, deduplicated SVG icons) and an LLM-derived component kit (per-component spec.json + README, page-layout JSONs, semantic tokens), writing everything to specs/assets/ with no confirmation gates.

**Use it when:**

- You need to reproduce an existing site or web app pixel-perfect in a new stack and want machine-readable ground truth, not eyeballed screenshots
- You need the design tokens of a running site — color palette, type scale, spacing base unit, shadows, breakpoints, z-index layers — extracted into importable CSS/JSON
- You are migrating a legacy frontend and need per-breakpoint DOM structure, text content, and screenshots for every key page
- The page has a WebGL/canvas background whose shader source and uniforms you need to recover from the JS bundles
- You are about to write rebuild specs and want an oracle that validate-fidelity can later check them against

**Don't use it for:**

- You have the source code and want behavioral/functional specs — that is blueprint's job; reverse-ui only sees the rendered browser output
- You already have an extraction and want to check a spec or implementation against it — that is validate-fidelity
- The target relies on closed Shadow DOM or WASM renderers (Unity/Unreal), where the documented limitations mean extraction cannot reach the content

**Example:**

```
/frontend-fidelity:reverse-ui http://localhost:3000 /,/pricing,/about
```

**Requirements:** agent-browser CLI installed globally (npm i -g agent-browser); a pre-authenticated agent-browser session for pages behind login; the claude-in-chrome MCP server for the animation-GIF capture (optional — skipped gracefully if unavailable).

### `blueprint` — skill

A stateful, resumable spec pipeline over a frontend codebase (React, Vue, Svelte, Angular, Astro): discover → scope → extract → incorporate → refine → finalize, with all state tracked in specs/_pipeline.md so any phase can be re-run or resumed per view or per axis. It extracts 12 axes into flat markdown files — functional spec per view, visual foundations/per-view/mobile, animations, interactions, i18n, types, assets, edge cases, and an optional AI-prompts axis — enforcing verbatim copies (types, shaders, prompts, translation strings) with file:line references. scope pauses for human view/axis selection; incorporate reconciles user-dropped screenshots against the visual specs; refine runs a 6-check quality audit producing a severity-ranked RF-NN checklist; finalize generates known-gaps.md and rebuild-readiness.md with per-axis confidence. It only reads the codebase and writes exclusively under specs/.

**Use it when:**

- You are documenting a frontend app for a rebuild or a framework migration and need a complete, navigable specs/ directory
- You need per-view functional specs with verbatim type definitions, Zod schemas, prompts, or GLSL that must never be paraphrased
- You want an automated audit of spec completeness against the source (uncatalogued handlers, undocumented error states, missing responsive coverage)
- You have baseline screenshots of the app and want discrepancies between them and the written visual specs flagged
- You changed one view or axis and want to re-extract just that piece (extract --view / --axis) without redoing the pipeline

**Don't use it for:**

- You only have a live URL, not the source code — use reverse-ui, which works from the rendered browser output
- You want to verify specs or a running implementation against extracted browser ground truth — that is validate-fidelity
- You need quick documentation of a single component — the multi-phase pipeline and _pipeline.md state tracking are overkill for that

**Example:**

```
/frontend-fidelity:blueprint run
```

**Requirements:** none — uses built-in Read/Write/Glob/Grep, a few read-only Bash commands (ls, cat, wc, mkdir), and the Explore sub-agent.

### `validate-fidelity` — skill

A drift detector that compares two things against the reverse-ui oracle: --phase spec checks each REQ-NNN-XX quantitative claim in a spec document (grid columns, dimensions, colors, fonts, counts, text, animation timing) against the oracle's JSON, and --phase visual drives a real browser against the running app to compare structure, text, dimensions, and responsive breakpoints against the oracle's structure data and screenshots. Every claim is classified PASS / WARN / FAIL / invented / omission under explicit tolerance rules (±5% or 2px on dimensions, exact matching for colors and counts) and rolled into a scored fidelity report; --phase all aggregates per-domain scores. It auto-locates the oracle via specs/assets/manifest.json or reverse-ui-*/ globs and uses component-kit data when present for higher precision. It never edits files — it reports; the only side effect is optionally starting the dev server for the visual phase.

**Use it when:**

- Before building: verify that a written spec faithfully describes the original UI and contains no invented values
- After building: verify the running implementation matches the original's structure, copy, and layout at 1440/768/375px
- Hunting hallucinated spec claims — values with no counterpart anywhere in the oracle JSON are flagged as possible inventions
- A full regression pass across every spec domain, producing a combined score and a ranked top-issues list

**Don't use it for:**

- No reverse-ui extraction exists yet — there is no oracle to validate against; run reverse-ui first
- You expect pixel-diff image comparison — the visual phase is structural (element presence, counts, proportions, color tone), not a per-pixel diff
- You want the drift fixed — it only reports; apply the corrections to the specs or code yourself

**Example:**

```
/frontend-fidelity:validate-fidelity --phase spec --domain 004-home
```

**Requirements:** a reverse-ui oracle directory (reverse-ui-{domain}/ or specs/assets/); for --phase visual: a running dev server plus browser automation via the claude-in-chrome or Playwright MCP server.
