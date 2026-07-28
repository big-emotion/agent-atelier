# Axis Extraction Templates

One section per axis. Each section defines what to read, what to extract, how to structure the output, framework-specific hints, and quality rules.

---

## 1. Functional — `{view}.md` (one file per scoped view)

### What to read
- The view's root component file (e.g., `HomeView.tsx`, `IdeationView.vue`, `+page.svelte`)
- All direct children components imported by the view
- Shared store/state files accessed by the view
- Custom hooks or composables called by the view

### What to extract
- Component name and file path (with line reference)
- Props received (name, type, required/optional, default)
- Local state: variable name, type, initial value, what it controls
- Derived/computed values: name, formula, what it controls
- Side effects: trigger condition, what it does, dependencies
- Event handlers: name, trigger, full logic description, mutations caused
- Conditional rendering: condition expression, what renders true/false
- Routing: which routes navigate here, where it navigates to
- Data fetching: endpoint, method, when triggered, success/error handling
- Role-based gating: condition, what's shown/hidden to whom
- Loading states: what triggers, what UI changes, how it resolves

### Output structure
```markdown
# {View Name} — Functional Spec

**Companion docs:** [visual-{view}.md](visual-{view}.md) · [edge-cases.md](edge-cases.md) · [interaction-catalog.md](interaction-catalog.md)

## Component

| Field | Value |
|-------|-------|
| Component | `ComponentName` |
| File | `path/to/Component.tsx:1` |
| Route | `/path` |

## Props

| Prop | Type | Required | Default | Purpose |
|------|------|----------|---------|---------|

## State

| Variable | Type | Initial | Controls |
|----------|------|---------|---------|

## Computed / Derived

| Name | Formula | Controls |
|------|---------|---------|

## Side Effects

| Trigger | Effect | Dependencies |
|---------|--------|-------------|

## Event Handlers

### `handlerName` (`Component.tsx:NN`)
- Trigger: [what fires it]
- Logic: [step-by-step description]
- Mutations: [what state changes]

## Conditional Rendering

| Condition | True renders | False renders |
|-----------|-------------|--------------|

## Data Fetching

| Call | Endpoint | Method | Trigger | On success | On error |
|------|----------|--------|---------|-----------|---------|

## Access Control

| Role/Condition | Visible | Hidden |
|---------------|---------|--------|

## Observations

- [3-5 non-obvious insights about this view's logic or architecture]
```

### Framework-specific hints

| Framework | State pattern | Computed pattern | Effect pattern |
|-----------|--------------|-----------------|----------------|
| React | `useState`, `useRef`, `useReducer` | `useMemo`, derived vars | `useEffect` |
| Vue | `ref()`, `reactive()`, `defineProps()` | `computed()` | `watch()`, `watchEffect()` |
| Svelte | `$state`, `$props()`, `let` | `$derived` | `$effect` |
| Angular | `@Input()`, signals, `@ViewChild` | `computed()` | `effect()`, lifecycle hooks |

### Quality rules
- Never paraphrase handler logic — describe step-by-step what the code does
- Include line references for every handler (`Component.tsx:108-117`)
- State table must include every `useState`/`ref()`/`$state` — none may be omitted
- Conditional rendering: use the exact condition expression from source, not a natural-language rewrite

---

## 2. Visual Design — `visual-foundations.md`

### What to read
- Global CSS or SCSS files (`globals.css`, `index.scss`, `app.css`)
- Tailwind config (`tailwind.config.ts`, `tailwind.config.js`)
- CSS custom properties (`:root { --token: value }`)
- App shell / layout component (`App.tsx`, `_layout.svelte`, `AppLayout.vue`)
- Any theme file (`theme.ts`, `tokens.ts`, `design-tokens.ts`)
- Global loader/spinner component
- Background or canvas components (WebGL, gradient, GLSL shaders)

### What to extract
- Color tokens: all CSS variables, Tailwind color extensions, hex/rgba values
- Typography: font families (with import source), size scale, weight scale, line-height scale
- Spacing scale (if custom Tailwind config or CSS vars)
- Border radius scale
- Shadow definitions
- App shell structure: fixed/absolute elements, z-index layers, overflow behavior
- Background treatment: solid color, gradient, SVG, canvas, WebGL shader — include verbatim shader code if present
- Loader: trigger condition, animation type, duration, timing function
- Global animations / keyframes: name, duration, easing, what it affects
- Glass morphism or backdrop-filter effects: exact CSS values
- Dark/light mode: implementation approach, how toggled, which tokens change

