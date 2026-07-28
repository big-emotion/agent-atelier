---
name: fix-train
description: Batch-apply the requested changes on every open pull request in a GitHub list — fix only, no merge. From a GitHub PRs URL (or the current repo), enumerate every open PR, collect each PR's requested changes (formal CHANGES_REQUESTED reviews, inline review comments, and `<!-- review-train -->` "Issues requiring changes" comments / `changes-requested` label), consolidate a per-PR fix checklist, dispatch a team of parallel fixer sub-agents (one isolated worktree per PR) that implement the minimal fixes and run the repo's quality gates, then push to each PR branch and post one status comment. Presents one consolidated plan and asks for a single grouped confirmation before any write. Never reviews from scratch, never resolves unrelated CI/conflicts, never merges. Generic and repo-agnostic. Use when the user shares a GitHub pull-requests page and asks to "fix all the change requests", "address the review feedback on every PR", "clear the changes-requested queue", or invokes /fix-train.
metadata:
  author: Big Emotion
  version: "1.1.0"
---

# Fix Train

Walk a whole list of open pull requests and **apply the changes that reviewers asked for** — one pass, every PR. Collect each PR's requested changes, consolidate them into a concrete per-PR checklist, dispatch a team of parallel fixer sub-agents that implement the minimal fix and run the repo's quality gates, push to each PR branch, and report what was addressed and what still needs a human.

This is the third member of the train family and fills the gap between its siblings:

- `review-train` — **review only**: posts reviews + `approved` / `changes-requested` labels. Writes nothing to code.
- `fix-train` — **fix only** (this skill): consumes the change requests, applies them, pushes. Never merges.
- `merge-train` — **merge**: orders, fixes CI/conflicts, merges.

The natural pipeline is `review-train` → `fix-train` → re-review → `merge-train`. `fix-train` is built to consume `review-train`'s output directly (it reads the `<!-- review-train -->` "Issues requiring changes" list and the `changes-requested` label), but it works just as well from plain GitHub reviews left by humans.

This skill performs **irreversible shared-repo actions** (committing, pushing to PR branches, commenting). It follows the same **grouped-confirmation** model as its siblings: all collection and planning is read-only, one complete plan is presented, and it waits for a **single explicit confirmation** before any commit, push, or comment. Until the user confirms, nothing is written anywhere.

## When to Activate

- User shares a GitHub pull-requests URL and asks to **apply / address / fix** the review feedback (not review, not merge).
- User says: "fix all the change requests", "address the review comments on every PR", "apply the requested changes across the queue", "clear the changes-requested PRs", "make the fixes the reviewers asked for".
- User invokes `/fix-train` (optionally with a GitHub PRs URL or `--dry-run`).

If the user asks to *review* the PRs, defer to `review-train`. If they ask to *merge* / *order* / *fix CI & conflicts then merge*, defer to `merge-train`. Do not blur the three.

## Inputs

- **Primary**: a GitHub pull-requests URL. Any of: `/pulls`, a search query (`/pulls?q=...`), a label/milestone filter, or a single PR URL. Honor the filter in the URL — only the PRs the URL would list are in scope. A single-PR URL ⇒ fix just that one.
- If no URL is given, default to the current repo's open PRs (`gh pr list`); confirm the repo if ambiguous.
- Flags:
  - `--dry-run` — produce the full plan + the per-PR fix checklists and stop; never edit, commit, push, or comment.
  - `--source <all|reviews|review-train|inline>` — which change-request signals to act on. `all` (default) = formal `CHANGES_REQUESTED` reviews + inline review comments + the `<!-- review-train -->` "Issues requiring changes" comment + `changes-requested` label. `reviews` = formal reviews + inline only. `review-train` = only the `<!-- review-train -->` marker comment. `inline` = only inline review-thread comments.
  - `--include-drafts` — also fix draft PRs (default: drafts are listed but skipped).
  - `--concurrency <n>` — max parallel fixer agents (default 4).
  - `--no-comment` — apply + push the fixes but do not post the status comment.
  - `--no-label` — do not touch labels (default: on success, remove `changes-requested`, add `needs-rereview`).
  - `--reply-threads` — additionally reply to and resolve the inline review threads that were addressed (default: off — only the consolidated status comment is posted).
  - `--no-push` — implement + verify locally and produce per-PR patches, but do not push or comment (stronger than `--dry-run` in that the work is actually done locally; useful for inspection).
  - `--ci-timeout <minutes>` — per-PR ceiling on how long to wait for CI to reach a definitive state after the fix push (default: `30`). Once the ceiling is hit on a PR, leave it as `ci-still-pending`, keep the `changes-requested` label, and report; do not flip to `needs-rereview`.
  - `--ci-poll <seconds>` — interval between `gh pr checks` polls while waiting for CI (default: `30`).
  - `--no-wait-ci` — push the fixes and post the status comment immediately without polling CI. Default off; only use when CI is known to be unreliable/disabled and the user accepts that `needs-rereview` may be flipped on a branch that later breaks CI.

