# Agent Atelier

> The Claude Code skills, commands, and agents Big Emotion uses every day — made generic and open-sourced.

[![CI](https://github.com/big-emotion/agent-atelier/actions/workflows/ci.yml/badge.svg)](https://github.com/big-emotion/agent-atelier/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Install

```
/plugin marketplace add big-emotion/agent-atelier
/plugin install prompt-utils@big-emotion        # then pick the other plugins you want
```

Five plugins, one per domain. Each tool below links to its documentation and shows a real prompt → result.

> ⚠️ These plugins drive real tools with your credentials (`gh`, your repo, your Jira). Read a skill before running it.

---

## [prompt-utils](plugins/prompt-utils/README.md) — sharpen what you ask before you ask it

The utility suite. `expertify` and `interview` are the most-used tools in the atelier.

### [`expertify`](plugins/prompt-utils/skills/expertify/SKILL.md) — Finds the professional role behind a rough prompt, maps lay wording to field terminology, and rewrites it expert-grade.

```
/prompt-utils:expertify help me make my website load faster on phones
```

**Role** — Web performance engineer: owns page speed, Core Web Vitals, and mobile optimization.

| Your wording | Proper term | What it means |
|---|---|---|
| load faster | improve LCP / TTI | time to render main content and become interactive |
| on phones | mobile performance budget | speed targets for constrained devices and networks |
| — | render-blocking resources | CSS/JS that delays first paint |

```
You are a web performance engineer, and you will optimize a website's mobile Core Web Vitals…
```

→ then asks: "Execute the rewritten prompt now?" — Yes / No (No = the rewrite was the deliverable).

### [`interview`](plugins/prompt-utils/commands/interview.md) — Makes Claude interview you — probing questions, challenged assumptions — until 95% confident before proposing any plan.

```
/prompt-utils:interview I want a dashboard for my team's KPIs
```

→ Instead of a plan, Claude starts probing:

1. Which decision should this dashboard change? What happens differently when a number moves?
2. Who actually looks at it, and when — a daily standup glance or a monthly deep dive?
3. You said "KPIs" — name the three metrics that matter most, and where that data lives today.
4. Is a dashboard the real need, or would a weekly alert on two thresholds solve it?

It keeps digging — challenging what you *think* you should want — and only proposes a solution once it is ~95% confident about what you actually want.

### [`thought`](plugins/prompt-utils/skills/thought/SKILL.md) — Captures a surprising answer as a dated note in ~/thoughts/, updates the TLDR index, then resumes the conversation.

```
/prompt-utils:thought
```

<details>
<summary>What you get back</summary>

**Context:** We were exploring why public LLM benchmarks drift; the question was whether the benchmark or the model moves first.

**Thought:** The surprising part: the benchmark decays faster than the model — public test sets leak into training data, so scores rise while capability stays flat.

**Suggested subject:** evals

"Save this? You can: **accept**, **reframe** (tell me what to change), or **cancel**. You can also change or skip the subject."

→ accept → "Saved to `2026-07-29-evals.md`" — and `TLDR.md` gains, under its subject section:
`- **2026-07-29** — public benchmarks decay by leaking into training data`

Then the conversation resumes exactly where it was — the save never interrupts the flow.

</details>

### [`repo-scout`](plugins/prompt-utils/skills/repo-scout/SKILL.md) — Shallow-clones a GitHub repo, reads its key files, and reports what it does, what's worth stealing, and how to use it.

```
/prompt-utils:repo-scout https://github.com/anthropics/claude-code-tricks
```

<details>
<summary>What you get back</summary>

## What it does
Plain 2–3 sentence summary: what problem it solves, for whom. No marketing fluff.
## 3 things you need to know
1. **Key pattern or architecture** — what matters when evaluating it
2. **Important limitation** — e.g. state lives in one SQLite file
3. **Maturity/gotcha** — e.g. last commit 14 months ago
## Reusable parts — what to steal
### For `~/.claude/` — exact `cp` commands, or "Nothing `.claude/`-specific here."
### For your projects
- **`src/lib/retry.ts`** — backoff wrapper — **Why:** worth reusing over writing your own
## Use it right now
One copy-paste command or minimal install + usage snippet — "do this", not "you could".
## Quick stats
- **Language:** TypeScript · **License:** MIT · **Last commit:** date · **Stars:** n · **Health:** Active / Maintained / Stale / Abandoned

</details>

---

## [project-standard](plugins/project-standard/README.md) — the Jira/Confluence delivery pipeline

One `setup` skill installs the whole seven-module standard on any repo — CI gates, Husky hooks, the five project skills (`spec`, `ticket`, `release`, `audit`, `bootstrap-confluence`), Jira/Confluence wiring, and Ferry agent automation.

### [`setup`](plugins/project-standard/skills/setup/SKILL.md) — Install or audit the 7-module Big Emotion standard on a repo: CI gates, hooks, skills, Atlassian, Ferry, release, infra.

```
/project-standard:setup is this repo up to standard?
```

Interview (read-only): proposes defaults — `package.json` name → `project_slug`, `git remote` → org/repo — and asks which of the seven modules to check.

Gap analysis, one table:

| Module | Status | Evidence | What install would do |
|---|---|---|---|
| M1 CI | drifted | `ci.yml` has lint/test but no secret scan | add gitleaks gate |
| M2 hooks | missing | no `.husky/` | pre-commit → lint-staged, commit-msg → commitlint |
| M6 release | present | `deploy-production.yml` on tag `v*` | nothing |
| … | | | |

→ Per-module plan (files to write, manual Jira/Confluence steps, what will NOT be touched) behind one explicit confirmation; installs in order M6 → M1 → M2 → M4 → M3 → M5 → M7.
→ Verify pass (scratch commit fires both hooks, `ferry-doctor`, MCP reads) then a final checklist: done / remaining-manual / deferred.
On a compliant repo it reports "compliant" and changes nothing; secret names are documented, values never written.

---

## [pr-trains](plugins/pr-trains/README.md) — batch-process whole GitHub queues

Parallel sub-agents over every open PR or issue in a list — one consolidated plan, one grouped confirmation, zero writes before it.

### [`review-train`](plugins/pr-trains/skills/review-train/SKILL.md) — Posts one structured five-axis review comment per open PR and applies an approved/changes-requested label — review only.

```
/pr-trains:review-train https://github.com/acme/webapp/pulls
```

<details>
<summary>What you get back</summary>

```
## Review Train — acme/webapp (8 open PRs in scope)
Reference style: canonical fallback
CI gate: wait for CI to settle before review · ci-timeout: 30min · ci-poll: 30s

### Verdict overview
#12  feat: X       → approved            (0 blockers · 2 nits)   label: +approved -changes-requested   comment: new
#15  refactor: Y   → changes-requested   (3 blockers · 1 nit)    label: +changes-requested -approved   comment: update
#18  wip: Z (draft) → skipped            (draft)

### Drafted reviews
<!-- review-train --> …  **Issues requiring changes** 1. `src/api.ts:57` — **Why**: … **Fix**: …
**Verdict**: Changes requested — unsanitized input reaches the query builder.

> Proceed with the full batch? (yes / dry-run / subset)
```

</details>

### [`fix-train`](plugins/pr-trains/skills/fix-train/SKILL.md) — Applies reviewer-requested changes on every open PR via parallel worktree fixers, pushes, waits for green CI, relabels.

```
/pr-trains:fix-train https://github.com/acme/webapp/pulls
```

<details>
<summary>What you get back</summary>

```
## Fix Train — acme/webapp (9 open PRs in scope)
Sources: all   Quality gates: pnpm lint && pnpm typecheck && pnpm test
CI gate: must be green after fix push before flipping label · ci-timeout: 30min

### Overview
#12  feat: X       → 3 actionable · 0 decision · 1 stale   label: changes-requested→needs-rereview
#15  refactor: Y   → 1 actionable · 2 decision · 0 stale    label: (kept) changes-requested
#18  fix: Z        → 0 actionable (all needs-decision)      → skipped (nothing safe to auto-fix)

### Per-PR fix checklist
#12
  [12-1] src/a.ts:42  defect: missing null guard → fix: early return   src: review-train item 2   actionable

> Proceed with the full batch? (yes / dry-run / subset)
```
→ After "yes": one `<!-- fix-train -->` status comment per PR (addressed / could-not-do / deferred), CI verdict, label transition.

</details>

### [`fix-ci-train`](plugins/pr-trains/skills/fix-ci-train/SKILL.md) — Makes CI green on every open PR with red required checks: parallel worktree fixers push minimal fixes, poll until green.

```
/pr-trains:fix-ci-train https://github.com/acme/webapp/pulls
```

<details>
<summary>What you get back</summary>

```
## Fix-CI Train — acme/webapp (12 open PRs in scope · 4 with red required checks)
Scope: ci-only   Quality gates: pnpm lint && pnpm typecheck && pnpm test && pnpm build
CI loop: max-iterations=4 · ci-timeout=45min · ci-poll=30s

### Overview
#12  feat: X       → 3 actionable (lint, types, build) · 0 decision · 0 oos   label: ci-failing→ci-green
#15  refactor: Y   → 1 actionable (lockfile) · 1 decision · 1 oos (infra)      label: kept ci-failing
#20  wip (draft)   → skipped (draft)
#22  chore: bump   → all required checks green → skipped (already green)

### Plan
Will fix + push + drive-to-green + comment: #12 (3 items), #15 (1 item)
> Proceed with the full batch? (yes / dry-run / subset)
```
→ After "yes": per-PR CI-loop iterations (failing check → fix commit → next CI state) and a final verdict per PR: `green` / `real-defect` / `max-iterations` / `ci-still-pending`.

</details>

### [`merge-train`](plugins/pr-trains/skills/merge-train/SKILL.md) — Orders open PRs by dependency, fixes CI and conflicts, reviews each, then merges the mergeable ones in safe order.

```
/pr-trains:merge-train https://github.com/acme/webapp/pulls
```

<details>
<summary>What you get back</summary>

```
## Merge Train — acme/webapp (7 open PRs in scope)
CI gate: every PR must reach all-green before merge · ci-timeout: 30min · ci-poll: 30s

### Merge order
1. #12  feat: X       → mergeable         (CI: 1 failing — fixable · no conflicts)
2. #15  refactor: Y   → mergeable         (CI: green · conflicts vs base)
3. #18  feat: Z       → blocked-by-order  (after #15)
4. #20  fix: W        → changes-required  (review: 2 blockers)

### Plan
Mergeable & eligible: #12, #15  → resolve conflicts, loop on CI until green, merge in this order
Will comment (blocked): #18 (after #15) · Will comment (changes): #20

> Proceed with the full batch? (yes / dry-run / subset)
```
→ After "yes": merged PR URLs in order, every CI-fix iteration per PR, and the remaining queue with its break-out reason.

</details>

### [`issue-train`](plugins/pr-trains/skills/issue-train/SKILL.md) — Triages every open issue — closes stale or already-fixed ones, opens one PR per actionable issue with Closes #n linkage.

```
/pr-trains:issue-train https://github.com/acme/webapp/issues
```

<details>
<summary>What you get back</summary>

```
## Issue Train — acme/webapp (14 open issues in scope)
Integration branch: develop   Quality gates: pnpm lint && pnpm test
Silent-fix mode: strict   Max complexity: medium

### Overview
#42  bug: X failed to render   → actionable (medium)         → will open PR, Closes #42
#44  Z deprecated in v3        → close-stale (stale)          → will comment + close (not_planned)
#46  V column header wrong     → close-with-merged-pr (#88)   → will comment + close (completed)
#47  U slow on large inputs    → close-with-silent-fix (#95)  → will edit #95 body + comment + close
#48  T spec unclear            → needs-decision               → surfaced (ambiguous scope)

> Proceed with the full batch? (yes / dry-run / subset / edit classifications)
```
→ After "yes": per issue — closed (reason + comment URL) or pr-opened (PR URL, branch, CI verdict, Development-field link verified yes/no).

</details>

---

## [frontend-fidelity](plugins/frontend-fidelity/README.md) — reproduce any UI pixel-perfect, and prove you did

A pipeline around one oracle: `reverse-ui` extracts ground truth from the live app, `blueprint` specs the codebase, `validate-fidelity` catches drift before it ships.

### [`reverse-ui`](plugins/frontend-fidelity/skills/reverse-ui/SKILL.md) — Drives agent-browser over a live site to extract tokens, DOM, SVGs, assets, and responsive screenshots into a repro kit.

```
/frontend-fidelity:reverse-ui http://localhost:3000 /,/pricing
```

<details>
<summary>What you get back</summary>

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

</details>

### [`blueprint`](plugins/frontend-fidelity/skills/blueprint/SKILL.md) — Extracts a specs/ directory of flat markdown specs (12 axes) from a frontend codebase, for rebuild or migration.

```
/frontend-fidelity:blueprint run
```

<details>
<summary>What you get back</summary>

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

</details>

### [`validate-fidelity`](plugins/frontend-fidelity/skills/validate-fidelity/SKILL.md) — Checks a spec or running app against the reverse-ui oracle JSON/screenshots and reports pass/warn/fail drift per REQ.

```
/frontend-fidelity:validate-fidelity --phase spec --domain 004-home
```

<details>
<summary>What you get back</summary>

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

</details>

---

## [code-quality](plugins/code-quality/README.md) — review before you push

A read-only reviewer pair — and the `code-review` agent ships a Codex CLI variant: `cp plugins/code-quality/codex/code-review.toml ~/.codex/agents/`.

### [`ai-code-tells`](plugins/code-quality/skills/ai-code-tells/SKILL.md) — Read-only diff scan for the five tells of unreviewed AI code; reports each finding as file:line, why, and a concrete fix.

```
/code-quality:ai-code-tells src/lib/rate-limit.ts
```

<details>
<summary>What you get back</summary>

```
[Tell 1 — Narrating comments]
  src/lib/rate-limit.ts:42
    found:   // loop over entries and delete expired ones
    why:     restates what the code literally does; no decision or gotcha
    fix:     delete, or replace with why the sweep runs on read, not on a timer

[Tell 3 — Hollow / over-mocked tests]
  src/lib/rate-limit.test.ts:18
    found:   expect(checkMock).toHaveBeenCalledOnce()
    why:     asserts only that a mock was called, would pass if the logic were wrong
    fix:     call the limiter through its public interface and assert allow/deny output
```
Verdict: 1 narrating comment, 0 generic names, 1 hollow test, 0 signature-restating docs, 0 missing "why" — needs one human pass before PR.

Read-only: nothing is edited unless you then say "fix them".

</details>

### [`code-review`](plugins/code-quality/agents/code-review.md) — Pre-push review of local diffs (staged or recent commits) for bugs, edge cases, error handling, type safety, readability.

```
"Review my changes before I push"
```

<details>
<summary>What you get back</summary>

→ reads CLAUDE.md + project config, runs `git status` / `git diff --staged`

```
## Code Review — contact-form throttle refactor

### Blockers
> Must fix before pushing.

**src/lib/rate-limit.ts:57** — window reset uses `>` instead of `>=`, so the boundary request slips through
Suggested fix: `if (now - entry.windowStart >= windowMs) { … }`

### Should Fix
> Creates risk or technical debt if left as-is.

**src/components/contact-form.tsx:112** — fetch error swallowed; user gets no feedback
Suggested fix: set a form-level error state in the catch branch

### Verdict
DO NOT PUSH — one boundary bug lets throttled requests through; fix and re-run.
```

</details>

### [`code-review (Codex port)`](plugins/code-quality/codex/code-review.toml) — Same pre-push diff-review agent packaged for the Codex CLI; identical process and report, but reads AGENTS.md, not CLAUDE.md.

```
"Review my staged changes"
```

<details>
<summary>What you get back</summary>

Identical review contract to the Claude Code agent — same scope (changed code only, explicitly NOT production readiness), same severity ladder, same report:

```
## Code Review — [short description of what was reviewed]

### Blockers / Should Fix / Nice to Have
**[file:line]** — [issue description]
Suggested fix: [concrete fix or code snippet]

### Verdict
[PASS | PASS WITH COMMENTS | DO NOT PUSH] — [1 sentence justification]
```

Only divergence from the agents/ version: step 1 loads **AGENTS.md** (Codex's convention) instead of CLAUDE.md; empty severity sections are omitted, and a clean diff skips straight to the verdict.

</details>

---

## Development

`npm test` · `npm run check:templates` · `npm run check:manifests` — all enforced in CI alongside a gitleaks secret scan. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