### Output structure
```markdown
# Visual Foundations

**Companion docs:** [animation-trace.md](animation-trace.md) · [visual-mobile.md](visual-mobile.md)

## Color Tokens

| Token | Value | Usage |
|-------|-------|-------|

## Typography

| Scale | Font | Size | Weight | Line-height |
|-------|------|------|--------|------------|

## Spacing & Layout

| Token | Value |
|-------|-------|

## Borders & Shadows

| Token | Value |
|-------|-------|

## App Shell

[Describe fixed/sticky layers, z-index stack, overflow behavior]

## Background

[Include verbatim shader code / gradient definition / SVG]

## Loader

| Property | Value |
|----------|-------|

## Keyframes & Global Animations

[Include verbatim @keyframes definitions]

## Glass / Backdrop Effects

| Element | CSS |
|---------|-----|

## Theme / Dark Mode

[Implementation approach + which tokens change]

## Observations

- [3-5 non-obvious insights]
```

### Framework-specific hints

| Framework | Token approach | Theme pattern |
|-----------|--------------|---------------|
| React | CSS vars, Tailwind config, styled-components themes | `ThemeProvider`, `data-theme` attr, class toggle |
| Vue | CSS vars, UnoCSS config | `provide/inject`, Pinia theme store |
| Svelte | CSS vars, Tailwind | Svelte stores, `class:dark` |
| Angular | CSS vars, Angular Material theming | `@angular/material` theming, CSS class |

### Quality rules
- GLSL shader code: copy verbatim — never summarize or describe in prose
- CSS custom property values: copy exact hex/rgba/hsl — never round or approximate
- Tailwind config extensions: copy the exact object structure
- Keyframes: copy verbatim from source — never describe animation in prose only

---

## 3. Visual Per-Page — `visual-{view}.md` (one file per scoped view)

### What to read
- The view's root component and all child components
- Inline styles and Tailwind class lists on all JSX/template elements
- Any per-view CSS modules or scoped `<style>` blocks
- Icon component usage (which icons, where, size)

### What to extract
- Layout system: grid/flexbox structure, columns, gaps, alignment
- Component hierarchy: nesting structure with visual description
- Per-element: Tailwind classes or CSS (copy verbatim), position, dimensions if explicit
- Color usage: which tokens used where (background, text, border, shadow)
- Typography usage: which scale + weight on each text element
- Interactive element appearance: default, hover, active, focus, disabled states
- Icon usage: icon name, size, color, position
- Empty/zero state: what renders when list is empty or data is null
- Loading skeleton: exact structure, shimmer or pulse animation, placeholder dimensions

### Output structure
```markdown
# {View Name} — Visual Spec

**Companion docs:** [{view}.md]({view}.md) · [visual-foundations.md](visual-foundations.md) · [visual-mobile.md](visual-mobile.md) · [animation-trace.md](animation-trace.md)

## Layout

[Grid/flex structure, columns, gaps, overall composition]

## Component Tree

```
ViewRoot
  ├── ComponentA (description)
  │   ├── ChildB (description)
  └── ComponentC (description)
```

## Element Specifications

### {ElementName} (`Component.tsx:NN`)

| Property | Value |
|----------|-------|
| Classes | `exact tailwind classes verbatim` |
| Position | [static/relative/absolute/fixed] |
| Color | [token used] |
| Typography | [size + weight + family] |

**States:**
- Default: [description]
- Hover: [exact class changes]
- Active: [exact class changes]
- Disabled: [exact class changes / opacity / pointer-events]
- Focus: [ring/outline behavior]

## Icons

| Icon | Size | Color | Location |
|------|------|-------|---------|

## Empty State

[Description + classes]

## Loading Skeleton

[Structure + animation class]

## Observations

- [3-5 non-obvious insights]
```

### Framework-specific hints

| Framework | Class binding | Conditional classes | Scoped styles |
|-----------|-------------|--------------------|--------------| 
| React | `className=""` | `cn()`, `clsx()`, template literals | CSS Modules (`.module.css`) |
| Vue | `:class="{}"`, `:class="[]"` | `:class` object/array syntax | `<style scoped>` |
| Svelte | `class=""`, `class:name={cond}` | `class:` directive | `<style>` (scoped by default) |
| Angular | `[ngClass]`, `[class.name]` | `[ngClass]` object | `styleUrls`, `:host` |

