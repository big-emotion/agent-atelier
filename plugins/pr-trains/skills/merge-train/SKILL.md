---
name: merge-train
description: Batch-process a list of open GitHub pull requests. From a GitHub PRs URL (or the current repo), enumerate every open PR, compute the safe merge order from dependencies, then per PR fix CI, resolve merge conflicts, run a code review, and assign a status (mergeable / changes-required / blocked-by-order). Presents one consolidated plan, asks for a single grouped confirmation, then fixes + merges every mergeable PR in order and posts an order-blocking status comment on the rest. Generic and repo-agnostic. Use when the user shares a GitHub pull-requests page and asks to "process all the PRs", "check the merge order", "fix CI and conflicts and merge what can be merged", or invokes /merge-train.
metadata:
  author: Big Emotion
  version: "1.1.0"
---

# Merge Train

Process a whole list of open pull requests in one pass: order them, fix what is fixable, review them, then merge every PR that can be merged without breaking the order — and clearly report why each remaining PR is blocked.

This skill performs **irreversible shared-repo actions** (pushing fixes, merging PRs, posting comments). It follows a **grouped-confirmation** model: it does all read-only analysis first, presents one complete plan, and waits for a **single explicit confirmation** before performing any write. Until the user confirms, nothing is pushed, merged, or commented.

## When to Activate

- User shares a GitHub pull-requests URL (e.g. `https://github.com/<org>/<repo>/pulls`, a filtered query, or a milestone/label view) and asks to process, triage, order, or merge them.
- User says: "process all the PRs", "what's the merge order", "fix CI and conflicts then merge what can be merged", "review and merge the open PRs", "clear the PR queue".
- User invokes `/merge-train` (optionally with a GitHub PRs URL or `--dry-run`).

## Inputs

- **Primary**: a GitHub pull-requests URL. Any of: `/pulls`, a search query (`/pulls?q=...`), a label/milestone filter. Honor the filter in the URL — only the PRs that the URL would list are in scope.
- If no URL is given, default to the current repo's open PRs (`gh pr list`), and ask the user to confirm the repo if it is ambiguous.
- Flags:
  - `--dry-run` — produce the full plan and stop; never write. Overrides the confirmation step.
  - `--base <branch>` — treat this as the integration branch when detecting stacked PRs (default: auto-detect the repo default branch).
  - `--ci-timeout <minutes>` — per-PR ceiling on how long to wait for CI to reach a definitive state (default: `30`). Once the ceiling is hit on a PR, that PR is left for the next run and reported as `ci-still-pending`; the train moves on.
  - `--ci-poll <seconds>` — interval between `gh pr checks` polls while waiting for CI (default: `30`).

## Preconditions

Verify before any analysis. If any fail, stop and report the blocker.

1. `gh auth status` succeeds and has `repo` scope (needed for merge + comment).
2. `git` is available and the working tree is clean (`git status --porcelain` empty). A dirty tree risks contaminating CI/conflict fixes — stop and ask the user to commit or stash.
3. The target repo is reachable via `gh` (`gh repo view <owner>/<repo>`).
4. Resolve the default/integration branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` (overridden by `--base`).

## Workflow

### Phase 1 — Enumerate (read-only)

List every open PR in scope:

```bash
gh pr list --repo <owner>/<repo> --state open --limit 200 \
  --json number,title,headRefName,baseRefName,isDraft,author,url,labels,body,mergeable,mergeStateStatus
```

Apply the URL's filter (label/milestone/query) to the list. Drafts are reported but never merged.

### Phase 2 — Per-PR data gathering (read-only)

For each PR collect:

- **Base/head branches** — for stacked-PR detection.
- **Mergeability** — `mergeable` (`MERGEABLE` / `CONFLICTING` / `UNKNOWN`) and `mergeStateStatus` (`CLEAN`, `BLOCKED`, `DIRTY`, `BEHIND`, `UNSTABLE`).
- **CI status** — `gh pr checks <number> --repo <owner>/<repo>` → list failing/pending checks.
- **Review state** — `gh pr view <number> --json reviewDecision,reviews`.
- **Changed files** — `gh pr diff <number> --name-only` (for overlap detection and review scope).
- **Size/risk** — additions/deletions, number of files, whether it touches only docs/deps/config vs. core source.
- **Dependency hints** — scan title + body for: `depends on #N`, `blocked by #N`, `stacked on #N`, `after #N`, `requires #N`, `base: <other-pr-branch>`.

### Phase 3 — Compute merge order

Build a directed dependency graph (`A → B` means A must merge before B). Apply heuristics in **priority order**:

1. **Stacked branches** (strongest signal). If PR B's base branch is PR A's head branch (i.e. base ≠ integration branch and equals another open PR's head), then A → B. Chains can be multi-level.
2. **Explicit mentions**. Parse the dependency hints from Phase 2. `B depends on/blocked by/after #A` ⇒ A → B. Explicit mentions override weaker signals but never override a contradicting stacked-branch fact — if they conflict, **stop and surface the contradiction** to the user.
3. **File overlap**. For PRs with no stack/mention relationship that touch one or more of the same files, order the lower-risk / older PR first to minimize rebase churn, and flag the overlap so the user knows a conflict resolution will be needed on the later one.
4. **Size / risk** (tie-breaker only). Among otherwise-independent PRs, schedule small low-risk PRs (docs, dependency bumps, config) before large refactors.

Detect cycles. If the graph has a cycle (e.g. mutual `depends on`), **do not guess** — report the cycle and ask the user how to break it.

Produce a topologically-ordered list. Independent PRs keep their relative size/risk ordering.

### Phase 4 — Per-PR triage + code review (read-only)

Walking the order, classify each PR:

- **mergeable** — CI green (or only fixable failures), no conflicts (or auto-resolvable), review acceptable, and every PR before it in its dependency chain is also mergeable.
- **changes-required** — code review finds correctness/security/blocking issues, OR CI fails for reasons that are not a mechanical fix (genuine test failures, design problems).
- **blocked-by-order** — the PR itself is fine, but an upstream PR in its dependency chain is not yet merged / not mergeable. Record the specific blocking PR number(s).

Code review per PR is a focused five-axis pass (correctness, readability, architecture, security, performance) scoped to the diff. Keep it proportionate to PR size; flag blockers explicitly, note nits separately.

A PR is only **merge-eligible** if it is `mergeable` **and** all PRs it depends on are already merged or earlier in the same confirmed batch.

### Phase 5 — Present the consolidated plan (the single confirmation gate)

Output one report (see Output Format). It must show, for every PR: position in merge order, status, the blocking PR if any, the failing CI checks that would be fixed, whether a conflict resolution is needed, and the review verdict.

Then ask **one** grouped confirmation, e.g.:

> "Plan ready: N PRs mergeable (#a, #b, #c), M need changes, K blocked by order. I will, in order: fix the listed CI failures, resolve conflicts against `<base>`, merge the N mergeable PRs, and post an order-blocking status comment on the rest. Proceed with the full batch? (yes / dry-run / pick a subset)"

- `--dry-run` (or a dry-run answer) ⇒ stop here, write nothing.
- The user may approve a subset; respect it and recompute eligibility (a skipped PR blocks everything downstream of it).
- Without an explicit "yes", **do nothing**.

### Phase 6 — Execute (writes; only after confirmation)

Process strictly in merge order. For each **merge-eligible** PR:

1. **Resolve conflicts first** (if any): update the branch against `<base>` (rebase or merge per the repo's convention — prefer the project's existing strategy; do not force-push shared branches without the user's go-ahead beyond the batch confirmation, and never force-push the integration branch). Resolve conflicts faithfully (never discard a side blindly), run the build/tests locally, push to the PR head branch.

2. **Drive CI to green — loop until all required checks are SUCCESS.** This is a hard gate: **a PR is NEVER merged until its CI is green.** The loop is bounded only by `--ci-timeout` (default 30 min); within that ceiling, keep fixing failures and pushing until CI is green.

   Repeat:

   a. **Poll CI state**: `gh pr checks <number> --repo <owner>/<repo>` (or `gh pr view <number> --json statusCheckRollup`). Categorize each required check as `SUCCESS`, `FAILURE` (`FAILURE` / `CANCELLED` / `TIMED_OUT` / `ACTION_REQUIRED`), or `PENDING` (`QUEUED` / `IN_PROGRESS` / `WAITING`).

   b. **If every required check is `SUCCESS`** → CI is green. Exit the loop and go to step 3.

   c. **If any required check is `PENDING`** → sleep `--ci-poll` seconds (default 30s) and re-poll. Track total wait time against `--ci-timeout` (default 30 min). When the ceiling is hit while checks are still pending, leave the PR untouched, mark it `ci-still-pending`, post the status comment (Phase 6 final step), and move on to the next PR in the queue — do **not** merge a PR whose CI never settled.

   d. **If any required check is `FAILURE`** → fetch the failing check's logs (`gh run view <run-id> --log-failed --repo <owner>/<repo>`), check out the PR head branch, reproduce locally where feasible, apply the minimal fix scoped to that failure, run the relevant lint/typecheck/test/build to confirm the fix locally, commit with a clear message (e.g. `ci: fix <check name>`), push to the PR head branch. Then go back to (a) — **the loop continues**; do not move on to merge after a single push.

   e. **Keep looping** as long as failures are mechanical (lint, formatting, type errors, lockfile drift, flaky-retry, env/setup issues). The only ways to break out of the loop without reaching green are:

      - **Real defect** — a check fails because the diff actually contains a bug (a unit test catches a true regression, a security scanner flags a real issue, a design problem surfaces). Reclassify the PR as **changes-required** with the failing check + reason, and move on.
      - **Same failure recurs unchanged after two consecutive fix attempts** targeting it — treat as a real defect (the obvious mechanical fix didn't take), reclassify **changes-required** with the evidence, and move on.
      - **`--ci-timeout` reached while checks are still pending** — mark `ci-still-pending` and move on (see (c)).

   Never weaken a check to make it pass (no `--no-verify`, no deleting/skipping tests, no loosening lint, no `--admin` merge). If you find yourself tempted, the failure is a real defect — reclassify and move on.

3. **Merge** (only reachable when CI is green from step 2): re-check mergeability one last time (`gh pr view <number> --json mergeable,mergeStateStatus`); if still `MERGEABLE` / `CLEAN`, merge using the repo's merge method (`gh pr merge <number> --repo <owner>/<repo> --<method>` — detect allowed method; default to squash if unspecified). After a successful merge, branches downstream of it may become mergeable — re-evaluate the remaining queue (rebase the next PR onto the new base if needed, which re-enters its own step 1 → step 2 loop).

4. If any step fails irrecoverably (push rejected by branch protection, merge API error, etc.), stop touching that PR, mark it **changes-required** (or `ci-still-pending` if (c) applied) with the reason, and continue with PRs not dependent on it.

For every PR **not merged** (changes-required, blocked-by-order, or ci-still-pending), post a single status comment via `gh pr comment`:

- blocked-by-order: "⏸ Blocked by merge order — must merge after #N (and #M). Will be mergeable once those land."
- changes-required: a concise summary of the blocking issues from the review / CI, with file:line references. If broken out of the CI loop because of a real defect, name the failing check and the symptom.
- ci-still-pending: "⏳ CI did not reach a definitive state within the `--ci-timeout` window. Last poll: <N> checks still pending (<names>). Re-run merge-train when CI has settled."

### Phase 7 — Final report

Summarize: what merged (in order, with commit/merge URLs), what was fixed (CI + conflicts per PR), what remains and why, and the recommended next action for the blocked set.

## Safety Rules

- **One grouped confirmation** before any write. No write in `--dry-run`.
- **CI must be green before merging — no exceptions.** Poll `gh pr checks` until every required check is `SUCCESS`. A PR with any `FAILURE` or `PENDING` required check is **never merged**. There is no "merge then watch" mode.
- **Keep iterating on CI failures until CI is green** (bounded by `--ci-timeout`). The fix-and-push loop only ends in one of three ways: (1) every required check is `SUCCESS` → merge, (2) the failure is a real defect (not mechanical) or the same failure recurs after a fix attempt → reclassify `changes-required`, (3) the timeout is hit while checks are still pending → mark `ci-still-pending` and move on. Never merge to "unblock" the queue.
- Never force-push the integration/default branch. Never `--admin`-merge or bypass branch protection unless the user explicitly asks.
- Never merge a draft PR.
- Conflict resolution must preserve both sides' intent — if a resolution is non-obvious or risks data loss, stop and ask.
- CI "fixes" are limited to mechanical issues (lint, formatting, type errors, flaky-retry, lockfile, env/setup). A failing test that reflects a real defect is **changes-required**, not something to silence (never delete/skip tests, never add `--no-verify`, never weaken a check to make CI pass).
- Contradictory dependency signals or a dependency cycle ⇒ stop and ask; do not guess an order.
- Respect the URL's filter — do not act on PRs outside the requested scope.
- Keep each fix surgical and scoped to making that PR mergeable; no opportunistic refactoring.

## Output Format

A single Markdown report:

```
## Merge Train — <owner>/<repo> (<N> open PRs in scope)
CI gate: every PR must reach all-green before merge · ci-timeout: <N>min · ci-poll: <N>s

### Merge order
1. #12  feat: X            → mergeable        (CI: 1 failing — fixable · no conflicts)
2. #15  refactor: Y        → mergeable        (CI: green · conflicts vs base)
3. #18  feat: Z            → blocked-by-order  (after #15)
4. #20  fix: W             → changes-required  (review: 2 blockers)
...

### Per-PR detail
#12 …  status, reasoning, CI checks to fix, conflict?, review verdict (blockers/nits)
#15 …
...

### Plan
Mergeable & eligible: #12, #15  → resolve conflicts, loop on CI until green, merge in this order
Will comment (blocked): #18 (after #15)
Will comment (changes): #20 — <one-line why>

> Proceed with the full batch? (yes / dry-run / subset)
```

After execution, append an **Execution result** section with merged PR URLs, fixes applied (per PR: every CI fix iteration — failing check → commit SHA → resulting CI state — until green or break-out reason), and the remaining queue (with break-out reason for each: `changes-required` / `blocked-by-order` / `ci-still-pending`).
