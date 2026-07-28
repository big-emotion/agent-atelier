---
name: reverse-ui
description: Reverse-engineer any web application into a complete pixel-perfect reproduction kit. Extracts design tokens, DOM structure, text content, assets, and responsive screenshots across multiple pages. Use when the user asks to "reverse-engineer a UI", "extract a design system", "analyze the design of a website", or wants to reproduce a site pixel-perfect.
metadata:
  author: Big Emotion
  version: "3.0.0"
  argument-hint: <url> [/page1,/page2,...] [--kit <path>]
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*), Bash(cat:*), Bash(wc:*), Bash(mkdir:*), Bash(ls:*), Bash(curl:*), Write, Read, Grep, Glob, mcp__claude-in-chrome__gif_creator, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__screenshot_mcp, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp
---

# Reverse-Engineer UI — Pixel-Perfect Reproduction Kit

Extract everything needed to reproduce a web application pixel-perfect: design tokens, DOM structure per page, text content, asset inventory, and responsive screenshots.

**Input:** `$ARGUMENTS` = `<base-url> [/path1,/path2,...] [--kit <path>]`

- First token: base URL (required). If empty, ask for one.
- Second token: comma-separated route paths (optional). Defaults to the path of the base URL (or `/` if none).
- `--kit` flag (optional): custom Design Kit output path.
  - Omitted → generates kit at `./design-kit-{domain}/` (default)
  - `--kit ./my-folder` → generates kit at the specified path
- **Always generated**: Design Kit (Phase 9) and Component Kit (Phase 10) — no way to skip either.
- **Always published**: Publishes to `./specs/assets/` — automatically creates `specs/` directory if it doesn't exist.

- Examples:
  - `/reverse-ui https://example.com` → extracts `/` + generates kits + publishes to specs/assets (creates specs/ if needed)
  - `/reverse-ui https://example.com /,/pricing,/about` → extracts 3 pages + generates kits + publishes
  - `/reverse-ui http://localhost:3000 /,/ideation` → extracts Home + Ideation + publishes
  - `/reverse-ui http://localhost:3000 / --kit ./my-design` → kit output to `./my-design/` + publishes

## Prerequisites

- `agent-browser` CLI must be installed (`npm i -g agent-browser`)
- For authenticated pages, pre-authenticate:
  ```bash
  agent-browser --session-name myapp open https://app.example.com/login
  # ... login manually ...
  ```

## Output Structure

Two directories are generated: a temporary raw extraction (for reference) and a permanent, unified `specs/assets/` directory:

```
reverse-ui-{domain}/                # Temporary raw extraction — JSON + screenshots (AI reference, can be .gitignored)
  manifest.json                     # Index tying everything together
  design-tokens.json                # Global: colors, typography, spacing, shadows, animations, breakpoints, components, layout
  assets.json                       # Global: images, SVGs, fonts, favicons, background images, logos
  images/                           # Downloaded image assets
    photo-1580273916550.jpg
    ...
  pages/
    {page-name}/                    # One directory per page ("/" → "home", "/pricing" → "pricing")
      structure.json                # Semantic DOM tree + text content map (desktop 1440px)
      structure-768.json            # Semantic DOM tree at tablet breakpoint
      structure-375.json            # Semantic DOM tree at mobile breakpoint
      svgs.json                     # Full SVG outerHTML for every inline icon/illustration
      interactions.json             # Animation libraries, scroll triggers, data attributes
      animations.gif                # GIF recording of page scroll + hover interactions
      screenshot-1440.png           # Desktop viewport
      screenshot-1440-full.png      # Desktop full page
      annotated-1440.png            # Desktop with labeled interactive elements
      screenshot-768.png            # Tablet viewport
      screenshot-375.png            # Mobile viewport

specs/assets/                        # Canonical, unified destination — design system + components + raw extraction (Phase 9.5 published here directly)
  manifest.json                      # Unified index (designSystem, components, layouts, tokens, pages sections)
  design-system/                     # Design tokens — CSS + JSON (Phase 9 output, versionable)
    tokens.css                       # CSS custom properties (ready for @theme or :root)
    typography.css                   # @import font URLs + @font-face + font-family mappings
    animations.css                   # @keyframes definitions + animation utility classes
    shadows.css                      # Box-shadow and drop-shadow token definitions
    colors.json                      # Semantic color palette (name → hex/rgba, grouped by role)
    breakpoints.json                 # Named breakpoints with Tailwind prefix mapping
    z-index.json                     # Z-index scale with layer names
    icons/                           # Individual SVG files (deduplicated across pages)
      home.svg
      trends.svg
      ...
  components/                        # Component blueprints + co-located docs (Phase 10 output, versionable)
    sidebar/
      spec.json                      # Component specification
      README.md                      # Component documentation
    module-card/
      spec.json
      README.md
    header/
      spec.json
      README.md
    ...
  layout/                            # Page composition blueprints (Phase 10 output)
    home.json                        # Which components, what grid, what order
    ideation.json
    ...
  tokens/                            # Semantic token mappings (Phase 10 output)
    semantic-tokens.json             # Mapped: "sidebar-bg" → rgba(2,4,16,0.8)
  pages/                             # Raw extraction data (Phase 5 output, organized by page)
    home/
      structure.json
      structure-768.json
      structure-375.json
      svgs.json
      interactions.json
      canvas.json
      screenshot-1440.png
      screenshot-1440-full.png
      annotated-1440.png
      screenshot-768.png
      screenshot-375.png
    ideation/
      (same set)
  images/                            # Downloaded asset images
    photo-*.jpg
  design-tokens.json                 # Raw browser extraction (full token data with enrichment metadata)
  assets.json                        # Images/SVGs inventory from raw extraction
```

The `reverse-ui-{domain}/` folder can be `.gitignore`d since it's regenerable. The `specs/assets/` folder is the canonical, versionable destination — design tokens, components, and raw extraction data all live here for unified access.