### Quality rules
- Tailwind class lists: copy verbatim from source — never reorder or abbreviate
- Interactive states: must describe each state separately (default/hover/active/disabled/focus)
- Do not describe layout in vague terms — specify flex/grid properties precisely
- Empty and loading states: both must be documented if they exist in the component

---

## 4. Animations — `animation-trace.md`

### What to read
- All Framer Motion, GSAP, Vue Transition, Svelte transition/animate, Angular animation usages
- CSS `@keyframes` and `animation` properties
- Tailwind animation classes (`animate-*`)
- Transition properties on interactive elements
- The app shell component for page-level transitions

### What to extract
- Every animated element: component + file location
- Animation trigger: mount, state change, user interaction, scroll, timer
- Animation type: fade, slide, scale, rotate, path, spring, physics
- Duration: exact ms or s value
- Easing: exact easing function (cubic-bezier, spring config, named easing)
- Delay: if any
- Repeat: loop behavior
- Stagger: if multiple elements stagger, the stagger value
- Exit animation: behavior on unmount/hide
- Page transitions: enter and exit for each route

### Output structure
```markdown
# Animation Trace

**Companion docs:** [visual-foundations.md](visual-foundations.md) · [interaction-catalog.md](interaction-catalog.md)

## Animation Inventory

| Element | File | Trigger | Type | Duration | Easing | Delay | Stagger |
|---------|------|---------|------|----------|--------|-------|---------|

## Detailed Entries

### {AnimationName} (`Component.tsx:NN`)

| Property | Value |
|----------|-------|
| Library | [Framer Motion / GSAP / CSS / Tailwind] |
| Trigger | [what fires it] |
| Duration | [exact value] |
| Easing | [exact easing or spring config] |
| Delay | [value or "none"] |
| Exit | [exit animation or "none"] |

**Configuration (verbatim):**
```
[copy the exact animation config object / keyframe / transition string]
```

## Page Transitions

| Route | Enter | Exit |
|-------|-------|------|

## Observations

- [3-5 non-obvious insights]
```

### Framework-specific hints

| Framework | Animation library | Transition system |
|-----------|-----------------|------------------|
| React | Framer Motion (`motion.*`, `AnimatePresence`) | React Spring, `react-transition-group` |
| Vue | `<Transition>`, `<TransitionGroup>` | `v-enter-*`, `v-leave-*` classes |
| Svelte | `transition:`, `animate:`, `in:`, `out:` | Built-in: `fade`, `fly`, `slide`, `scale` |
| Angular | `@angular/animations` | `trigger()`, `state()`, `transition()`, `animate()` |

### Quality rules
- Animation config objects: copy verbatim — never paraphrase spring stiffness, damping, etc.
- Duration and easing: never round — copy the exact value from source
- Every `<AnimatePresence>` block and `<Transition>` block must be documented
- If Framer Motion `variants` are used, copy the variants object verbatim

---

## 5. Interactions — `interaction-catalog.md`

### What to read
- All component files for scoped views
- All interactive elements: buttons, inputs, selects, sliders, drag targets, dropzones
- Event handlers: `onClick`, `onChange`, `onHover`, `onKeyDown`, `onDragEnd`, etc.
- Keyboard shortcut registrations
- Tooltip and popover trigger/dismiss logic
- Form validation logic

### What to extract
- Every interactive element in the app
- Element type, label/aria-label, visual location in the view
- Trigger event(s)
- What happens: state change, navigation, API call, animation, etc.
- Disabled conditions
- Keyboard behavior
- Accessibility attributes (`aria-*`, `role`, `tabIndex`)
- Form fields: validation rules, error messages (verbatim)

### Output structure
```markdown
# Interaction Catalog

**Companion docs:** [edge-cases.md](edge-cases.md) · [animation-trace.md](animation-trace.md)

## Interaction Inventory

| Element | Type | View | Trigger | Effect |
|---------|------|------|---------|--------|

## Detailed Entries

### {ElementLabel} — {View} (`Component.tsx:NN`)

| Property | Value |
|----------|-------|
| Element type | [button / input / select / drag / etc.] |
| Trigger | [click / change / keydown / hover / etc.] |
| Disabled when | [condition or "never"] |
| Effect | [what happens] |
| Keyboard | [key behavior or "none"] |
| Aria | [`aria-label`, `role`, etc.] |

## Keyboard Shortcuts

| Shortcut | Scope | Effect |
|----------|-------|--------|

## Form Validations

| Field | Rule | Error message (verbatim) |
|-------|------|------------------------|

## Observations

- [3-5 non-obvious insights]
```