## Preconditions

Verify before any analysis. If any fail, stop and report the blocker.

1. `gh auth status` succeeds and has `repo` scope (needed to push + comment + label).
2. `git` is available and the working tree is clean (`git status --porcelain` empty). Fixer agents run in **isolated worktrees**, but a dirty primary tree still risks contamination — stop and ask the user to commit or stash.
3. The target repo is reachable via `gh repo view <owner>/<repo>`.
4. Resolve the default/integration branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` (never pushed to by this skill — recorded so fixers never target it).

## Workflow

### Phase 1 — Enumerate (read-only)

```bash
gh pr list --repo <owner>/<repo> --state open --limit 200 \
  --json number,title,headRefName,baseRefName,isDraft,author,url,labels,reviewDecision
```

Apply the URL's filter. Drafts are listed but skipped unless `--include-drafts`. A PR with no `CHANGES_REQUESTED` review, no actionable review comment, and no `changes-requested` signal is **out of scope** (nothing to fix) and reported as skipped.

### Phase 2 — Collect requested changes per PR (read-only)

For each in-scope PR, gather every requested change from the sources enabled by `--source`, in parallel where possible:

- **Formal reviews**: `gh api repos/<owner>/<repo>/pulls/<n>/reviews --jq '.[] | select(.state=="CHANGES_REQUESTED")'` — capture reviewer, body, submitted_at. Only the **latest** review per reviewer counts (a later `APPROVED`/`COMMENTED` from the same reviewer supersedes an earlier `CHANGES_REQUESTED`).
- **Inline review comments**: `gh api repos/<owner>/<repo>/pulls/<n>/comments` — each carries `path`, `line`/`original_line`, `body`, and `in_reply_to_id`. Skip threads already marked resolved; skip comments that are pure acknowledgement ("done", "👍").
- **`review-train` marker comment**: the most recent issue comment whose body starts with `<!-- review-train -->`. Parse its **"Issues requiring changes"** section — each numbered item has a `file:line` anchor, a **Why**, and a **Fix**. These map 1:1 to fix-train work items.
- **Label signal**: the `changes-requested` label confirms the PR is in scope even if the structured list is sparse.
- **Diff for grounding**: `gh pr diff <n> --repo <owner>/<repo>` — needed so each item can be tied to real, current code (a comment may target a line that the PR already moved).

### Phase 3 — Consolidate the per-PR fix checklist (read-only)

For each PR, turn the collected feedback into a deduplicated, concrete checklist. Each item: a stable id, the `file:line` anchor, the **defect** (the reviewer's "Why"), the **intended fix** (the reviewer's "Fix" or the obvious minimal change), and the **source** (which reviewer / comment / marker item it came from).

Classify each item:

- **actionable** — a concrete, unambiguous code change scoped to the diff.
- **needs-decision** — ambiguous, subjective, contradicts another requested change, conflicts with the PR's stated intent or the codebase conventions, or would require out-of-scope refactoring. **Do not guess these.** They are surfaced for a human, never silently implemented or silently dropped.
- **stale** — targets code the PR no longer contains (already addressed in a later push). Reported, not acted on.

If two reviewers ask for opposite things on the same line, mark **both** `needs-decision` and surface the contradiction — never pick a side.

A PR with zero `actionable` items (all `needs-decision`/`stale`) is reported but **not branched** — there is nothing safe to auto-fix.

### Phase 4 — Present the consolidated plan (the single confirmation gate)

Output one Markdown report (see Output Format). For every in-scope PR show: author, the actionable-item count, the needs-decision and stale counts, the quality gates that will run, and whether the status comment will be new or an update of a prior `<!-- fix-train -->` comment. List every checklist item inline (id, anchor, defect→fix, source, classification) so the user can audit before any code is touched.

Then ask **one** grouped confirmation:

> "Fix plan ready: N PRs with M actionable items total, D items need a human decision, S stale. I will, per PR in an isolated worktree: implement the actionable items, run `<detected quality gates>`, commit, push to the PR branch, then post one `<!-- fix-train -->` status comment and flip the label (`changes-requested` → `needs-rereview`). No re-review, no CI/conflict cleanup beyond what blocks verification, no merge. Proceed with the full batch? (yes / dry-run / pick a subset)"

- `--dry-run` (or a dry-run answer) ⇒ stop here; write nothing.
- The user may approve a subset of PRs and/or deselect specific items; respect it exactly.
- Without an explicit "yes", **do nothing**.

### Phase 5 — Dispatch the fixer team (writes; only after confirmation)

Spawn one fixer **sub-agent per PR** via the Agent tool with `isolation: "worktree"` so each agent works on an isolated copy of the repo and parallel fixes never collide. Batch at `--concurrency` (default 4) — send each batch as parallel tool calls in one message, wait, then the next batch.

Each sub-agent prompt is self-contained and must include:

- The PR number, title, author, head/base branch, and URL.
- The full **actionable** checklist for that PR (ids, `file:line`, defect, intended fix, source). Explicitly exclude `needs-decision`/`stale` items.
- The PR diff for grounding.
- This instruction: *"Check out the PR head branch in your isolated worktree. Implement ONLY the listed actionable items, each as the minimal change that resolves the reviewer's concern. Do not refactor adjacent code, do not address anything not on the list. After implementing, run the repo's quality gates (detect them: package.json scripts / Makefile / language toolchain — e.g. lint, typecheck, test, build) and make them pass without weakening them. Never silence a check (`--no-verify`, deleting/skipping tests, loosening lint) to make it green — if a gate fails for a real reason, leave that item unstaged and report it. Commit with a clear message referencing the items addressed (e.g. `fix(review): address PR #<n> items 2,4`). Output: per-item status (done / could-not-do + why), the list of files changed, the commit SHA, and the quality-gate results."*
- This guardrail: *"Fix only. Do not merge, do not close, do not rebase onto or push the integration branch, do not resolve unrelated CI failures or merge conflicts unless they directly block verifying your change (if blocked, stop and report — that is merge-train's job). Push only the PR head branch."*

