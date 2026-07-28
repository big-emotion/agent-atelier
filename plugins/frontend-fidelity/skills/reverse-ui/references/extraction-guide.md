# Extraction Guide — Edge Cases and Troubleshooting

## CSS Custom Properties Deep Extraction

The script extracts CSS custom properties from all `CSSStyleRule` instances across stylesheets. Key considerations:

- **Scoped variables**: Variables defined on component classes (not just `:root`) are captured. The `usageCount` reflects how many rules define the same variable.
- **Fallback values**: `var(--color, #fff)` — the script captures the definition, not usage sites. Fallback values in `var()` calls are not tracked.
- **Computed resolution**: If a variable references another variable (`--primary: var(--blue-500)`), only the raw declaration is captured, not the resolved value. To get resolved values, check the computed style extraction results.

## Font Detection Accuracy

The script cross-references two sources:
1. `@font-face` declarations — what fonts are *declared* in stylesheets
2. Computed `fontFamily` on sampled elements — what fonts are *actually used*

Discrepancies to watch for:
- A font declared but never used (dead CSS)
- A font used via system fallback because the web font failed to load
- Google Fonts loaded via `<link>` tag — the `@font-face` rules are in the external stylesheet, which may be CORS-blocked

**Workaround for CORS-blocked font stylesheets**: Check `document.fonts` API manually:
```javascript
Array.from(document.fonts).map(f => ({ family: f.family, weight: f.weight, status: f.status }))
```

## Spacing Scale Detection

The script uses a GCD (Greatest Common Divisor) algorithm to detect a base spacing unit:
1. Collect all unique padding/margin/gap values in px
2. Compute the GCD across all values
3. If GCD >= 2px, report it as the base unit

**Limitations:**
- Values like `15px` in an otherwise 4px-based system will break GCD detection
- Percentage, em, rem values are collected but not included in GCD calculation
- Auto margins are excluded

## Component Inference Heuristics

Component detection uses class name frequency analysis, not framework-specific detection.

**Strategy:**
1. Count occurrences of each CSS class across all elements
2. Identify BEM-like block names (classes without `__` or `--`)
3. Check if a class has BEM elements (`block__element`) or modifiers (`block--modifier`)
4. Classes appearing 3+ times with BEM children are likely components

**Known limitations:**
- **Tailwind/Utility CSS**: No component-like class names exist. Components are only detectable via repeated DOM structure patterns, which is not currently implemented.
- **CSS Modules**: Hashed class names (e.g., `_card_1a2b3`) lose semantic meaning. BEM detection will fail.
- **CSS-in-JS** (styled-components, emotion): Similar to CSS Modules — hashed, non-semantic class names.
- **Web Components**: Custom elements (`<my-card>`) are detected by tag name, not class. The script does not currently catalog custom element tag names.

**Improvement path**: For Tailwind/utility-based sites, analyze DOM structure similarity (same tag nesting pattern repeated N times) rather than class names.

## Handling Single Page Applications (SPAs)