### Framework-specific hints

| Framework | Event binding | Form handling |
|-----------|-------------|---------------|
| React | `onClick`, `onChange`, `onKeyDown` props | Controlled inputs, React Hook Form, Formik |
| Vue | `@click`, `@change`, `@keydown`, `v-model` | Vee-Validate, native form events |
| Svelte | `on:click`, `on:change`, `bind:value` | `use:enhance`, native form events |
| Angular | `(click)`, `(change)`, `[(ngModel)]` | Reactive Forms, Template-driven forms |

### Quality rules
- Error messages: copy verbatim from source — never paraphrase validation text
- Every `onClick` / `@click` / `on:click` in scoped views must appear in this catalog
- Disabled conditions: use the exact expression from source
- Keyboard shortcuts: include modifier keys (`Ctrl+K`, `Cmd+Enter`, etc.)

---

## 6. i18n — `i18n.md`

### What to read
- Locale/translation files (`en.json`, `translations.ts`, `i18n/index.ts`, `messages/*.json`)
- All scoped view and component files — grep for:
  - `t('key')`, `$t('key')`, `translate('key')` calls
  - Inline ternaries with string content: `condition ? 'string A' : 'string B'`
  - Template literals with conditional strings
  - Hardcoded UI strings (button labels, placeholders, error messages)

### What to extract
- Translation keys used in each view, with their English values
- Inline conditional strings (ternary or template literal) — copy verbatim
- Hardcoded strings not going through i18n system
- Pluralization rules if present
- Missing i18n coverage (strings hardcoded rather than using t())

### Output structure
```markdown
# i18n — Internationalization Spec

**Companion docs:** [interaction-catalog.md](interaction-catalog.md)

## Translation Keys

| Key | English value | Used in |
|-----|--------------|---------|

## Inline Conditional Strings

These strings are not in translation files — they're inline in components:

### `Component.tsx:NN`
```
condition ? 'String when true' : 'String when false'
```
Context: [what triggers this condition]

## Hardcoded Strings (Not i18n-covered)

| String | Location | Recommendation |
|--------|---------|----------------|

## Pluralization Rules

[If present — copy verbatim]

## Coverage Gaps

[Strings found hardcoded that should be in the i18n system]

## Observations

- [3-5 non-obvious insights]
```

### Framework-specific hints

| Framework | i18n library | Translation call |
|-----------|------------|-----------------|
| React | `react-i18next`, `next-intl`, `formatjs` | `t('key')`, `<Trans>`, `useTranslations()` |
| Vue | `vue-i18n` | `$t('key')`, `t('key')`, `useI18n()` |
| Svelte | `svelte-i18n`, `paraglide` | `$_('key')`, `m.key()` |
| Angular | `@angular/localize` | `$localize`, `i18nPlural` pipe |

### Quality rules
- Translation values: copy verbatim — never rephrase or summarize string content
- Inline ternary strings: always include the full ternary expression, not just the strings
- Do not omit strings just because they seem trivial — every UI string must be documented
- Grep for all variants: `t(`, `$t(`, `translate(`, `useTranslations`, `$_(`

---

## 7. Types — `types.md`

### What to read
- All TypeScript type/interface/enum files (`types.ts`, `types/`, `interfaces/`, `enums/`)
- `package.json` for library-provided types referenced in components
- Any `*.d.ts` declaration files
- Zod/Yup/Valibot schema definitions

### What to extract
- Every interface, type alias, enum, and const enum used by scoped views
- API response types (DTOs)
- Store/state shape types
- Form types
- Validation schemas (Zod etc.) — copy verbatim
- Generic types and their constraints
- Union types and discriminated unions — include all members

### Output structure
```markdown
# Types Spec

**Companion docs:** [{view}.md]({view}.md) · [edge-cases.md](edge-cases.md)

## Core Types

[Copy verbatim type definitions — exact TypeScript source]

## API / DTO Types

[Copy verbatim]

## Store / State Types

[Copy verbatim]

## Enums

[Copy verbatim — including all values]

## Validation Schemas

[Copy verbatim Zod/Yup/Valibot schemas]

## Observations

- [3-5 non-obvious insights about type design or notable patterns]
```

