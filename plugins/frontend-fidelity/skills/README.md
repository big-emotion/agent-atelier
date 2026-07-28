# frontend-fidelity — skills

What each skill in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for, requirements) is in the plugin's [README](../README.md).

## [`blueprint`](blueprint/SKILL.md)

Extracts a specs/ directory of flat markdown specs (12 axes) from a frontend codebase, for rebuild or migration.

```
/frontend-fidelity:blueprint run
```

State machine: discover → scope (human picks views/axes) → extract → incorporate (screenshots) → refine (RF-NN checklist) → finalize (`known-gaps.md`, `rebuild-readiness.md`).

```
Blueprint Discover complete.

Framework: React
Styling: Tailwind
Views found: 3 (home, ideation, settings)
Components found: 42
Axes applicable: 10

Created: specs/_pipeline.md
Created: specs/baseline/ (drop screenshots here for /blueprint incorporate)

Next step: Run /blueprint scope to select which views to spec.
```

## [`reverse-ui`](reverse-ui/SKILL.md)

Drives agent-browser over a live site to extract tokens, DOM, SVGs, assets, and responsive screenshots into a repro kit.

```
/frontend-fidelity:reverse-ui http://localhost:3000 /,/pricing
```

Writes `reverse-ui-{domain}/` (raw JSON + screenshots + per-page animations.gif) and canonical `specs/assets/` (design-system CSS/JSON, component spec.json + README per component, layout and semantic-token files). Phase 8 summary:

```
Pages extracted: 2 (home, pricing)
Design tokens: 48 custom properties, 23 colors, 3 font families, 5 breakpoints
Animations: GSAP 3.12 detected, 11 keyframes, GIF captured
Assets: 14 images, 18 SVGs, 2 fonts, 1 logo
Source-code enrichment: animations, typography, breakpoints (12 files analyzed)
Design system: specs/assets/design-system/ — 4 CSS files, 3 JSON files, 18 SVG icons
Component kit: 6 components, 2 page layouts, 6 docs, 21 semantic tokens
```

## [`validate-fidelity`](validate-fidelity/SKILL.md)

Checks a spec or running app against the reverse-ui oracle JSON/screenshots and reports pass/warn/fail drift per REQ.

```
/frontend-fidelity:validate-fidelity --phase spec --domain 004-home
```

```
Validating spec 004-home against oracle...
Source: reverse-ui-localhost-3000/pages/home/structure.json

ERRORS (spec contradicts oracle):
  ❌ REQ-004-06 — Module grid columns
     Spec: 2 · Oracle: 3
     Source: structure.json → sections[2].styles.gridTemplateColumns
WARNINGS:
  ⚠️  REQ-004-05 — Search bar gradient (no counterpart in oracle — possible invention)
PASSES:
  ✅ REQ-004-01 — Hero heading text matches

Score: 5/7 requirements match | 1 error, 1 warning, 0 omissions
```
