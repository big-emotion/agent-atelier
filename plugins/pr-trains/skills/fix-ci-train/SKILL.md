---
name: fix-ci-train
description: Batch-fix the CI on every open pull request whose required checks are red — CI only, no review, no merge. From a GitHub PRs URL (or the current repo), enumerate every open PR with failing required checks, fetch each PR's failing-check logs, consolidate a per-PR CI-fix checklist, dispatch a team of parallel fixer sub-agents (one isolated worktree per PR) that apply the minimal fix, run the repo's quality gates locally, push to each PR branch, then poll CI until it turns green (or a break-out condition is hit). Presents one consolidated plan and asks for a single grouped confirmation before any write. Never reads reviewer feedback, never reviews from scratch, never merges. Built to unblock CI-gated review workflows — once a PR is green, `review-train` can then run on it. Generic and repo-agnostic. Use when the user shares a GitHub pull-requests page and asks to "fix CI on all the PRs", "make the red PRs green", "unblock the review-gated PRs", or invokes /fix-ci-train.
metadata:
  author: Big Emotion
  version: "1.0.0"
---

# Fix-CI Train

Walk a whole list of open pull requests and **make their CI green** — one pass, every PR. Read each PR's failing required checks, fetch the failing logs, consolidate a concrete per-PR CI-fix checklist, dispatch a team of parallel fixer sub-agents that apply the minimal fix and re-run the repo's quality gates, push to each PR branch, poll CI until every required check is `SUCCESS`, and report what's green, what broke out, and what still needs a human.

This is the fourth member of the train family and exists to **unblock the CI gate that the rest of the family depends on**:

- `fix-ci-train` — **CI fix only** (this skill): consumes failing required checks, applies minimal fixes, pushes, iterates until green. Never reads reviewer feedback. Never merges.
- `review-train` — **review only**: posts reviews + `approved` / `changes-requested` labels. Writes nothing to code.
- `fix-train` — **fix only**: consumes review change-requests, applies them, pushes. Never merges.
- `merge-train` — **merge**: orders, fixes CI/conflicts, merges.

The reason this skill exists separately from `fix-train` and `merge-train`: many review automations (including `review-train` when gated by a workflow) refuse to run until CI is green. Without a CI-only fixer, the pipeline deadlocks — `review-train` won't post, so `fix-train` has no review feedback to consume, so the queue stalls. `fix-ci-train` is the unlock step:

```
fix-ci-train  →  review-train  →  fix-train  →  re-review  →  merge-train
   (green CI)     (reviews)        (apply)      (approve)     (merge)
```

This skill performs **irreversible shared-repo actions** (committing, pushing to PR branches, commenting, optionally label edits). It follows the same **grouped-confirmation** model as its siblings: all collection and planning is read-only, one complete plan is presented, and it waits for a **single explicit confirmation** before any commit, push, or comment. Until the user confirms, nothing is written anywhere.

## When to Activate

- User shares a GitHub pull-requests URL and asks to **fix CI** / **make CI green** / **unblock** the red PRs (not review, not address feedback, not merge).
- User says: "fix CI on every PR", "make the red builds green", "the review job is gated on CI — unblock the queue", "clear the ci-failing PRs", "drive CI to green across the open PRs".
- User invokes `/fix-ci-train` (optionally with a GitHub PRs URL or `--dry-run`).

If the user asks to **address reviewer feedback**, defer to `fix-train`. If they ask to **review**, defer to `review-train`. If they ask to **merge / order / fix-then-merge**, defer to `merge-train`. Do not blur the four.

A PR with green required checks is **out of scope** for this skill (nothing to fix). A PR with only non-required checks failing is reported but not fixed unless `--include-non-required` is set.

## Inputs