Use `subagent_type: general-purpose` (a code-reviewer subagent type is **not** appropriate here — this is implementation, not review). Collect each agent's per-item status, files changed, commit SHA, and gate results.

**Trust but verify.** A fixer agent's summary states intent, not ground truth. Before treating a PR as fixed, verify against the actual pushed diff: the changed files match the claimed items, no out-of-scope files were touched, the commit exists on the head branch, and the quality gates genuinely ran. If an agent's claim doesn't match the diff, treat those items as **could-not-do** and report honestly — never report a fix that isn't in the branch.

Push order does not matter (PRs are independent here — ordering/stacking is `merge-train`'s concern). Push each PR's head branch with a normal (non-force) push; if the branch diverged and a rebase is genuinely required to push, do a careful rebase preserving the PR's commits and force-push **only that PR's head branch with lease** (`--force-with-lease`) — never the integration branch, and never without the batch confirmation having covered it.

### Phase 5b — Drive CI to green after the fix push (writes; only after confirmation)

After each PR's fixer agent has pushed, **do not flip the label or mark items "addressed" until CI is green.** A `needs-rereview` flip on a branch with red CI is a lie to reviewers — the contract here is "fixes applied and CI verifies them." This is a hard gate, skippable only via `--no-wait-ci`.

Per PR (these can run in parallel across PRs since PRs are independent here, batched at `--concurrency`):

a. **Poll CI state**: `gh pr checks <number> --repo <owner>/<repo>` (or `gh pr view <number> --json statusCheckRollup`). Categorize each required check as `SUCCESS`, `FAILURE` (`FAILURE` / `CANCELLED` / `TIMED_OUT` / `ACTION_REQUIRED`), or `PENDING` (`QUEUED` / `IN_PROGRESS` / `WAITING`).

b. **If every required check is `SUCCESS`** → CI confirms the fixes. Mark every actionable item that was implemented as `addressed`, and proceed to Phase 6.

c. **If any required check is `PENDING`** → sleep `--ci-poll` seconds (default 30s) and re-poll. Track total wait time against `--ci-timeout` (default 30 min). When the ceiling is hit while checks are still pending, mark the PR `ci-still-pending`: in the status comment, list items as `addressed-pending-ci` (the diff exists, CI didn't confirm); do **not** flip the label (`changes-requested` stays).

d. **If any required check is `FAILURE`** → fetch the failing check's logs (`gh run view <run-id> --log-failed --repo <owner>/<repo>`) and **re-dispatch the same PR's fixer sub-agent in its existing worktree** with the new failures appended as additional actionable items (`[<n>-ci-1]`, `[<n>-ci-2]`, ...). The agent applies the minimal fix, runs the quality gates locally, commits, pushes. Then go back to (a) — **the loop continues**.

e. **Keep looping** as long as failures are mechanical (lint, formatting, type errors, lockfile drift, flaky-retry, env/setup, or a missed edge case in the original fix that's still scoped to the requested change). Break out without reaching green only when:

   - **Real defect surfaced by the fix** — the fix introduced (or revealed) a real test/security/contract failure that the agent cannot resolve within the requested change's scope. Mark the corresponding items `could-not-do` with the failing check + reason, leave `changes-requested` in place, comment honestly.
   - **Same CI failure recurs unchanged after two consecutive fix attempts** targeting it — treat as a real defect (the mechanical fix didn't take). Same outcome as above.
   - **`--ci-timeout` reached while checks are still pending** — mark `ci-still-pending` (see (c)).

Never weaken a check to make it green (no `--no-verify`, no deleting/skipping tests, no loosening lint). If you find yourself tempted, the failure is a real defect — break out and report.

If `--no-wait-ci` was passed, skip Phase 5b entirely and go to Phase 6; in the status comment, items are reported as `addressed-no-ci-check`.

### Phase 6 — Annotate (writes; only after confirmation)

For each PR that had at least one item attempted:

1. **Status comment** (unless `--no-comment`): post a `<!-- fix-train -->`-prefixed comment summarizing, per item: addressed (with commit SHA) / could-not-do (why) / deferred-needs-decision (the open question for the human) / stale. If a prior `<!-- fix-train -->` comment by the current user exists, update it (`gh api ... -X PATCH`) instead of stacking; else create it (`gh pr comment <n> --repo <owner>/<repo> --body-file <tmp>`; write via temp file to preserve formatting; delete the temp file immediately after).
2. **Threads** (only with `--reply-threads`): reply to each addressed inline review thread with the commit SHA and resolve it. Never resolve a thread for a `needs-decision`/`could-not-do`/`stale` item — those stay open for the human.
3. **Label** (unless `--no-label`): only if **all** actionable items for the PR were successfully addressed, the local quality gates passed, **and CI on the pushed branch is green** (Phase 5b reached step (b)) — `gh pr edit <n> --repo <owner>/<repo> --remove-label changes-requested --add-label needs-rereview` (create `needs-rereview` if missing: `gh label create needs-rereview --repo <owner>/<repo> --color FBCA04 --description "fix-train: changes applied, awaiting re-review"`). If any actionable item could not be done, or CI did not reach green (`ci-still-pending`, real-defect break-out), **leave `changes-requested` in place** — the PR is not ready for re-review.
4. If a comment/label/thread call fails for one PR, record it and continue — never abort the whole batch for one PR.

Never submit a formal GitHub review, never approve, never merge, never close.

### Phase 7 — Final report

Summarize per PR: items addressed (with commit/SHA + push URL), items that could not be done and why, items deferred for human decision, stale items, gate results, label transition, comment URL (new/updated). List skipped (drafts / out-of-scope / all-needs-decision) PRs. Recommend the next action: which PRs are ready for a re-review (`review-train`) and which need human input before fix-train can finish them. Explicitly restate that nothing was reviewed-from-scratch, merged, or closed.

## Safety Rules

- **One grouped confirmation** before any write. No edit/commit/push/comment in `--dry-run`.
- **CI must be green before flipping `changes-requested` → `needs-rereview`.** After the fixer's push, poll `gh pr checks` until every required check is `SUCCESS` (bounded by `--ci-timeout`). If CI fails or stays pending, the label stays `changes-requested` and the status comment reports honestly. The only opt-out is the explicit `--no-wait-ci` flag.
- **Keep iterating on CI failures until CI is green** (bounded by `--ci-timeout`). After a push, if CI fails for a mechanical reason that's still in the scope of the requested change, re-dispatch the fixer agent with the new failures appended; push again; re-poll. Break out only when: (1) a real defect surfaces that the agent cannot resolve in scope, (2) the same failure recurs unchanged after two fix attempts, or (3) the timeout is reached while checks remain pending.
- **Fix only.** Never merge, never close, never approve, never submit a formal review, never resolve CI failures that originate **outside** the requested-change scope (an unrelated flaky integration test, a broken main, an infrastructure outage) or merge conflicts (that's `merge-train`). CI fixes here are scoped to failures caused by, or newly surfaced by, the requested changes. If a failure is out-of-scope, mark it as such, leave the label, and report.
- **Surgical scope.** Implement only the confirmed actionable items, each as the minimal change. No opportunistic refactor, cleanup, renaming, or unrelated file edits — touching code orthogonal to the requested change is a failure mode.
- **Never weaken a quality gate to pass it.** No `--no-verify`, no deleting/skipping/`xfail`-ing tests, no loosening lint/types. A gate failing for a real reason ⇒ that item is `could-not-do`, reported honestly.
- **Never guess ambiguous or contradictory feedback.** `needs-decision` items are surfaced for a human, never silently implemented and never silently dropped. Contradictory reviewer requests ⇒ surface both, pick neither.
- **Branch isolation.** Each PR is fixed in its own isolated worktree; parallel fixes must not collide. Push only PR head branches; never push or rebase the integration/default branch; force-push only a PR head branch and only with `--force-with-lease` when a rebase is genuinely required.
- **Trust but verify.** Verify every claimed fix against the actually-pushed diff before reporting it as done. Never report a fix that isn't in the branch; never invent file paths.
- **Idempotent.** Update the prior `<!-- fix-train -->` comment instead of stacking; only flip `changes-requested` → `needs-rereview` when the PR is fully addressed, otherwise leave the label as-is.
- **Respect the URL's filter** — never act on PRs outside the requested scope. Never fix a draft unless `--include-drafts`.
- Repo-agnostic: detect the quality gates from the project (package manager + scripts / Makefile / toolchain). When project instructions mandate a specific toolchain (e.g. a required package manager), honor it — do not substitute.

## Output Format

A single Markdown report:

```
## Fix Train — <owner>/<repo> (<N> open PRs in scope)
Sources: <all | reviews | review-train | inline>   Quality gates: <detected commands>
CI gate: must be green after fix push before flipping label · ci-timeout: <N>min · ci-poll: <N>s · wait-ci: <on|off>

### Overview
#12  feat: X       → 3 actionable · 0 decision · 1 stale     label: changes-requested→needs-rereview   comment: new
#15  refactor: Y   → 1 actionable · 2 decision · 0 stale     label: (kept) changes-requested            comment: update
#18  fix: Z        → 0 actionable (all needs-decision)        → skipped (nothing safe to auto-fix)
#20  wip (draft)   → skipped (draft)
...

### Per-PR fix checklist
#12
  [12-1] src/a.ts:42  defect: <why> → fix: <intended change>      src: review-train item 2   actionable
  [12-2] src/b.ts:88  defect: <why> → fix: <intended change>      src: @alice inline         actionable
  [12-3] src/c.ts:10  defect: <ambiguous>                          src: @bob review           needs-decision
  ...
#15 ...

### Plan
Will fix + push + comment: #12 (3 items), #15 (1 item)
Deferred for human decision: #12 [12-?], #15 [15-1 15-2] — listed above
Skipped: #18 (all needs-decision), #20 (draft)
No re-review · no merge · no unrelated CI/conflict work — fix only.

> Proceed with the full batch? (yes / dry-run / subset)
```

After execution, append an **Execution result** section: per PR — items addressed (commit SHA), items could-not-do (+ why), items deferred (the open question), local gate results, **CI loop iterations** (each: failing check → fix commit SHA → next CI state — until green / break-out reason), final CI verdict (`green` / `real-defect` / `ci-still-pending` / `no-ci-check`), push URL, label transition, comment URL (new/updated); skipped PRs; and the recommended follow-up (which PRs are ready for `review-train` re-review, which need human input).