### Framework-specific hints

| Framework | State typing | Form typing |
|-----------|------------|------------|
| React | `useState<T>()`, `useReducer<S, A>()` | `React.FormEvent<HTMLFormElement>` |
| Vue | `ref<T>()`, `defineProps<Props>()` | `HTMLFormElement` events |
| Svelte | `$state<T>()`, component props typing | `SubmitEvent` |
| Angular | `signal<T>()`, `@Input() prop: T` | `FormGroup`, `FormControl<T>` |

### Quality rules
- Types: copy verbatim — never paraphrase, abbreviate, or restructure
- Enums: include every value — none may be omitted
- Zod schemas: copy the entire schema definition verbatim, including refinements and transforms
- If a type is long (>50 lines), still copy verbatim — do not summarize

---

## 8. Assets — `assets.md`

### What to read
- `public/` directory listing
- All SVG imports and inline SVG elements in components
- Image imports (`import img from './image.png'`)
- Icon component usage (`<Icon name="..." />`, `<Lucide* />`, `<HeroIcon* />`)
- Hardcoded data arrays (mock data, static lists, constant config objects)
- Font imports (`@font-face`, Google Fonts links, `next/font`)

### What to extract
- SVG files: path, what it depicts, where used — include the SVG path data if inline
- Images: path, dimensions if known, alt text, where used
- Icon library: which library, which icons used (by name), in which views
- Font assets: family name, source (Google/local), weights loaded
- Static data arrays: variable name, shape, where used — copy verbatim if ≤30 lines, summarize structure if larger
- Config constants: any hardcoded config objects used across views

### Output structure
```markdown
# Assets Spec

**Companion docs:** [visual-foundations.md](visual-foundations.md)

## SVG Assets

| File / Component | Depicts | Used in | Notes |
|-----------------|---------|---------|-------|

### Inline SVG Paths (verbatim)

#### `ComponentName.tsx:NN`
```svg
<path d="[exact path data]" />
```

## Image Assets

| File | Alt text | Dimensions | Used in |
|------|---------|-----------|---------|

## Icon Library

| Library | Icons used | Views |
|---------|-----------|-------|

## Fonts

| Family | Source | Weights |
|--------|--------|---------|

## Static Data

### `variableName` (`file.ts:NN`)
[Copy verbatim if ≤30 lines, or describe structure with sample]

## Observations

- [3-5 non-obvious insights]
```

### Framework-specific hints

| Framework | Icon pattern | Asset imports |
|-----------|------------|--------------|
| React | `lucide-react`, `@heroicons/react`, inline SVG | `import img from './img.png'`, Next `Image` |
| Vue | `vue-lucide`, `@iconify/vue` | `<img src="...">`, Nuxt `<NuxtImg>` |
| Svelte | `lucide-svelte`, `@iconify/svelte` | `import img from './img.png'` |
| Angular | Angular Material icons, `ng-lucide` | `<img src="...">`, Angular `NgOptimizedImage` |

### Quality rules
- Inline SVG path data: copy verbatim — never describe the shape in prose instead
- Static data arrays: if ≤30 lines, copy verbatim; if >30 lines, document the shape with a sample item
- Font weights: document every weight variant loaded (not just the family name)

---

## 9. Edge Cases — `edge-cases.md`

### What to read
- All scoped view and component files — grep for:
  - `try { ... } catch`
  - `.catch(`, `onError`, `onRejected`
  - `error`, `isError`, `hasError` state variables
  - `loading`, `isLoading`, `isPending` state variables
  - `null`, `undefined`, optional chaining `?.`
  - `length === 0`, `!items`, empty array checks
  - Race condition guards: debounce, throttle, AbortController, `isMounted`
  - Retry logic
  - Timeout handling
- Error boundary components

### What to extract
- Every error state: what causes it, what renders, how user recovers
- Every loading state: what triggers, duration (if known), what renders
- Every empty/zero state: condition, what renders
- Race conditions: how handled (abort, debounce, flag)
- Network retry: conditions, retry count, backoff
- Boundary conditions: max/min values, character limits, file size limits
- Null safety: where `?.` or null checks are critical — what breaks if missing