- **Primary**: a GitHub pull-requests URL. Any of: `/pulls`, a search query (`/pulls?q=...`), a label/milestone filter, or a single PR URL. Honor the filter in the URL — only the PRs the URL would list are in scope. A single-PR URL ⇒ fix CI on just that one.
- If no URL is given, default to the current repo's open PRs (`gh pr list`); confirm the repo if ambiguous.
- Flags:
  - `--dry-run` — produce the full plan + the per-PR CI-fix checklists and stop; never edit, commit, push, or comment.
  - `--include-non-required` — also act on non-required check failures (default: only required checks count; non-required reds are listed in the plan but not fixed).
  - `--include-drafts` — also fix CI on draft PRs (default: drafts are listed but skipped).
  - `--concurrency <n>` — max parallel fixer agents (default 4).
  - `--max-iterations <n>` — per-PR ceiling on consecutive fix→push→re-poll cycles before declaring a real defect (default: `4`). Each iteration represents one fixer agent dispatch.
  - `--ci-timeout <minutes>` — per-PR ceiling on total wall-clock time spent waiting for CI on that PR (default: `45`). Once hit, leave the PR as `ci-still-pending` and report; do not flip any label.
  - `--ci-poll <seconds>` — interval between `gh pr checks` polls (default: `30`).
  - `--no-comment` — apply + push the fixes but do not post the status comment.
  - `--no-label` — do not touch labels (default: on green, remove `ci-failing` if present, add `ci-green`; on break-out, ensure `ci-failing` is present).
  - `--no-push` — implement + verify locally and produce per-PR patches, but do not push or comment (stronger than `--dry-run` in that the work is actually done locally; useful for inspection).
  - `--scope <ci-only|ci-and-deps>` — what kinds of fixes a sub-agent may apply. `ci-only` (default) = only changes that target a failing check (lint auto-fix, formatter, lockfile regen, type fix on the failing file, the specific failing test's setup/fixture, etc.). `ci-and-deps` = also allowed to bump a dependency or regenerate generated files when a failing check clearly points to it. **Never** allowed: feature changes, refactors, comment cleanup, anything orthogonal to the failing checks.

## Preconditions

Verify before any analysis. If any fail, stop and report the blocker.

1. `gh auth status` succeeds and has `repo` + `actions:read` scope (needed to fetch run logs, push, and comment).
2. `git` is available and the working tree is clean (`git status --porcelain` empty). Fixer agents run in **isolated worktrees**, but a dirty primary tree still risks contamination — stop and ask the user to commit or stash.
3. The target repo is reachable via `gh repo view <owner>/<repo>`.
4. Resolve the default/integration branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` (never pushed to by this skill — recorded so fixers never target it).
5. Resolve the repo's **required checks** (so non-required failures are correctly downgraded): `gh api repos/<owner>/<repo>/branches/<default>/protection --jq '.required_status_checks.contexts'` if branch protection is in place. If the API returns 404 (no protection rules), fall back to: required = all checks that appear in `statusCheckRollup` for the PR. Record the set per PR.

## Workflow

### Phase 1 — Enumerate (read-only)

```bash
gh pr list --repo <owner>/<repo> --state open --limit 200 \
  --json number,title,headRefName,baseRefName,isDraft,author,url,labels,statusCheckRollup
```

Apply the URL's filter. Drafts are listed but skipped unless `--include-drafts`. A PR whose every required check is `SUCCESS` (or pending with no failures) is **out of scope** and reported as skipped — there is nothing to fix.

In-scope = at least one **required** check in `FAILURE` / `CANCELLED` / `TIMED_OUT` / `ACTION_REQUIRED`. With `--include-non-required`, also include PRs whose only failures are non-required checks (still reported separately).

### Phase 2 — Collect failing checks per PR (read-only)

For each in-scope PR, gather every failing check, in parallel where possible:

- **Rollup**: `gh pr view <n> --repo <owner>/<repo> --json statusCheckRollup,headRefOid,headRefName` — the canonical list of checks and their current state on the PR head commit. Capture `name`, `status`, `conclusion`, `detailsUrl`, and the `databaseId` / `id` needed to fetch logs.
- **Required vs non-required**: cross-reference with the required-checks set from preconditions. Non-required failures are listed but only fixed when `--include-non-required` is set.
- **Failing logs**: for each failing required (or in-scope non-required) check, fetch the failing-step log only:

  ```bash
  gh run view <run-id> --repo <owner>/<repo> --log-failed
  ```

  Truncate sensibly (keep the failing assertion / compiler error / stack trace; drop verbose setup noise) to keep the fixer prompt focused. If a check has no associated `run-id` (e.g. external status from a third-party service), capture `detailsUrl` and the status payload; report it but do not auto-fix — those almost always need human or external action.

- **Head commit & diff for grounding**: `gh pr diff <n> --repo <owner>/<repo>` and `gh pr view <n> --json headRefOid` — so each failing check can be tied to the PR's actual current code (not stale logs from a previous push).

- **Prior `<!-- fix-ci-train -->` comment**: list issue comments authored by the current `gh` user that start with the `<!-- fix-ci-train -->` marker — needed in Phase 6 to update instead of stack.

### Phase 3 — Consolidate the per-PR CI-fix checklist (read-only)

For each PR, turn the collected failing checks into a deduplicated, concrete checklist. Each item: a stable id, the check name + run URL, the failure category (see below), a short **defect** summary (one or two lines extracted from the failing log), and the **intended minimal fix** (the obvious in-scope change — or `needs-decision` if not obvious).

Classify each item by category and actionability:

**Failure categories** (rough heuristics — adjust to what the log actually says):

- `lint` — ESLint / Ruff / Pylint / Clippy / RuboCop / etc. Almost always mechanical; many runners support `--fix`.
- `format` — Prettier / Black / Rustfmt / gofmt. Mechanical; the formatter's output IS the fix.
- `types` — `tsc --noEmit` / mypy / pyright / Flow / Go vet. Usually scoped, often mechanical when the message is precise.
- `tests` — unit / integration / e2e. Mechanical if the test is a snapshot/fixture mismatch or a clearly missed edge of the PR's own change. Real defect if the test is asserting business behavior the PR broke.
- `build` — Webpack / Vite / Next / Cargo / tsc emit. Often mechanical (missing import, wrong path, stale lockfile, peer dep mismatch).
- `lockfile` — pnpm/npm/yarn/cargo lockfile drift. Mechanical: regenerate.
- `codegen` — generated file out of sync (Prisma client, protobufs, GraphQL types, Prismic codegen, etc.). Mechanical: re-run the generator.
- `infra` — CI runner setup, env-var-missing, action-version-pinned-to-deleted-tag, network flake. **Out of scope** for this skill unless the fix is a workflow-file edit clearly on the PR's intent.
- `flake` — known-flaky check (intermittent, no log content from the actual SUT). Retry once via a no-op commit only if the repo has a documented retry pattern; otherwise surface as `needs-decision`.
- `external` — third-party status (preview deploy, security scanner, etc.) with no actionable log. Surface, do not auto-fix.
- `unknown` — can't categorize from the log. Surface as `needs-decision`.

**Actionability**:

- **actionable** — a concrete, unambiguous code change scoped to the failing check (and to the PR's own diff where possible). Examples: run the formatter, run the linter with `--fix`, fix the specific type error the compiler named, regenerate the lockfile, regenerate codegen, update a snapshot that legitimately moved with the PR's change, fix the obvious test-setup issue the log points at.
- **needs-decision** — ambiguous, contradicts the PR's intent, requires architectural choice, or would require touching code outside the PR's diff in a non-trivial way. **Do not guess these.** Surface them; never silently implement, never silently drop.
- **out-of-scope** — `infra` / `external` / non-required (unless `--include-non-required`). Reported, not acted on.

A PR with zero `actionable` items (all `needs-decision` / `out-of-scope`) is reported but **not branched** — there is nothing safe to auto-fix.

### Phase 4 — Present the consolidated plan (the single confirmation gate)

Output one Markdown report (see Output Format). For every in-scope PR show: author, the failing-check names, the actionable / needs-decision / out-of-scope counts, the failure categories, the quality gates that will run locally before pushing, whether the status comment will be new or an update of a prior `<!-- fix-ci-train -->` comment, and the planned label transition (`ci-failing` → `ci-green` on success, kept on break-out).

Then ask **one** grouped confirmation:

> "Fix-CI plan ready: N PRs with M actionable failing checks total, D need a human decision, O are out-of-scope. I will, per PR in an isolated worktree: implement the minimal fix for each actionable check, run `<detected quality gates>` locally, commit, push to the PR branch, then poll `gh pr checks` until every required check is `SUCCESS` (bounded by `--max-iterations` and `--ci-timeout`) — re-dispatching the fixer agent with new failing logs each cycle. On green: post a `<!-- fix-ci-train -->` status comment and flip the label (`ci-failing` → `ci-green`). On break-out: comment honestly, keep `ci-failing`. No reviewer-feedback work, no merge, no orthogonal changes. Proceed with the full batch? (yes / dry-run / pick a subset)"

- `--dry-run` (or a dry-run answer) ⇒ stop here; write nothing.
- The user may approve a subset of PRs and/or deselect specific items; respect it exactly.
- Without an explicit "yes", **do nothing**.

### Phase 5 — Dispatch the fixer team (writes; only after confirmation)

Spawn one fixer **sub-agent per PR** via the Agent tool with `isolation: "worktree"` so each agent works on an isolated copy of the repo and parallel fixes never collide. Batch at `--concurrency` (default 4) — send each batch as parallel tool calls in one message, wait, then the next batch.

Each sub-agent prompt is self-contained and must include:

- The PR number, title, author, head/base branch, URL, and head commit SHA.
- The full **actionable** CI-fix checklist for that PR (ids, check name, failure category, defect summary from the log, intended minimal fix). Explicitly exclude `needs-decision` / `out-of-scope` items.
- The relevant excerpts from the failing-check logs (truncated to the failing-step output).
- The PR diff for grounding.
- The detected quality-gate commands (lint / typecheck / test / build / codegen / lockfile) and the project's package manager / toolchain (honor `CLAUDE.md` if it mandates one — e.g. pnpm only, no npm).
- This instruction: *"Check out the PR head branch (head SHA <sha>) in your isolated worktree. For each listed actionable item, apply the minimal change that makes the named failing check pass — formatter output, linter `--fix`, the specific type/test fix the log points at, lockfile/codegen regeneration, etc. Touch only what the failing check requires; do not refactor, do not address comments, do not change behavior orthogonal to the failure. After each fix, re-run that check's local equivalent (e.g. `pnpm lint`, `pnpm typecheck`, `pnpm test -- <path>`, the build) and confirm it passes locally before moving on. Then run the full local quality-gate suite to make sure you didn't break a sibling check. Commit with a clear message referencing the items addressed (e.g. `ci(fix): address PR #<n> CI items ci-1,ci-3`). Output: per-item status (done / could-not-do + why), the list of files changed, the commit SHA, and the local gate results."*
- The scope guardrail per `--scope`: *"Scope = `<ci-only|ci-and-deps>`. ci-only: only changes that target a failing check; no dependency bumps; no generated-file regeneration unless the failing check IS a `codegen` / `lockfile` category. ci-and-deps: additionally allowed to bump a dependency or regenerate generated files when a failing check clearly points to it. Never allowed in either: feature changes, refactors of code unrelated to the failure, unsolicited comment/lint cleanup of orthogonal files."*
- This guardrail: *"CI fix only. Do not merge, do not close, do not rebase onto or push the integration branch, do not address reviewer comments (that's fix-train's job), do not resolve unrelated CI failures originating outside the PR's own diff (an unrelated flaky integration test that pre-dates this PR, a broken main, an infrastructure outage — surface, do not fix). Push only the PR head branch."*

Use `subagent_type: general-purpose` (this is implementation, not review). Collect each agent's per-item status, files changed, commit SHA, and local-gate results.

**Trust but verify.** A fixer agent's summary states intent, not ground truth. Before treating a PR as fixed, verify against the actually-pushed diff: the changed files plausibly match the named failing checks, no out-of-scope files were touched (especially: no app/feature code when the only failures were `lint` / `format`; no production source when only `tests` failed in a way the agent could only fix by changing tests), the commit exists on the head branch, and the local gates genuinely ran. If an agent's claim doesn't match the diff, treat those items as **could-not-do** and report honestly — never report a fix that isn't in the branch.

Push each PR's head branch with a normal (non-force) push. If the branch diverged and a rebase is genuinely required to push, do a careful rebase preserving the PR's commits and force-push **only that PR's head branch with lease** (`--force-with-lease`) — never the integration branch.

### Phase 5b — Drive CI to green after the fix push (writes; only after confirmation)

After each PR's fixer agent has pushed, **poll the actual CI** — do not declare success on local-gate-green alone. Local gates and CI environments diverge constantly (Node version, env vars, secrets, runner OS, cache state); the only ground truth for "CI is green" is `gh pr checks`. This is the hard gate for label/comment transitions.

Per PR (these can run in parallel across PRs since PRs are independent here, batched at `--concurrency`):

a. **Poll CI state**: `gh pr checks <n> --repo <owner>/<repo>` (or `gh pr view <n> --json statusCheckRollup`). Categorize each **required** check as `SUCCESS`, `FAILURE` (`FAILURE` / `CANCELLED` / `TIMED_OUT` / `ACTION_REQUIRED`), or `PENDING` (`QUEUED` / `IN_PROGRESS` / `WAITING`). Always re-resolve against the **current head commit** — a new push restarts the rollup, so cached `databaseId`s from Phase 2 may be stale.

b. **If every required check is `SUCCESS`** → CI is green. Mark every actionable item as `green`, and proceed to Phase 6 for this PR.

c. **If any required check is `PENDING`** → sleep `--ci-poll` seconds (default 30s) and re-poll. Track total wall-clock against `--ci-timeout` (default 45 min). When the ceiling is hit while checks are still pending, mark the PR `ci-still-pending`: items reported as `addressed-pending-ci` (the diff exists, CI didn't confirm); do **not** flip the label.

d. **If any required check is `FAILURE`** → fetch the new failing logs (`gh run view <run-id> --log-failed --repo <owner>/<repo>`) and **re-dispatch the same PR's fixer sub-agent in its existing worktree** with the new failures appended as additional actionable items (`[<n>-ci-iter2-1]`, `[<n>-ci-iter2-2]`, ...). Include in the prompt: which items the agent already attempted, which checks were green on the previous iteration, and which are newly failing. The agent applies the minimal fix, runs local gates, commits, pushes. Increment the per-PR iteration counter and go back to (a).

e. **Keep looping** until one of these break-out conditions:

   - **Green** (b above) — success path.
   - **`--max-iterations` reached** (default 4) — declare a real defect: the fix didn't converge in a bounded number of cycles. Mark remaining red checks as `could-not-do` with the last failure reason; keep `ci-failing`; comment honestly.
   - **Same check fails with the same error twice in a row** after a fix attempt targeting it — treat as a real defect (the mechanical fix didn't take, the agent is going in circles). Same outcome as max-iterations.
   - **Real defect surfaced** — the fix introduced (or revealed) a failure that the agent cannot resolve within the CI-only scope (e.g. fixing the lint surfaced a real type error that requires a feature change; fixing the failing snapshot would require changing production behavior). Mark the corresponding items `could-not-do` with the failing check + reason, keep `ci-failing`, comment honestly.
   - **`--ci-timeout` reached while checks are still pending** — mark `ci-still-pending` (see (c)).
   - **Out-of-scope failure recurs** — a check that was already classified `out-of-scope` (infra / external / unrelated flake) keeps failing. Surface, do not loop on it.

Never weaken a check to make it green (no `--no-verify`, no deleting/skipping/`xfail`-ing tests, no loosening lint, no removing required checks from CI config). If you find yourself tempted, the failure is a real defect — break out and report.

### Phase 6 — Annotate (writes; only after confirmation)

For each PR that had at least one item attempted:

1. **Status comment** (unless `--no-comment`): post a `<!-- fix-ci-train -->`-prefixed comment summarizing, per item: green (with commit SHA + check name) / could-not-do (why + last-seen failure) / pending-ci (no CI verdict within timeout) / out-of-scope (why) / needs-decision (the open question). Include the iteration count and the final CI verdict line. If a prior `<!-- fix-ci-train -->` comment by the current user exists, update it (`gh api ... -X PATCH`) instead of stacking; else create it (`gh pr comment <n> --repo <owner>/<repo> --body-file <tmp>`; write via temp file to preserve formatting; delete the temp file immediately after).

2. **Label** (unless `--no-label`): only if **every required check on the current head commit is `SUCCESS`** — `gh pr edit <n> --repo <owner>/<repo> --remove-label ci-failing --add-label ci-green` (create either label if missing: `gh label create ci-failing --color B60205 --description "fix-ci-train: required checks failing"`, `gh label create ci-green --color 0E8A16 --description "fix-ci-train: required checks green"`). On any break-out (real defect, max-iterations, timeout): ensure `ci-failing` is **present** (re-add if missing), do not add `ci-green`. The `ci-green` label is the explicit handoff signal to `review-train` — only flip it when CI genuinely confirms.

3. If a comment/label call fails for one PR, record it and continue — never abort the whole batch for one PR.

Never submit a formal GitHub review, never approve, never merge, never close, never address reviewer-comment threads.

### Phase 7 — Final report

Summarize per PR: items green (commit SHA + check name + run URL), items could-not-do and why (with last failing log excerpt), items pending-ci, items needs-decision (with the open question), out-of-scope items, iteration count, final CI verdict (`green` / `real-defect` / `max-iterations` / `ci-still-pending` / `out-of-scope-only`), push URL, label transition, comment URL (new/updated). List skipped (drafts / already-green / all-out-of-scope) PRs. Recommend the next action: which PRs are now ready for `review-train` (label is `ci-green`), which need human input or merge-train-class work (broken main, infra outage), and which need a follow-up `fix-ci-train` pass after upstream is unblocked.

## Safety Rules

- **One grouped confirmation** before any write. No edit / commit / push / comment in `--dry-run`.
- **CI itself is the ground truth.** Never flip `ci-failing` → `ci-green` on the basis of local gates alone. After the fixer's push, poll `gh pr checks` against the **current head commit** until every required check is `SUCCESS` (bounded by `--ci-timeout` and `--max-iterations`). Local-green + CI-red is a common, real failure mode (environment drift); honor CI's verdict.
- **Iterate, but bounded.** Re-dispatch the fixer on new failing logs as long as the cycle is converging (different failures or different lines each iteration). Break out on: max-iterations, same-failure-twice, real-defect, timeout. The defaults (`--max-iterations 4`, `--ci-timeout 45min`) are deliberately tight — a CI fix that doesn't converge in four passes is almost always a real defect that needs a human.
- **CI fix only.** Never merge, never close, never approve, never submit a formal review, never address reviewer threads or comments (`fix-train`'s job), never resolve CI failures that originate **outside the PR's diff** (a broken main, an unrelated flaky test that pre-dates the PR, an infra outage — surface as out-of-scope), never resolve merge conflicts (`merge-train`'s job).
- **Surgical scope.** Implement only the confirmed actionable items, each as the minimal change targeting the named failing check. No opportunistic refactor, cleanup, renaming, or unrelated file edits. The fixer is bound by `--scope ci-only` (default) or `ci-and-deps`; nothing wider.
- **Never weaken a check to make it green.** No `--no-verify`, no deleting/skipping/`xfail`-ing tests, no loosening lint/types, no removing checks from CI config, no marking required checks as non-required. A check failing for a real reason ⇒ that item is `could-not-do`, reported honestly. The user can decide whether to accept the failure or change the PR's intent.
- **Never guess ambiguous failures.** `needs-decision` items are surfaced for a human, never silently implemented and never silently dropped. An `external` / `infra` / `unknown` failure is reported, not auto-fixed.
- **Branch isolation.** Each PR is fixed in its own isolated worktree; parallel fixes must not collide. Push only PR head branches; never push or rebase the integration/default branch; force-push only a PR head branch and only with `--force-with-lease` when a rebase is genuinely required.
- **Trust but verify.** Verify every claimed fix against the actually-pushed diff and the resulting CI rollup on the new head commit before reporting it as green. Never report a fix that isn't in the branch; never report CI green on the basis of the agent's summary alone.
- **Idempotent.** Update the prior `<!-- fix-ci-train -->` comment instead of stacking; only add `ci-green` when CI is genuinely green on the current head; only ensure `ci-failing` (don't duplicate it) on break-out.
- **Respect the URL's filter** — never act on PRs outside the requested scope. Never fix CI on a draft unless `--include-drafts`. Never fix non-required failures unless `--include-non-required`.
- Repo-agnostic: detect the quality gates from the project (package manager + scripts / Makefile / toolchain). When project instructions mandate a specific toolchain (e.g. a required package manager), honor it — do not substitute.

## Output Format

A single Markdown report:

```
## Fix-CI Train — <owner>/<repo> (<N> open PRs in scope · <K> with red required checks)
Scope: <ci-only | ci-and-deps>   Quality gates: <detected commands>
CI loop: max-iterations=<N> · ci-timeout=<N>min · ci-poll=<N>s
Required checks (default branch protection): <list, or "none — using rollup">

### Overview
#12  feat: X       → 3 actionable (lint, types, build) · 0 decision · 0 oos     label: ci-failing→ci-green    comment: new
#15  refactor: Y   → 1 actionable (lockfile) · 1 decision · 1 oos (infra)        label: kept ci-failing        comment: update
#18  fix: Z        → 0 actionable (all infra/external)                            → skipped (nothing safe to auto-fix)
#20  wip (draft)   → skipped (draft)
#22  chore: bump   → all required checks green                                    → skipped (already green)
...

### Per-PR CI-fix checklist
#12
  [12-ci-1] check: lint (eslint)       cat: lint     defect: 3 errors in src/a.ts (no-unused-vars)        fix: eslint --fix    actionable
  [12-ci-2] check: typecheck (tsc)     cat: types    defect: src/b.ts:88 — TS2345 wrong arg type          fix: cast or fix sig actionable
  [12-ci-3] check: build (next)        cat: build    defect: missing module './c' from src/index.ts      fix: add the import  actionable
#15
  [15-ci-1] check: install (pnpm)      cat: lockfile defect: pnpm-lock.yaml out of sync with package.json fix: pnpm install   actionable
  [15-ci-2] check: e2e (playwright)    cat: tests    defect: unrelated flake "homepage loads" (no PR-relevant diff) — pre-dates PR  out-of-scope (infra/flake)
  [15-ci-3] check: security-scan       cat: external defect: snyk found new CVE in transitive dep         — needs-decision (bump major dep?)
#18 ...

### Plan
Will fix + push + drive-to-green + comment: #12 (3 items), #15 (1 item)
Deferred for human decision: #15 [15-ci-3]
Out-of-scope (surfaced, not fixed): #15 [15-ci-2], #18 (all)
Skipped: #18 (all out-of-scope), #20 (draft), #22 (already green)
No reviewer-feedback work · no merge · no orthogonal changes — CI fix only.

> Proceed with the full batch? (yes / dry-run / subset)
```

After execution, append an **Execution result** section: per PR — items green (commit SHA + check name + run URL), items could-not-do (+ last-failure reason), items pending-ci, items needs-decision (the open question), out-of-scope items, **CI loop iterations** (each: iteration # → failing checks → fix commit SHA → next CI state — until green / break-out reason), final CI verdict (`green` / `real-defect` / `max-iterations` / `ci-still-pending` / `out-of-scope-only`), push URL, label transition, comment URL (new/updated); skipped PRs; and the recommended follow-up: which PRs are now `ci-green` and ready for `review-train`, which need human input, and which are blocked on an upstream issue (broken main / infra / external service).
