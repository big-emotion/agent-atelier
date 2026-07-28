# pr-trains — skills

What each skill in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for, requirements) is in the plugin's [README](../README.md).

## [`fix-ci-train`](fix-ci-train/SKILL.md)

Makes CI green on every open PR with red required checks: parallel worktree fixers push minimal fixes, poll until green.

```
/pr-trains:fix-ci-train https://github.com/acme/webapp/pulls
```

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

## [`fix-train`](fix-train/SKILL.md)

Applies reviewer-requested changes on every open PR via parallel worktree fixers, pushes, waits for green CI, relabels.

```
/pr-trains:fix-train https://github.com/acme/webapp/pulls
```

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

## [`issue-train`](issue-train/SKILL.md)

Triages every open issue — closes stale or already-fixed ones, opens one PR per actionable issue with Closes #n linkage.

```
/pr-trains:issue-train https://github.com/acme/webapp/issues
```

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

## [`merge-train`](merge-train/SKILL.md)

Orders open PRs by dependency, fixes CI and conflicts, reviews each, then merges the mergeable ones in safe order.

```
/pr-trains:merge-train https://github.com/acme/webapp/pulls
```

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

## [`review-train`](review-train/SKILL.md)

Posts one structured five-axis review comment per open PR and applies an approved/changes-requested label — review only.

```
/pr-trains:review-train https://github.com/acme/webapp/pulls
```

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