### Output structure
```markdown
# Edge Cases

**Companion docs:** [{view}.md]({view}.md) · [interaction-catalog.md](interaction-catalog.md)

## Error States

| View | Trigger | UI shown | Recovery path | File:line |
|------|---------|---------|--------------|-----------|

## Loading States

| View | Trigger | Duration | UI shown | File:line |
|------|---------|---------|---------|-----------|

## Empty / Zero States

| View | Condition | UI shown | File:line |
|------|-----------|---------|-----------|

## Race Conditions & Guards

| View | Risk | Guard mechanism | File:line |
|------|------|----------------|-----------|

## Retry / Resilience

| Operation | Retry trigger | Max retries | Backoff | File:line |
|-----------|--------------|------------|---------|-----------|

## Boundary Conditions

| Rule | Value | Where enforced | File:line |
|------|-------|---------------|-----------|

## Observations

- [3-5 non-obvious insights about error handling strategy]
```

### Framework-specific hints

| Framework | Error boundaries | Async state |
|-----------|----------------|------------|
| React | `ErrorBoundary` component, `useErrorBoundary` | TanStack Query (`isError`, `isLoading`), SWR, `useTransition` |
| Vue | `onErrorCaptured`, `errorCaptured` hook | Pinia async actions, VueUse `useAsyncState` |
| Svelte | `{#await}` blocks with `:catch` | Svelte stores with async, `$effect` try/catch |
| Angular | `ErrorHandler`, `catchError` RxJS | Signals with `effect()`, RxJS operators |

### Quality rules
- Every `try/catch` block in scoped views must appear in this spec
- Error messages shown to the user: copy verbatim from source
- Race condition guards: describe the exact mechanism, not just "debounce is used"
- Do not document hypothetical edge cases — only document what the code actually handles

---

## 10. Mobile / Responsive — `visual-mobile.md`

### What to read
- All scoped view and component files — grep for:
  - Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
  - `@media` queries in CSS/SCSS
  - Conditional rendering based on viewport: `useMediaQuery`, `useWindowSize`, `window.innerWidth`
  - Mobile-specific components or layouts

### What to extract
- Per-view responsive behavior at each breakpoint
- Elements that change layout (flex → grid, column count changes, etc.)
- Elements that hide/show at breakpoints
- Typography changes at breakpoints
- Navigation changes (hamburger menu, bottom nav, drawer)
- Touch-specific interactions (swipe, pinch-zoom, long-press)
- Viewport-conditional logic (JS-level breakpoint detection)

### Output structure
```markdown
# Mobile / Responsive Spec

**Companion docs:** [visual-foundations.md](visual-foundations.md)

## Breakpoints

| Name | Min-width | Source |
|------|----------|--------|
| mobile | <768px | Tailwind default |
| tablet | 768px | `md:` prefix |
| desktop | 1200px | `xl:` prefix |

## Per-View Responsive Behavior

### {View Name}

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| [element] | [layout] | [layout] | [layout] |

**Hidden at:**
- [Element] hidden below `md:` (`md:block hidden`)

**Shown at:**
- [Element] shown only on mobile (`block md:hidden`)

## Navigation

[Mobile nav pattern: hamburger, drawer, bottom nav, etc.]

## Touch Interactions

| Gesture | Element | Effect |
|---------|---------|--------|

## JS Viewport Logic

### `Component.tsx:NN`
[Describe media query hook usage and what changes based on it]

## Observations

- [3-5 non-obvious insights about responsive strategy]
```

### Framework-specific hints

| Framework | Responsive CSS | JS viewport |
|-----------|-------------|-------------|
| React | Tailwind `sm:`/`md:`/`lg:`, CSS Modules with `@media` | `useMediaQuery` (custom or library), `react-responsive` |
| Vue | Tailwind, `@media` in `<style scoped>` | `useMediaQuery` (VueUse), `useWindowSize` |
| Svelte | Tailwind, `<style>` with `@media` | `$window.innerWidth`, SvelteKit `$page` |
| Angular | Tailwind, `@media` in `styleUrls` | `BreakpointObserver` (CDK) |

### Quality rules
- Every `sm:`/`md:`/`lg:`/`xl:` prefix on any element in scoped views must be documented
- Do not describe responsive behavior in vague terms — specify what changes at each breakpoint
- Hidden/shown elements: include the exact Tailwind classes used (`hidden md:block`)