## Workflow

### Phase 0: Parse Input

1. Parse `$ARGUMENTS`: split into `baseUrl` (first token) and `pages[]` (second token, comma-separated). If no pages given, extract the path from baseUrl (default to `/`).
2. Parse `--kit` flag (for custom output path only):
   - `--kit <path>` → set `kitPath = <path>`
   - Not present → set `kitPath = ./design-kit-{domain}/` (default)
3. Set mandatory flags (no control):
   - `kitEnabled = true` (always run Phase 9)
   - `componentsEnabled = true` (always run Phase 10)
4. Set `publishPath` (always publish):
   - If `specs/` directory exists in cwd → set `publishPath = ./specs/assets/`
   - If `specs/` does NOT exist → create it, then set `publishPath = ./specs/assets/`
5. Compute the origin from baseUrl (protocol + host).
6. Sanitize page paths into directory names: `/` → `home`, `/pricing` → `pricing`, `/docs/getting-started` → `docs-getting-started`.
7. Create the output directory structure:

```bash
mkdir -p ./reverse-ui-{domain}/pages/{page1}
mkdir -p ./reverse-ui-{domain}/pages/{page2}
# ... for each page

# Always create design-system directories (Phase 9 output):
mkdir -p ./specs/assets/design-system/icons

# Always create component directories (Phase 10 output):
mkdir -p ./specs/assets/components
mkdir -p ./specs/assets/layout
mkdir -p ./specs/assets/tokens

# Always create specs structure:
mkdir -p ./specs/assets/pages
mkdir -p ./specs/assets/images
mkdir -p ./specs/assets/raw
```

### Phase 1: Browser Init

```bash
agent-browser set viewport 1440 900
agent-browser open <origin + pages[0]> && agent-browser wait --load networkidle
```

### Phase 2: Iframe Detection

Check if the real application lives inside an iframe (common with preview modes, embedded apps).

```bash
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify({
  iframes: Array.from(document.querySelectorAll('iframe')).map(f => ({
    src: f.src, id: f.id, name: f.name,
    width: f.offsetWidth, height: f.offsetHeight,
    ratio: Math.round((f.offsetWidth * f.offsetHeight) / (window.innerWidth * window.innerHeight) * 100)
  })),
  bodyChildCount: document.body.children.length
})
EVALEOF
```

**Decision logic:**
- If an iframe has `ratio > 80` (occupies >80% of viewport), the app is inside that iframe
- Take a snapshot (`agent-browser snapshot -i`) to get the iframe ref (e.g., `@e2`)
- Enter the iframe: `agent-browser frame @eN`
- All subsequent commands will target the iframe content
- If no dominant iframe exists, proceed on the main page

### Phase 3: Global Design Token Extraction (once, on first page)

Scroll to trigger lazy-loaded content:

```bash
agent-browser scroll down 2000 && agent-browser wait 1000
agent-browser scroll down 2000 && agent-browser wait 1000
agent-browser scroll down 2000 && agent-browser wait 1000
agent-browser scroll down -6000 && agent-browser wait 500
```

Extract design tokens:

```bash
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-design-system.js
```

Parse the JSON output and save as `./reverse-ui-{domain}/design-tokens.json`.

### Phase 4: Per-Page Extraction Loop

For each page in `pages[]`:

#### 4a. Navigate (skip for first page — already there)

**IMPORTANT — SPA Navigation:**
SPAs (React, Vue, Svelte, SvelteKit) use client-side routing. Navigating via `agent-browser open <url>` causes a full page reload that may redirect to `/` or lose SPA state. Instead:

1. First, take a snapshot to identify navigation elements: `agent-browser snapshot -i`
2. Find the sidebar/nav button or link matching the target page name
3. Click it: `agent-browser click @eN` (using the ref from the snapshot)
4. Wait for the content to update: `agent-browser wait 2000`
5. Verify navigation landed correctly: check the current URL or page title matches the expected target. If navigation failed (404, redirect to login, stuck on previous page), log a warning and skip this page — do not let a failed navigation corrupt remaining pages.

**Fallback for non-SPA sites** (traditional multi-page apps):
```bash
agent-browser open <origin + page> && agent-browser wait --load networkidle
```

**How to decide:** If the first page load revealed a sidebar/nav with links to other pages (buttons, anchors), it's an SPA — use in-page clicks. If the site has no persistent navigation shell, use direct URL navigation.

#### 4b. Scroll to Trigger Lazy Content

```bash
agent-browser scroll down 2000 && agent-browser wait 1000
agent-browser scroll down 2000 && agent-browser wait 1000
agent-browser scroll down 2000 && agent-browser wait 1000
agent-browser scroll down -6000 && agent-browser wait 500
```

#### 4c. Extract Page Structure (desktop)

```bash
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-page-structure.js
```

Parse the JSON output:
- If `{ chunked: true, totalChunks: N }`: retrieve chunks one by one:
  ```bash
  agent-browser eval "window.__REVERSE_UI_CHUNKS[0]"
  agent-browser eval "window.__REVERSE_UI_CHUNKS[1]"
  # ... up to totalChunks - 1
  ```
  The first chunk contains `page` metadata + `textContent`. Subsequent chunks are individual sections. Reassemble into the full structure.json.
- If not chunked: use the JSON directly.

Save as `./reverse-ui-{domain}/pages/{name}/structure.json`.

#### 4d. Extract SVGs (full markup)

```bash
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-svgs.js
```

Save as `./reverse-ui-{domain}/pages/{name}/svgs.json`. This contains the complete `outerHTML` for every unique inline SVG — enough to reproduce icons pixel-perfect.

#### 4e. Extract Canvas/WebGL (if present)

If the page has `<canvas>` elements (detected in the structure.json), extract WebGL context info, shader sources, and related scripts:

```bash
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-canvas.js
```

If WebGL canvases are detected (check `summary.webglCanvases > 0` in the output), also extract shader source code from JS bundles:

```bash
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-shaders.js
```

Merge both outputs into a single `./reverse-ui-{domain}/pages/{name}/canvas.json`. The combined file will contain:
- Canvas metadata (dimensions, context type, positioning)
- Detected WebGL libraries (OGL, Three.js, etc.)
- **Full GLSL shader source code** (vertex + fragment shaders extracted from JS bundles)
- Uniform declarations and default values
- A static frame snapshot (base64 PNG)

This is enough for the implementation agent to reconstruct the WebGL component using the detected library + extracted shaders.

**Limitations:** Cross-origin scripts cannot be fetched (CORS). Heavily minified production builds may obscure shader strings. WASM-based renderers (Unity, Unreal) store shaders outside JS bundles. Dev builds work best for extraction.

#### 4f. Extract Interactions (animation libraries, scroll triggers)

```bash
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-interactions.js
```

Parse the JSON output and save as `./reverse-ui-{domain}/pages/{name}/interactions.json`. This detects:
- Animation library globals (GSAP, AOS, ScrollReveal, Framer Motion, anime.js, etc.)
- Animation data attributes (`data-aos`, `data-scroll`, `data-parallax`, etc.)
- Scroll-triggered CSS classes (`aos-animate`, `is-inview`, `animate__animated`, etc.)
- Native CSS scroll timelines (`animation-timeline`, `scroll-timeline-name`, `view-timeline-name`)

#### 4g. Extract Assets (accumulates across pages)

```bash
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-assets.js
```

This accumulates on `window.__REVERSE_UI_ASSETS`. Don't save yet — it will be finalized after all pages.

#### 4h. Responsive Screenshots + Structure

```bash
# Desktop viewport (already at 1440×900)
agent-browser screenshot ./reverse-ui-{domain}/pages/{name}/screenshot-1440.png
agent-browser screenshot --full ./reverse-ui-{domain}/pages/{name}/screenshot-1440-full.png
agent-browser screenshot --annotate ./reverse-ui-{domain}/pages/{name}/annotated-1440.png

# Tablet
agent-browser set viewport 768 1024
agent-browser wait 1000
agent-browser screenshot ./reverse-ui-{domain}/pages/{name}/screenshot-768.png
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-page-structure.js
```
Save tablet structure as `./reverse-ui-{domain}/pages/{name}/structure-768.json`.

```bash
# Mobile
agent-browser set viewport 375 812
agent-browser wait 1000
agent-browser screenshot ./reverse-ui-{domain}/pages/{name}/screenshot-375.png
agent-browser eval --stdin < ${CLAUDE_PLUGIN_ROOT}/skills/reverse-ui/scripts/extract-page-structure.js
```
Save mobile structure as `./reverse-ui-{domain}/pages/{name}/structure-375.json`.

```bash
# Reset to desktop for next page
agent-browser set viewport 1440 900
```

#### 4i. Animation GIF Capture

Record a GIF of the page's animations as a visual reference artifact for AI consumption. This runs after all JSON extraction is complete for the page.

**Workflow:**

1. Use `mcp__claude-in-chrome__gif_creator` to start recording (action: `start_recording`)
2. Take an initial screenshot (captures starting state as first frame)
3. **Slow scroll** — scroll down the full page in 3-4 increments with pauses between each (`agent-browser scroll down 1500 && agent-browser wait 2000`). This triggers scroll-activated animations, parallax effects, and fade-ins.
4. **Scroll back to top** — `agent-browser scroll down -6000 && agent-browser wait 1000`
5. **Hover key interactive elements** — find buttons, links, cards with transitions. Use elements from `interactions.json` or heuristic selectors: `button`, `a`, `[role="button"]`, elements with non-default `transition`. Hover 3-5 elements max via `agent-browser hover @eN`.
6. Take a final screenshot (captures end state as last frame)
7. Stop recording
8. Export GIF with options: `{ showClickIndicators: false, showActionLabels: false, showProgressBar: false, showWatermark: false, quality: 8 }` — clean recording, no overlays
9. Save to `./reverse-ui-{domain}/pages/{name}/animations.gif`

**Notes:**
- The GIF is a reference for AI consumption, not a demo video — clean frames are better for visual analysis
- Adds ~15-30s per page
- Output size: ~2-5MB per page (acceptable since screenshots already add ~1-3MB per page)
- If GIF recording fails (e.g., `mcp__claude-in-chrome` not available), skip gracefully and note in the summary

### Phase 5: Finalize Assets

After all pages have been visited, retrieve the accumulated assets:

```bash
agent-browser eval "JSON.stringify(window.__REVERSE_UI_ASSETS)"
```

Parse and save as `./reverse-ui-{domain}/assets.json`.

### Phase 5b: Download Images

Download all image assets to a local `images/` directory:

```bash
mkdir -p ./reverse-ui-{domain}/images
```

For each image in `assets.json` with an external URL:
```bash
curl -sL "<image-url>" -o ./reverse-ui-{domain}/images/{filename}
```

Generate the filename from the URL (last path segment, or a sanitized version). Update `assets.json` entries with a `localPath` field pointing to the downloaded file.

**Skip** images from placeholder services (picsum.photos, placeholder.com, via.placeholder.com) — note them as placeholders instead.

**Skip** data: URIs (already embedded).

### Phase 5c: Source-Code Enrichment

**Gate check:** Only run when `baseUrl` contains `localhost`, `127.0.0.1`, or `0.0.0.0`. Skip for remote URLs. The project root is the current working directory.

If no source files are found (no `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.css`, `*.html` outside `node_modules`), log a warning in Phase 8 and skip.

**Provenance:** Every enriched entry gets a `_source` field: `"browser"` (existing data), `"source-code"` (from local files), or `"merged"` (combined from both).