SPAs load content dynamically. The scroll step (Step 3) triggers lazy-loaded content, but may miss:
- Route-based content (only the current route's components are in the DOM)
- Modal/dialog content (not rendered until triggered)
- Dropdown menu content

**Recommendation**: For SPAs, run `/reverse-ui` multiple times on different routes and merge the JSON outputs. Focus on the most content-rich pages (dashboards, settings, forms).

## Shadow DOM

- **Open shadow roots** (`mode: 'open'`): The script traverses these via `element.shadowRoot` and samples up to 100 additional elements from shadow trees.
- **Closed shadow roots** (`mode: 'closed'`): Completely inaccessible. No workaround exists from JavaScript injection.
- **Declarative shadow DOM**: Same as open — accessible if `mode: 'open'`.

## CSS-in-JS Runtime Styles

Styles injected via `<style>` tags at runtime (React, Vue, Svelte) are accessible because they are same-origin. However:
- Class names may be hashed/obfuscated
- Styles may be split across many `<style>` tags
- The script reads all `document.styleSheets`, including runtime-injected ones

## CORS-Restricted Stylesheets

When a stylesheet is loaded from a different origin (e.g., `fonts.googleapis.com`, a CDN), accessing `.cssRules` throws `SecurityError`. The script:
1. Catches the error
2. Logs the stylesheet URL in `meta.inaccessibleStylesheets`
3. Continues with the remaining stylesheets

**Impact**: External stylesheets may contain `@font-face` declarations, CSS reset rules, or utility classes that are missed.

**Workaround**: If the missing styles are critical:
1. Download the external stylesheet manually
2. Inline it in the page via DevTools
3. Re-run the extraction

## Output Size Management

Each category has hard caps to prevent output explosion:

| Category | Max entries |
|----------|-------------|
| Colors (per type) | 200 |
| Components | 50 |
| Animations/Keyframes | 100 |
| State rules (per state) | 100 |
| Gradients | 50 |
| Shadow DOM elements | 100 |

Categories that hit their cap have `_truncated: true` set. If truncation occurs frequently, consider narrowing the extraction scope (e.g., scoping to a specific container via `agent-browser frame` or by modifying the script's root element).

## Troubleshooting

### Script returns empty or minimal data
- The page may not be fully loaded — increase wait time before extraction
- The app may be inside an iframe — verify Step 2 detection worked
- Content may be behind authentication — ensure the session is authenticated

### Large output truncated by agent-browser
- Set `AGENT_BROWSER_MAX_OUTPUT=100000` before running
- Or split extraction into multiple eval calls (one per category)

### Screenshots show blank or loading states
- Increase wait time between viewport change and screenshot
- Add explicit waits for specific elements: `agent-browser wait ".main-content"`

### Components section is empty
- The site likely uses utility CSS (Tailwind) or CSS-in-JS with hashed classes
- Manual component cataloging may be needed — use annotated screenshots (`agent-browser screenshot --annotate`) to visually identify components

## Multi-Page Extraction (v2.0)

### How it works
The skill accepts a comma-separated list of routes. Design tokens are extracted once (they come from stylesheets which are shared across pages). Page structure and assets are extracted per page.

### Navigation between pages — SPA vs MPA

**SPAs (React, Vue, Svelte, SvelteKit, Next.js):** Do NOT use `agent-browser open <url>` for page-to-page navigation. A full page load will:
- Reset the SPA to its initial route (often `/`)
- Lose client-side state (auth tokens in memory, store data)
- Re-trigger loading screens instead of showing the target page

Instead, use in-page navigation: find the nav link/button via `agent-browser snapshot -i`, then `agent-browser click @eN`.

**How to detect an SPA:** After the first page load, check if the page has a persistent navigation shell (sidebar, header nav) with buttons or links to other sections. If the navigation uses `<button>` elements instead of `<a href>` tags, it's almost certainly an SPA with client-side routing.

**Traditional MPAs:** Use `agent-browser open <origin + path>` normally.

### Route-specific content
SPA frameworks (React, Vue, Svelte) render route-specific components. The per-page structure extraction captures whatever is in the DOM after navigation + lazy scroll. Modals and dropdowns that are not open during extraction will be missing.

### Merging token data
Design tokens are global (extracted once on the first page). If a specific page imports additional stylesheets not loaded on the first page, those tokens will be missed. For sites with per-page CSS bundles, consider running the token extraction on the most content-rich page.

## Chunked Page Structure Output

### When chunking occurs
If a page's `structure.json` exceeds 80,000 characters when serialized, the extraction script automatically chunks the output.

### Chunk format
- **Chunk 0**: Contains `page` metadata + `textContent` map + `_sectionCount`
- **Chunks 1..N**: Each contains one top-level section (the DOM subtree rooted at a landmark element)

### Retrieval
The SKILL.md workflow retrieves chunks via `agent-browser eval "window.__REVERSE_UI_CHUNKS[i]"`. Each chunk is already a JSON string that can be parsed independently.

### Reassembly
```javascript
// Chunk 0 → base object with page + textContent
// Chunks 1..N → push into sections[]
base.sections = [chunk1, chunk2, ..., chunkN];
```

## Asset Deduplication

The `extract-assets.js` script uses `window.__REVERSE_UI_ASSETS` as an accumulator across page navigations. Assets found on multiple pages are deduplicated:
- **Images**: by `src` URL
- **SVGs**: by `pathHint` (first `<path d>` attribute, min 10 chars)
- **Fonts**: by `family` name (weights and sources are merged)
- **Background images**: by `src` URL

Each asset tracks a `pages[]` array showing which routes it appeared on.

## Page Structure Edge Cases

### Depth limiting
The DOM walker traverses to a maximum depth of 6 levels from each landmark section root. Deeply nested structures (e.g., complex data tables, nested menus) may be cut off. The implementation agent should use the annotated screenshots to identify such areas and request targeted HTML extraction if needed.

### Repetitive sibling collapsing
When 5+ consecutive siblings share the same tag+class+child-tag structure, only the first 2 are captured in full. A `_repeated` marker notes how many were omitted. This handles: product grids, list items, table rows, card decks.

### Missing landmarks
If a page has no semantic landmark elements (`<header>`, `<main>`, etc.), the script falls back to direct children of `<body>`. This may produce a less meaningful section breakdown.

### SVG-heavy pages
Inline SVGs with complex paths generate large JSON. The `pathHint` in asset extraction is capped at 60 chars. For full SVG reproduction, use `agent-browser get html "svg.specific-class"` to extract individual SVGs.

### Canvas / WebGL — Full Extraction Pipeline

Canvas/WebGL content goes through a three-stage extraction:

**Stage 1 — Canvas detection (`extract-canvas.js`):**
- Finds all `<canvas>` elements, their dimensions, context type (2d, webgl, webgl2)
- Identifies the parent container's CSS positioning (absolute, z-index, etc.)
- Detects WebGL libraries loaded by the page (OGL, Three.js, Pixi.js, Babylon.js, etc.)
- Captures a static frame as base64 PNG (when the canvas is not tainted by CORS)

**Stage 2 — Shader extraction (`extract-shaders.js`):**
- Fetches all same-origin JS bundles via the `performance` API
- Searches bundle source code for GLSL shader strings (vertex + fragment)
- Extracts complete shader source from template literals or quoted strings
- Classifies shaders as vertex (`gl_Position`) or fragment (`gl_FragColor`/`gl_FragCoord`)
- Parses uniform declarations from the GLSL code
- Finds the uniform setup block (initial values, types) near the shader in the JS bundle
- Returns the full shader source + uniforms + library info

**Stage 3 — Reconstruction:**
The implementation agent uses the extracted data to build a WebGL component:
1. Install the detected library (e.g., `npm install ogl`)
2. Create a component with the extracted vertex + fragment shaders
3. Set up uniforms with the extracted default values
4. Configure the canvas container with the extracted CSS positioning
5. Add animation loop (requestAnimationFrame) and resize handling

**Limitations:**
- **Cross-origin scripts:** Bundles from CDNs (unpkg, cdnjs, jsdelivr) cannot be fetched due to CORS. The library is detected by URL but shader source won't be available. Workaround: download the bundle manually and host it locally.
- **Minified production builds:** Shader strings survive minification (they're string literals), but variable names around them may be mangled, making uniform setup harder to parse. Dev builds produce much cleaner results.
- **WASM-based renderers:** Unity WebGL, Unreal Engine, and Godot compile shaders into WASM modules — not extractable from JS bundles. Only the canvas metadata and a static frame are available.
- **Canvas 2D:** Not shader-based. The `extract-canvas.js` detects 2D contexts but `extract-shaders.js` won't find anything. For 2D canvas reproduction, the static frame + screenshots are the primary reference.
- **Tainted canvases:** If the canvas uses cross-origin images without CORS headers, `toDataURL()` will fail. The static frame will note "(CORS or tainted canvas)".

**Dev vs Production extraction quality:**

| Aspect | Dev build | Production build |
|--------|-----------|-----------------|
| Shader source | Full, readable | Full (string literals survive minification) |
| Variable names | Original names | Mangled (a, b, c) |
| Uniform setup | Easily parseable | May be obscured |
| Bundle size | Larger (unminified) | Smaller |
| Source maps | Often available | Usually stripped |

## Animation and Interaction Extraction

### What's captured

The extraction pipeline captures animations at three levels:

**1. CSS animation properties on elements** (`extract-page-structure.js`):
Each element in `structure.json` now includes full animation and transition sub-properties when non-default:
- `animationName`, `animationDuration`, `animationDelay`, `animationIterationCount`, `animationDirection`, `animationFillMode`, `animationPlayState`, `animationTimingFunction`
- `transitionProperty`, `transitionDuration`, `transitionDelay`, `transitionTimingFunction`
- `transformOrigin`, `perspective`, `transformStyle`, `backfaceVisibility`, `willChange`

Default values are filtered out (e.g., `animationName: 'none'`, `transitionDuration: '0s'`).

**2. Keyframe-to-element linkage** (`extract-design-system.js`):
Each keyframe in `design-tokens.json` now includes a `usedBy[]` array linking it to the CSS selectors that reference it, with full timing info:
```json
{
  "name": "fadeIn",
  "frames": { "0%": { "opacity": "0" }, "100%": { "opacity": "1" } },
  "usedBy": [
    {
      "selector": ".hero-title",
      "duration": "0.6s",
      "delay": "0s",
      "iterationCount": "1",
      "direction": "normal",
      "fillMode": "forwards",
      "timingFunction": "ease-out"
    }
  ]
}
```

**3. State rule transition timing** (`extract-design-system.js`):
`:hover`, `:focus`, `:active`, and `:disabled` state rules now include the `transition` timing from the base selector when available:
```json
{
  "selector": ".btn:hover",
  "properties": { "background-color": "#0066cc" },
  "transition": {
    "property": "background-color",
    "duration": "0.2s",
    "delay": "0s",
    "timingFunction": "ease"
  }
}
```

**4. Animation libraries and scroll triggers** (`extract-interactions.js`):
A separate `interactions.json` per page detects:
- Runtime library globals (GSAP, AOS, ScrollReveal, Framer Motion, anime.js, Lenis, etc.)
- Animation data attributes (`data-aos`, `data-scroll`, `data-parallax`, etc.)
- Scroll-triggered CSS classes (`aos-animate`, `is-inview`, `animate__animated`, etc.)
- Native CSS scroll timelines (`animation-timeline`, `scroll-timeline-name`, `view-timeline-name`)

### Limitations — what's NOT captured

- **GSAP timeline sequences**: The script detects GSAP's presence but cannot extract timeline definitions (they're imperative JS, not declarative CSS/HTML)
- **requestAnimationFrame loops**: Custom animation loops are invisible to static extraction
- **Intersection Observer callbacks**: JS-driven scroll animations without data attributes are missed
- **Animation state at extraction time**: Elements may be mid-animation when extracted; the captured CSS values reflect the computed state at that moment, not the animation's start/end
- **Cross-origin animation libraries**: If a library is loaded from a CDN without exposing globals (e.g., ES module import), detection fails

### Reconstruction guidance for AI consumers

1. Check `interactions.json` first — if a library is detected (e.g., AOS), install it and configure using the data attributes from `structure.json`
2. Use keyframe `usedBy[]` to recreate CSS animations with correct timing per element
3. Use state rule `transition` timing to reproduce hover/focus effects
4. Reference `animations.gif` as visual ground truth for motion behavior

## Pseudo-Element Extraction

### What's captured

For each visible element, `::before` and `::after` pseudo-elements are checked. If their `content` property is non-trivial (not `none`, `normal`, or `""`), the pseudo-element's key visual styles are extracted using the same property set as regular elements.

**Output on a structure node:**
```json
{
  "pseudoElements": {
    "::before": { "content": "'→'", "color": "#333", "fontSize": "14px" },
    "::after": { "content": "''", "backgroundColor": "#0066cc", "width": "100%", "height": "2px" }
  }
}
```

### Limitations

- **Cap**: Maximum 200 pseudo-elements per page to prevent output bloat
- **Dynamic content**: Pseudo-elements with `content: attr(data-count)` capture the resolved value at extraction time, not the `attr()` expression
- **Animations on pseudo-elements**: Animation properties are captured, but keyframe linkage (`usedBy[]`) does not track pseudo-element selectors separately
- **Counter-based content**: `content: counter(...)` resolves to the current counter value

## GIF Animation Capture

### What it records

The GIF capture phase (4i) records a ~15-30 second screencast of the page in motion:
1. Initial viewport state
2. Full page scroll (triggers scroll animations, parallax, fade-ins)
3. Scroll back to top
4. Hover over 3-5 interactive elements (triggers transition effects)

### Purpose

The GIF serves as **visual ground truth** for AI consumers rebuilding the site. JSON extraction captures *what* animates and *how* (timing, easing), but the GIF captures the *feel* — the overall choreography, scroll speed, parallax depth, and interaction responsiveness.

### Limitations

- Requires `mcp__claude-in-chrome__gif_creator` — skipped if unavailable
- Frame rate is limited by the browser extension's capture capability
- Hover interactions depend on correctly identifying interactive elements from the snapshot
- ~2-5MB per page; cumulative size may be significant for multi-page extractions
- Does not capture modal/dialog animations (these require click triggers, not scroll/hover)

## Source-Code Enrichment (Phase 5c)

Phase 5c runs after browser extraction when the target is localhost. It uses Claude's native tools (Glob, Grep, Read) to analyze the local source code and fill gaps the browser can't cover.

### When it runs

Automatically enabled when `baseUrl` contains `localhost`, `127.0.0.1`, or `0.0.0.0`. Skipped for remote URLs. The project root is the current working directory.

### Search patterns

**Exclude directories** from all searches: `node_modules`, `dist`, `build`, `.next`, `.svelte-kit`, `.nuxt`, `coverage`, `.cache`.

#### A. CSS Animations & Transitions

```
Glob:  **/*.{css,scss,less,html,svelte,vue,astro}
Grep:  @keyframes\s+(\w[\w-]*)           → extract name + full block
Grep:  transition:\s*[^;]+               → extract property, duration, easing
Grep:  animation:\s*[^;]+                → extract shorthand values
File:  tailwind.config.{js,ts,mjs,cjs}   → theme.extend.keyframes, theme.extend.animation
File:  index.html                         → <style> blocks containing @keyframes
```

For each `@keyframes` match, read the file and extract the full block (from `@keyframes name {` to the closing `}`). Parse frame selectors (`0%`, `from`, `to`, `100%`) and their property declarations.

#### B. Typography / Font Scale

```
File:  index.html                         → <link> tags with href containing fonts.googleapis.com or api.fontshare.com
Parse: URL query params                   → family=Name:wght@300;400;500 → { family, weights[] }
Grep:  font-family:\s*[^;]+              → in *.css, *.html <style>, *.tsx, *.jsx
File:  tailwind.config.*                  → theme.extend.fontFamily
Grep:  @font-face                         → in *.css (self-hosted fonts)
```

Google Fonts URL parsing example:
- URL: `https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=Noto+Sans:wght@400;500;600;700&display=swap`
- Result: `[{ family: "Montserrat", weights: [300,400,500,600,700,800,900] }, { family: "Noto Sans", weights: [400,500,600,700] }]`

Fontshare URL parsing:
- URL: `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap`
- Result: `[{ family: "Satoshi", weights: [400,500,700] }]`

#### C. Breakpoints / Media Queries

```
File:  tailwind.config.*                  → theme.screens (e.g., { sm: '640px', md: '768px' })
Grep:  @media\s*\([^)]*\)                → in *.css, *.scss, *.html <style>
Parse: min-width/max-width values         → extract px/em breakpoint values
File:  index.html                         → <script> with tailwind.config = { ... } (CDN pattern)
```

Tailwind CDN detection: If no `tailwind.config.*` file exists but `index.html` contains a `<script src="...cdn.tailwindcss.com...">`, check for an inline `<script>` containing `tailwind.config = {`. If that also doesn't exist, use Tailwind v3/v4 defaults:
```json
{ "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px" }
```

#### D. WebGL/3D Component Wiring

```
Grep:  from ['"]ogl['"]                   → OGL components
Grep:  from ['"]three['"]                 → Three.js components
Grep:  from ['"]@react-three             → React Three Fiber
Grep:  from ['"]pixi                      → PixiJS
```

For each matched file, read the full component (cap at 500 lines) and extract:
- **Component name**: from `export default function Name` or `const Name =`
- **Props**: from function signature or TypeScript interface, including default values
- **Renderer config**: `new Renderer({ alpha, premultipliedAlpha, ... })`
- **Geometry**: `new Triangle()`, `new PlaneGeometry()`, etc.
- **Uniforms**: `uniform: { name: { value: ... } }` or `program.uniforms.name`
- **Event handlers**: `addEventListener('resize'`, `addEventListener('mousemove'`, etc.
- **Animation loop**: presence of `requestAnimationFrame` or `renderer.setAnimationLoop`

Cap: 5 component files maximum to avoid context exhaustion.

#### E. CSS Custom Properties (Clean Tokens)

```
Grep:  --(?!tw-)[a-zA-Z][\w-]*:\s*[^;]+  → custom properties excluding --tw-* in *.css, *.html
File:  tokens.css, variables.css, theme.css, design-tokens.* → dedicated token files
File:  tailwind.config.*                  → theme.extend.colors, spacing, etc.
File:  index.html                         → :root { } blocks in <style>
```

Filter rules:
- Exclude `--tw-*` (Tailwind internals)
- Exclude `--un-*` (UnoCSS internals)
- Include everything else — these are intentional design tokens

### Merge algorithm

For all categories, the principle is **extend, never replace**.

1. Read the existing browser-extracted JSON file
2. For each source-code finding:
   - If no matching entry exists in browser data → append with `_source: "source-code"`
   - If a matching entry exists (same name/key) → keep both, mark browser entry with `_source: "browser"`, source entry with `_source: "merged"`
3. Write back the enriched JSON

Matching criteria per category:
- Keyframes: match by animation name
- Font faces: match by family name (merge weights)
- Breakpoints: match by width value
- WebGL components: no merge — `sourceComponents[]` is always new
- CSS custom properties: match by property name

### Monorepo detection

The skill searches the current working directory. In monorepos, the dev server often runs from a subdirectory. To avoid searching the entire monorepo:

1. Find the nearest `package.json` to cwd (usually in cwd itself)
2. If `pnpm-workspace.yaml`, `lerna.json`, or root `workspaces` field exists in a parent directory, constrain the search to the current package directory
3. Use the directory containing `vite.config.*`, `next.config.*`, `svelte.config.*`, or `nuxt.config.*` as the search root if it differs from cwd

### Tailwind CDN vs installed

| Signal | Tailwind type |
|--------|--------------|
| `tailwind.config.*` file exists | Installed (PostCSS or Vite plugin) |
| `<script src="...cdn.tailwindcss.com...">` in HTML | CDN |
| `<script>tailwind.config = { ... }</script>` in HTML | CDN with custom config |
| None of the above | Not using Tailwind |

For CDN with custom config, parse the inline `tailwind.config` object for `theme.extend` values. For CDN without custom config, use default breakpoints and note that custom tokens are unlikely.

### Edge cases

- **No source files found**: If Glob returns no `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `*.css`, `*.html` files (excluding node_modules), skip Phase 5c entirely and log a warning
- **CSS preprocessors**: `.scss`, `.less`, `.styl` files use the same keywords (`@keyframes`, `@media`, `font-family`). Grep patterns work on raw source. Nested syntax (Sass nesting) may include `@keyframes` inside selectors — this is fine, the keyframe block is still valid
- **CSS-in-JS**: `styled-components`, `emotion`, etc. define styles in template literals within `.tsx`/`.jsx` files. The grep patterns catch `@keyframes` and `animation:` in these files too
- **Large projects**: Grep is fast even on large codebases. The only cap needed is on Read operations for WebGL components (5 files, 500 lines each)
- **No canvas.json**: Sub-phase D is skipped entirely — no error, no warning