---

## 11. Service Layer — `prompts.md` (optional axis)

### When to include
Include this axis if the codebase contains any of:
- LLM API calls (OpenAI, Anthropic, Mistral, Gemini, Cohere)
- Prompt template strings or prompt construction functions
- AI-related service files (`ai.service.ts`, `llm.ts`, `openai.ts`, `anthropic.ts`)
- Streaming response handling (`EventSource`, `ReadableStream`, chunked fetch)
- Function/tool calling schemas

### What to read
- All service files matching: `*{ai,llm,openai,anthropic,gpt,claude,mistral,gemini,prompt}*`
- Files importing from `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, etc.
- Any streaming/SSE handling code

### What to extract
- Every prompt string/template: copy verbatim, with the variable values that get interpolated
- System prompt vs user prompt vs assistant turn structure
- Model configuration: model ID, temperature, max_tokens, top_p, etc. — exact values
- Function/tool calling schemas: copy verbatim JSON schema
- Streaming: how chunks are handled, how the UI updates incrementally
- Retry and error handling for AI calls specifically
- Token/cost management if present

### Output structure
```markdown
# Service Layer — Prompts & AI Spec

**Companion docs:** [edge-cases.md](edge-cases.md) · [{view}.md]({view}.md)

## AI Service Overview

| Property | Value |
|----------|-------|
| Provider | [OpenAI / Anthropic / etc.] |
| Model | [exact model ID] |
| SDK | [library + version] |
| Streaming | [yes/no] |

## Prompt Templates

### `{PromptName}` (`service.ts:NN-NN`)

**System prompt (verbatim):**
```
[exact system prompt string]
```

**User prompt template (verbatim):**
```
[exact template with {{variable}} placeholders shown]
```

**Interpolated values:** `variableName` from [source]

## Model Configuration

```json
[verbatim config object: model, temperature, max_tokens, etc.]
```

## Tool / Function Schemas

### `{toolName}`
```json
[verbatim JSON schema]
```

## Streaming Implementation

### `service.ts:NN`
[Step-by-step description of how streaming is handled]

## Observations

- [3-5 non-obvious insights about the AI integration]
```

### Framework-specific hints

| Framework | Streaming pattern | State management |
|-----------|-----------------|-----------------|
| React | `useState` + `for await`, `useReducer` for chunks | TanStack Query mutation, custom hook |
| Vue | `ref()` + async iteration, Pinia action | Pinia `$patch` for stream chunks |
| Svelte | `$state` + async iteration | Svelte store `.update()` in async |
| Angular | RxJS `Observable`, `EventSource` wrapper | RxJS `BehaviorSubject` |

### Quality rules
- Prompt strings: copy 100% verbatim — never paraphrase, summarize, or rephrase any part
- Model config: copy exact values — never round temperature (0.7 not "0.7ish")
- Tool schemas: copy full JSON schema verbatim including description fields
- Streaming: describe the exact data flow step-by-step, not just "streaming is used"

---

## 12. Known Gaps — `known-gaps.md` (generated in Finalize, not extracted)

This axis is not extracted from source code. It is **generated** during Phase 6 (Finalize) by scanning all other spec files for uncertainty markers.

### What to scan for
- The word "unclear" in any spec
- The phrase "not documented" in any spec
- Paraphrase signals: "similar to", "appears to", "roughly", "approximately"
- Missing sections (a template section left empty or marked "N/A")
- Screenshot corrections that revealed spec inaccuracies

### Output structure
```markdown
# Known Gaps

**Companion docs:** [rebuild-readiness.md](rebuild-readiness.md)

## Hard to Document Visually

[What can't be fully captured without interactive testing — hover states, animations, scroll behavior, etc.]

## Hard to Document Functionally

[What requires runtime analysis — API response shapes, race conditions, timing behavior]

## Hard in Both Dimensions

[What is both visually and functionally uncertain]

## Confidence Flags

| Spec | Uncertain area | Confidence | Recommendation |
|------|---------------|-----------|----------------|

## Observations

- [3-5 insights about what the spec pipeline missed and how to address it]
```

### Quality rules
- Known Gaps must be honest — if a spec is incomplete, say so explicitly
- Do not add gaps for things that are genuinely documented
- Confidence flags: use Low / Medium / High — not percentages
- Every item in the Refine Checklist that was not resolved before Finalize should appear here