#### Sub-phase A: CSS Animations & Transitions

Fill the gap left by CORS-blocked stylesheets and single-snapshot timing.

1. Glob `**/*.css`, `**/*.scss`, `**/*.html`, `**/*.svelte`, `**/*.vue`, `**/*.astro` (exclude `node_modules`, `dist`, `build`, `.next`, `.svelte-kit`)
2. Grep `@keyframes\s+\w+` — read each matched file, extract the full keyframe block (name + frames)
3. Grep `transition:` and `animation:` in component files (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`) — extract property, duration, easing
4. Check `tailwind.config.*` for `theme.extend.keyframes` and `theme.extend.animation`
5. Check `index.html` `<style>` blocks for inline `@keyframes`

**Merge into `design-tokens.json` → `animations.keyframes[]`:**
- Append source-code keyframes not already present (match by name)
- Mark each with `_source: "source-code"` and `sourceFile: "<relative path>"`
- If a keyframe with the same name exists in browser data, keep the source-code version (unminified) and mark `_source: "merged"`

#### Sub-phase B: Typography / Font Scale

Fill the gap left by CORS-blocked Google Fonts / Fontshare CSS.

1. Parse `<link>` tags in `index.html` for Google Fonts / Fontshare URLs — extract families and weights from URL query parameters (e.g., `family=Montserrat:wght@300;400;500;600;700` → family `"Montserrat"`, weights `[300,400,500,600,700]`)
2. Grep `font-family` declarations in `*.css`, `*.html` `<style>`, component files — capture the selector → font-family mapping
3. Check `tailwind.config.*` for `theme.extend.fontFamily`
4. Grep `@font-face` in local CSS files (self-hosted fonts)

**Merge into `design-tokens.json` → `typography`:**
- Populate `fontFaces[]` with parsed CDN font data (family, weights, source URL, display)
- Add new `fontFamilyMap` object mapping selectors to font stacks (e.g., `{ "body": "Noto Sans, sans-serif", "h1,h2,h3": "Montserrat, sans-serif" }`)
- Mark `_source: "source-code"`

#### Sub-phase C: Breakpoints / Media Queries

Fill the gap left by hardcoded viewport widths and CORS-blocked stylesheets.

1. Check `tailwind.config.*` for `theme.screens` (canonical breakpoint definitions)
2. Grep `@media` in `*.css`, `*.scss`, `*.html` `<style>` blocks — extract width values and rule content
3. If Tailwind CDN detected (no config file, `cdn.tailwindcss.com` in `index.html`): check for inline `tailwind.config = { ... }` in a `<script>` tag, else use Tailwind defaults (`sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px`)

**Merge into `design-tokens.json` → `breakpoints`:**
- Add new `namedBreakpoints` object: `{ "sm": "640px", "md": "768px", ... }`
- Extend existing `widths[]` with any new values from source
- Mark `_source: "source-code"`

#### Sub-phase D: WebGL/3D Component Wiring

Fill the gap left by minified bundle analysis — extract clean component source.

**Skip** if no `canvas.json` exists for any page.

1. Grep for imports: `from 'ogl'`, `from 'three'`, `from '@react-three'`, `from 'pixi'`
2. Read each matched component file (cap: 5 files, 500 lines each)
3. Extract: component name, props with defaults, renderer config, geometry type, uniform declarations with initial values, event handlers, animation loop presence

**Merge into each page's `canvas.json`:**
- Add new `sourceComponents[]` array with structured component data:
  ```json
  {
    "filePath": "components/Threads.tsx",
    "componentName": "Threads",
    "library": "ogl",
    "props": { "color": { "type": "array", "default": [0.2, 0.3, 0.5] } },
    "uniforms": { "iTime": { "type": "float", "initial": 0 } },
    "eventHandlers": ["resize", "mousemove"],
    "animationLoop": true,
    "_source": "source-code"
  }
  ```
- Keep existing `canvases[]`, `shaders`, `relatedScripts` untouched

#### Sub-phase E: CSS Custom Properties (Clean Tokens)

Separate intentional design tokens from Tailwind internal variables.

1. Grep `--` (custom property definitions) in `*.css`, `*.html` `<style>` — filter OUT any `--tw-*` properties
2. Check `tailwind.config.*` for `theme.extend.colors`, `theme.extend.spacing`, etc.
3. Look for dedicated token files: `tokens.css`, `variables.css`, `theme.css`, `design-tokens.*`
4. Parse `:root { }` blocks in `index.html` for intentional CSS custom properties

**Merge into `design-tokens.json` → `colors`:**
- Add new `intentionalTokens[]` array (separate from existing `cssCustomProperties`)
- Each entry: `{ "name": "--primary", "value": "#1a2b3c", "scope": ":root", "_source": "source-code" }`

#### Finalize Enrichment

After all sub-phases complete, add enrichment metadata to `design-tokens.json`:

```json
{
  "meta": {
    "sourceCodeEnrichment": {
      "enabled": true,
      "projectRoot": "<cwd>",
      "filesAnalyzed": 12,
      "enrichedCategories": ["animations", "typography", "breakpoints", "webgl", "cssCustomProperties"]
    }
  }
}
```

Write back all modified JSON files (`design-tokens.json`, per-page `canvas.json`).

### Phase 6: Write Manifest (Unified Format for `reverse-ui-{domain}/` and `specs/assets/`)

Build `manifest.json` programmatically and save to **both** locations. This unified format is ready to be published directly.

**Note:** Phase 9 and Phase 10 will add `designSystem`, `components`, `layouts`, `tokens` sections to the manifest after they run. The manifest starts with the raw extraction structure below, then gets enriched.

```json
{
  "meta": {
    "baseUrl": "<base-url>",
    "extractedAt": "<ISO timestamp>",
    "pages": ["/", "/ideation"],
    "sourceCodeEnrichment": true
  },
  "designTokens": "design-tokens.json",
  "assets": "assets.json",
  "designSystem": {
    "directory": "design-system/",
    "tokens": "design-system/tokens.css",
    "typography": "design-system/typography.css",
    "animations": "design-system/animations.css",
    "shadows": "design-system/shadows.css",
    "colors": "design-system/colors.json",
    "breakpoints": "design-system/breakpoints.json",
    "zIndex": "design-system/z-index.json"
  },
  "components": [
    { "name": "sidebar", "spec": "components/sidebar/spec.json", "doc": "components/sidebar/README.md" },
    { "name": "module-card", "spec": "components/module-card/spec.json", "doc": "components/module-card/README.md" }
  ],
  "layouts": [
    { "page": "/", "file": "layout/home.json" },
    { "page": "/ideation", "file": "layout/ideation.json" }
  ],
  "tokens": "tokens/semantic-tokens.json",
  "pages": {
    "/": {
      "directory": "pages/home",
      "structure": "pages/home/structure.json",
      "structure-tablet": "pages/home/structure-768.json",
      "structure-mobile": "pages/home/structure-375.json",
      "interactions": "pages/home/interactions.json",
      "canvas": "pages/home/canvas.json",
      "svgs": "pages/home/svgs.json",
      "screenshots": {
        "desktop": "pages/home/screenshot-1440.png",
        "desktopFull": "pages/home/screenshot-1440-full.png",
        "annotated": "pages/home/annotated-1440.png",
        "tablet": "pages/home/screenshot-768.png",
        "mobile": "pages/home/screenshot-375.png"
      }
    }
  }
}
```

### Phase 7: Cleanup

```bash
agent-browser close
```

### Phase 8: Summary

Display a summary:
- Pages extracted (count + names)
- Design tokens: CSS custom properties, color palette size, font families, breakpoints
- Per page: section count, headings, buttons, links, form inputs
- Animations: detected libraries (name + version), keyframe count, animated element count, GIF capture status
- Assets: images, SVGs, fonts, logos found
- Screenshots + GIFs: total count
- Source-code enrichment: categories enriched, files analyzed (or "skipped — remote URL" / "skipped — no source files found")
- Component kit (if generated): components identified, pages laid out, docs generated
- Publish (if enabled): files published to `{publishPath}`, file count
- Warnings: inaccessible stylesheets, truncated categories, chunked pages

### Phase 9: Design Kit Generation

**Skip** this phase if `kitPath` is `null` (`--kit false`).

Generate versionable, directly-importable design artifacts from the raw extraction. All files are derived from `design-tokens.json`, per-page `svgs.json`, and `assets.json`.

#### 9a. `specs/assets/design-system/tokens.css` — CSS Custom Properties

Read `design-tokens.json`. Generate a CSS file with all design tokens as custom properties, organized by category. Filter OUT `--tw-*` internal variables — only include intentional tokens and semantic mappings.

Write to: `./specs/assets/design-system/tokens.css`

```css
/* Design System — generated from reverse-ui extraction */
/* Source: reverse-ui-{domain}/design-tokens.json */

:root {
  /* === Colors === */
  --color-navy-950: #020410;
  --color-slate-50: #f8fafc;
  /* ... mapped from colors.backgroundColors + textColors → hex values ... */

  /* === Shadows === */
  --shadow-sidebar: rgba(0,0,0,0.5) 10px 0px 30px -10px;
  --shadow-card: rgba(0,0,0,0.2) 0px 0px 15px 0px;
  /* ... from shadows.boxShadows ... */

  /* === Z-Index === */
  --z-content: 0;
  --z-elevated: 10;
  --z-header: 40;
  --z-sidebar: 50;

  /* === Spacing (notable values) === */
  /* ... from spacing.values, only non-standard ones ... */
}
```

**Mapping rules:**
- `colors.backgroundColors` + `colors.textColors` + `colors.borderColors` → deduplicate, convert `rgb(r,g,b)` to hex, assign semantic names where possible (match against Tailwind color palette names)
- `shadows.boxShadows` → name by usage context from component data
- `zIndex.values` → assign layer names (content, elevated, header, sidebar) based on component usage
- `colors.gradients` → include as `--gradient-*` custom properties

#### 9b. `specs/assets/design-system/typography.css` — Font Imports & Scale

Write to: `./specs/assets/design-system/typography.css`

```css
/* Typography — font imports and scale */

@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=Noto+Sans:wght@300;400;500;600;700&display=swap");
@import url("https://api.fontshare.com/v2/css?f[]=satoshi@900,700,600,500,400,300&display=swap");

:root {
  /* Font families */
  --font-heading: 'Montserrat', sans-serif;
  --font-body: 'Noto Sans', sans-serif;
  --font-ui: 'Satoshi', sans-serif;

  /* Font size scale */
  --text-4xs: 8px;
  --text-3xs: 9px;
  /* ... from typography.fontSizeScale ... */

  /* Font weights */
  --font-light: 300;
  --font-normal: 400;
  /* ... from typography.fontWeights ... */

  /* Line heights */
  /* ... from typography.lineHeights ... */

  /* Letter spacings */
  /* ... from typography.letterSpacings ... */
}
```

**Source:** `typography.fontFaces` for `@import` URLs, `typography.fontFamilyMap` for family assignments, `typography.fontSizeScale` / `fontWeights` / `lineHeights` / `letterSpacings` for scale values.

#### 9c. `specs/assets/design-system/animations.css` — Keyframes & Utilities

Write to: `./specs/assets/design-system/animations.css`

```css
/* Animations — keyframes and utility class definitions */

@keyframes fade-in {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes slide-up {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ... all keyframes from animations.keyframes + sourceCodeKeyframes ... */

/* Animation utilities */
.animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
.animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
/* ... from animations.sourceCodeAnimations ... */

/* Transition utilities */
/* ... from animations.sourceCodeTransitions — document durations/counts as comments ... */
```

**Source:** `animations.keyframes` for frame definitions (prefer `sourceCodeKeyframes` — unminified), `animations.sourceCodeAnimations` for utility class definitions with durations/easing.

#### 9d. `specs/assets/design-system/shadows.css` — Shadow Tokens

Write to: `./specs/assets/design-system/shadows.css`

```css
/* Shadows — box-shadow and drop-shadow tokens */

:root {
  --shadow-sidebar: rgba(0,0,0,0.5) 10px 0px 30px -10px;
  --shadow-card: rgba(0,0,0,0.2) 0px 0px 15px 0px;
  --shadow-md: rgba(0,0,0,0.1) 0px 10px 15px -3px, rgba(0,0,0,0.1) 0px 4px 6px -4px;
  --shadow-sm: rgba(0,0,0,0.05) 0px 1px 2px 0px;
  --shadow-glass: rgba(0,0,0,0.05) 0px 20px 40px -15px, rgba(0,0,0,0.02) 0px 0px 15px -5px;
}
```

**Source:** `shadows.boxShadows` — each shadow gets a semantic name derived from the component where it's most frequently used.

#### 9e. `specs/assets/design-system/colors.json` — Semantic Color Palette

Write to: `./specs/assets/design-system/colors.json`

```json
{
  "palette": {
    "blue-400": { "hex": "#60a5fa", "rgb": "rgb(96,165,250)", "role": "accent" },
    "slate-800": { "hex": "#1e293b", "rgb": "rgb(30,41,59)", "role": "text-primary" }
  },
  "backgrounds": [ ... ],
  "borders": [ ... ],
  "gradients": [ ... ]
}
```

**Mapping:** Convert all `rgb()`/`rgba()` values from `colors.backgroundColors`, `textColors`, `borderColors` to hex. Group by role (background, text, border, gradient). Match against Tailwind palette names where possible.

#### 9f. `specs/assets/design-system/breakpoints.json` — Named Breakpoints

Write to: `./specs/assets/design-system/breakpoints.json`

```json
{
  "sm": { "width": "640px", "tailwind": "sm:" },
  "md": { "width": "768px", "tailwind": "md:" },
  "lg": { "width": "1024px", "tailwind": "lg:" },
  "xl": { "width": "1280px", "tailwind": "xl:" },
  "2xl": { "width": "1536px", "tailwind": "2xl:" }
}
```

**Source:** `breakpoints.namedBreakpoints`.

#### 9g. `specs/assets/design-system/z-index.json` — Z-Index Scale

Write to: `./specs/assets/design-system/z-index.json`

```json
{
  "layers": [
    { "name": "content", "value": 0, "usage": "Default stacking context" },
    { "name": "elevated", "value": 10, "usage": "Cards, overlays within content" },
    { "name": "header", "value": 40, "usage": "Sticky header bar" },
    { "name": "sidebar", "value": 50, "usage": "Navigation sidebar" }
  ],
  "max": 50
}
```

**Source:** `zIndex.values`. Layer names are inferred from `components` data — match z-index values to the components that use them.

#### 9h. `specs/assets/design-system/icons/` — Individual SVG Files

Write to: `./specs/assets/design-system/icons/`

For each page's `svgs.json`, extract the `outerHTML` of each unique SVG. Deduplicate across pages (same SVG path data = same icon). Write each as an individual `.svg` file.

**Naming convention:**
1. If the SVG's `parentSelector` or surrounding text content gives a clear label (e.g., "Home", "Trends", "Settings"), use that: `home.svg`, `trends.svg`
2. Otherwise, use a descriptive name based on the SVG path shape: `chevron-left.svg`, `search.svg`, `arrow-right.svg`
3. For unidentifiable shapes, use `icon-{n}.svg`

**Deduplication:** Compare SVG `outerHTML` (stripped of class attributes and whitespace) across all pages. Same path data = same file, referenced from multiple pages.

#### 9i. Summary Line

Add the design-system output to the Phase 8 summary:
```
Design system: specs/assets/design-system/ — {n} CSS files, {n} JSON files, {n} SVG icons
```

### Phase 9.5: DELETED

Phase 9.5 (Publish to specs/assets) is no longer needed. Design tokens and components are now written directly to `specs/assets/` in Phases 9 and 10, making publish-as-copy obsolete. The canonical output location is unified.

### Phase 10: Component Kit Generation

**Skip** this phase if `componentsEnabled` is `false` (`--components false`).

Generate structured component blueprints and documentation from the raw extraction. This is an **LLM reasoning phase** — it reads existing JSON outputs and generates the component-kit. No new browser extraction scripts required.

#### 10a. Component Identification

**Input:** Per-page `structure.json` (all viewports), `design-tokens.json`, `canvas.json`, `svgs.json`

**Algorithm:**
1. **Landmark-based grouping** — HTML5 landmarks are component boundaries: `<aside>` = Sidebar, `<header>` = Header, `<nav>` = Navigation, `<main>` = Main Content, `<footer>` = Footer
2. **Repeated-structure detection** — In `structure.json`, look for `_repeated` markers and sibling groups with identical tag+class patterns. Each group = a card/list-item component (e.g., nav items, module cards, creation cards)
3. **Role-based extraction** — Elements with `role="button"`, `role="search"`, `role="dialog"` etc. = interactive components
4. **Canvas-based extraction** — Each entry in `canvas.json` with `sourceComponents[]` = a WebGL component

**Output per component** (`specs/assets/components/{name}/spec.json`):
```json
{
  "name": "module-card",
  "type": "repeated",
  "source": {
    "page": "/",
    "selector": "div.grid > div",
    "structureFile": "pages/home/structure.json"
  },
  "instances": 6,
  "dimensions": {
    "desktop": { "width": 322, "height": 105 },
    "tablet": { "width": "auto", "height": 105 },
    "mobile": { "width": "100%", "height": 106 }
  },
  "layout": {
    "parentGrid": {
      "columns": 3,
      "rows": 2,
      "gap": "12px",
      "computed": "322px 322px 322px"
    },
    "iconPosition": "right",
    "contentFlow": "column"
  },
  "styles": {
    "background": "rgba(255, 255, 255, 0.2)",
    "border": "1px solid rgba(255, 255, 255, 0.4)",
    "borderRadius": "12px",
    "backdropFilter": "blur(24px)"
  },
  "variants": [
    {
      "name": "active",
      "trigger": "enabled module",
      "styleOverrides": { "cursor": "pointer" }
    },
    {
      "name": "disabled",
      "trigger": "coming-soon module",
      "styleOverrides": { "opacity": "0.5", "cursor": "not-allowed" }
    }
  ],
  "content": [
    { "label": "Trends", "subtitle": "MARKET INTELLIGENCE", "icon": "trends.svg" },
    { "label": "Ideation", "subtitle": "GENERATE CONCEPTS", "icon": "ideation.svg" },
    { "label": "Production", "subtitle": "SCALE & TRANSLATE", "icon": "production.svg" },
    { "label": "Library", "subtitle": "INSPIRATION & ASSETS", "icon": "library.svg" },
    { "label": "Governance", "subtitle": "COMPLIANCE CHECK", "icon": "governance.svg" },
    { "label": "My Folder", "subtitle": "SAVED PROJECTS", "icon": "folder.svg" }
  ]
}
```

#### 10b. Page Layout Extraction

**Input:** Per-page `structure.json`, identified components from 10a

**Output per page** (`specs/assets/layout/{page}.json`):
```json
{
  "page": "/",
  "title": "Home",
  "sections": [
    {
      "name": "hero",
      "order": 1,
      "heading": { "text": "AcmeStudio", "tag": "h1", "font": "Montserrat 900 + light" },
      "subtitle": { "text": "Welcome to your Acme creative assistant...", "style": "italic serif" }
    },
    {
      "name": "search-bar",
      "order": 2,
      "component": "search-bar"
    },
    {
      "name": "module-grid",
      "order": 3,
      "component": "module-card",
      "grid": { "columns": 3, "rows": 2, "gap": "12px" }
    },
    {
      "name": "latest-creations",
      "order": 4,
      "component": "latest-creations-card",
      "grid": { "columns": 4, "gap": "16px" },
      "header": { "title": "LATEST CREATIONS", "action": "VIEW ALL" }
    }
  ],
  "background": {
    "type": "webgl",
    "component": "webgl-threads",
    "fallback": "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(168,85,247,0.1))"
  }
}
```

#### 10c. Semantic Token Mapping

**Input:** `design-tokens.json`, component JSONs from 10a

**Algorithm:** For each raw token value used in components, assign a semantic name based on the component context where it appears most frequently.

**Output** (`specs/assets/tokens/semantic-tokens.json`):
```json
{
  "colors": {
    "sidebar-bg": { "value": "rgba(2, 4, 16, 0.8)", "usage": "sidebar background" },
    "sidebar-border": { "value": "rgba(255, 255, 255, 0.05)", "usage": "sidebar right border" },
    "card-bg": { "value": "rgba(255, 255, 255, 0.2)", "usage": "module card, creation card" },
    "card-border": { "value": "rgba(255, 255, 255, 0.4)", "usage": "module card, creation card" },
    "nav-active-bg": { "value": "rgba(59, 130, 246, 0.1)", "usage": "active nav item background" },
    "accent-blue": { "value": "#60a5fa", "usage": "active states, logo highlight" }
  },
  "layout": {
    "sidebar-width-expanded": { "value": "256px" },
    "sidebar-width-collapsed": { "value": "64px" },
    "header-height": { "value": "64px" },
    "module-grid-columns": { "value": 3 },
    "module-grid-gap": { "value": "12px" },
    "creations-grid-columns": { "value": 4 },
    "creations-grid-gap": { "value": "16px" }
  },
  "effects": {
    "sidebar-blur": { "value": "blur(30px)" },
    "card-blur": { "value": "blur(24px)" },
    "sidebar-shadow": { "value": "rgba(0,0,0,0.5) 10px 0px 30px -10px" }
  }
}
```

#### 10d. Component Documentation

**Input:** Component JSONs, layout JSONs, `canvas.json`, screenshots

**Output per component** (`specs/assets/components/{name}/README.md`):

Each doc file follows a strict template:

```markdown
# {Component Name}

## Structure
{2-4 sentences describing what this component is and its role in the page}

## Layout
{Grid/flex details, responsive behavior across breakpoints}

## States
{Variants: default, active, hover, disabled — what changes between them}

## Content
{Text content, labels, counts — the actual data}

## Animation
{Transitions, WebGL behavior, timing — if applicable}

## Key Tokens
{List of semantic tokens used by this component}

## Source Reference
- Structure: `pages/{page}/structure.json` selector: `{selector}`
- Screenshot: `pages/{page}/screenshot-1440.png`
```

For WebGL components specifically (`docs/webgl-threads.md`):
```markdown
# WebGL Threads Background

## Visual Description
40 animated Perlin-noise lines flowing horizontally across the viewport.
Blue-tinted (RGB 0.2, 0.3, 0.5), semi-transparent, mouse-reactive.
Lines converge on the left and spread/undulate on the right.

## Behavior
- Time-based animation: slow wave at time/10.0 speed
- Mouse X influence: offsets time-based animation
- Mouse Y influence: modulates wave amplitude (±20%)
- Mouse smoothing: 0.05 lerp factor per frame
- Mouseleave: resets to center (0.5, 0.5)

## Shader Constants
- Line count: 40
- Line width: 7.0px
- Line blur: 10.0px

## Performance
- Library: OGL (not Three.js)
- Blend: SRC_ALPHA / ONE_MINUS_SRC_ALPHA
- DPR: window.devicePixelRatio
- Reduced motion: static single frame, no animation loop

## Source Reference
- Shader source: `pages/home/canvas.json` → shaders[1] (vertex), shaders[2] (fragment)
- Component source: `pages/home/canvas.json` → sourceComponents[0] (Threads.tsx)
```

**Critical rule for doc generation:** Every fact in a doc file MUST be traceable to a specific value in the raw JSON. No invented properties. Each doc includes a "Source Reference" section pointing to the exact JSON file + path.

#### 10e. Component Kit Manifest

Write `component-kit-{domain}/manifest.json`:

```json
{
  "meta": {
    "generatedAt": "<ISO timestamp>",
    "sourceExtraction": "reverse-ui-{domain}/",
    "pages": ["/", "/ideation"]
  },
  "components": [
    { "name": "sidebar", "file": "components/sidebar.json", "doc": "docs/sidebar.md" },
    { "name": "header", "file": "components/header.json", "doc": "docs/header.md" },
    { "name": "module-card", "file": "components/module-card.json", "doc": "docs/module-card.md" }
  ],
  "layouts": [
    { "page": "/", "file": "layout/home.json" },
    { "page": "/ideation", "file": "layout/ideation.json" }
  ],
  "tokens": "tokens/semantic-tokens.json"
}
```

#### 10f. Summary Line

Add the component kit output to the Phase 8 summary:
```
Component kit: {kitPath}/ — {n} components, {n} page layouts, {n} docs, {n} semantic tokens
```

---

## Design Token Categories

The `design-tokens.json` contains (see `scripts/extract-design-system.js`):

- `colors` — CSS custom properties, background/text/border colors, gradients. **Source-code enrichment** adds `intentionalTokens[]` — clean custom properties filtered from `--tw-*` noise, with scope and provenance
- `typography` — font faces, families, size scale, weights, line-heights, letter-spacings, detected scale ratio. **Source-code enrichment** populates `fontFaces[]` from Google Fonts/Fontshare URL parsing and adds `fontFamilyMap` mapping selectors to font stacks
- `spacing` — values, detected base unit, gap values
- `borders` — widths, styles, radii
- `shadows` — box-shadows, text-shadows, drop-shadows
- `animations` — keyframes (with `usedBy[]` element linkage), transitions, durations, easing functions. **Source-code enrichment** adds keyframes from `<style>` blocks, CSS files, and Tailwind config that CORS-blocked extraction missed
- `breakpoints` — media queries with rule counts, extracted width values. **Source-code enrichment** adds `namedBreakpoints` from Tailwind config or defaults (e.g., `{ "sm": "640px", "md": "768px" }`)
- `zIndex` — all values, max
- `components` — inferred components with selector, occurrences, DOM structure, key styles
- `layout` — grid patterns, flex patterns, container max-widths
- `icons` — inline SVG count/sizes, icon font families
- `states` — hover/focus/active/disabled rules from stylesheets (with `transition` timing from base rule when available)

## Page Structure Schema

Each `structure.json` contains (see `scripts/extract-page-structure.js`):

- `page` — URL, title, meta description, viewport
- `sections[]` — semantic DOM tree rooted at landmark elements (header, nav, main, section, aside, footer)
  - Each node: tag, selector, role, boundingBox, styles (~40 key properties including animation/transition sub-properties), text, attributes (including animation data attrs), asset ref, pseudoElements (`::before`/`::after` with content + styles), children
  - Repetitive siblings (5+ same structure) are collapsed: 2 examples + `_repeated` marker with count
- `textContent` — flat maps: headings, paragraphs, buttons, links, labels, inputs (quick access to all copy)

## Interactions Schema

Each `interactions.json` contains (see `scripts/extract-interactions.js`):

- `animationLibraries[]` — detected runtime libraries (GSAP, AOS, ScrollReveal, Framer Motion, anime.js, etc.) with name and version
- `scrollAnimations.dataAttributes[]` — animation data attributes found on elements (`data-aos`, `data-scroll`, `data-parallax`, etc.) with value and count
- `scrollAnimations.scrollClasses[]` — scroll-triggered CSS classes (`aos-animate`, `is-inview`, `animate__animated`, etc.) with count
- `scrollAnimations.cssScrollTimelines[]` — native CSS `animation-timeline`, `scroll-timeline-name`, `view-timeline-name` properties
- `summary` — `hasScrollAnimations`, `primaryLibrary`, `animatedElementCount`

## Limitations

- CORS-restricted external stylesheets cannot be read (logged in `meta.inaccessibleStylesheets`)
- Closed Shadow DOM is not accessible
- Component detection uses class frequency heuristics — may miss CSS-in-JS with hashed class names
- DOM tree is capped at depth 6 per section
- Repetitive sibling groups show only 2 examples
- Element sampling capped at 500 unique tag+class combinations for token extraction
- Pseudo-element extraction capped at 200 per page
- Animation library detection requires globals on `window` — libraries that don't expose globals (e.g., bundled ES modules with no side effects) may be missed
- GIF capture requires `mcp__claude-in-chrome__gif_creator` — skipped gracefully if unavailable
- JavaScript-driven animations (e.g., GSAP timelines, requestAnimationFrame loops) are detected by library presence but their specific timeline/sequence logic is not extracted
- Source-code enrichment (Phase 5c) requires a localhost/127.0.0.1/0.0.0.0 base URL and accessible source files in the working directory. For remote URLs, only browser extraction is available
- Component kit (Phase 10) is LLM-generated from extraction data — component boundaries are heuristic (landmark + repeated-structure detection) and may not match the original component architecture exactly

For detailed edge cases and troubleshooting, see `references/extraction-guide.md`.
