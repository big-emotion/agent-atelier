---
name: issue-train
description: Batch-process every open GitHub issue in a list — triage, detect existing PR linkage, detect silent fixes in already-merged PRs, close issues that are no longer pertinent, then plan + build + open one PR per remaining actionable issue with `Closes #<n>` in the body so GitHub's Development field links the PR to the issue and merging the PR auto-closes it. From a GitHub issues URL (or the current repo), enumerate every open issue, dispatch a team of parallel triage sub-agents (one per issue) to classify each as `already-linked` / `silently-fixed` / `not-pertinent` / `actionable` / `needs-decision`, then for the actionable set dispatch a team of parallel implementer sub-agents (one isolated worktree per issue) that read the issue, plan the change, implement it, run the repo's quality gates, push, and open a PR. Presents one consolidated plan, asks for a single grouped confirmation, then performs every write in one batch. Never merges PRs, never force-closes issues without a stated reason. Generic and repo-agnostic. Use when the user shares a GitHub issues page and asks to "process all the open issues", "triage the issue backlog", "close the stale issues and implement the rest", "go through every open issue and open PRs", or invokes /issue-train.
metadata:
  author: Big Emotion
  version: "1.0.0"
---

# Issue Train

Walk a whole list of open GitHub **issues** in one pass: triage every issue, detect which already have a linked PR (open or merged), detect which were silently fixed by a merged PR that never linked back, close the ones that are no longer pertinent with a stated reason, and for the rest plan + build + open one PR per issue — each PR carrying `Closes #<issue-number>` in its body so the GitHub UI shows the issue ↔ PR link in the **Development** field and merging the PR auto-closes the issue.

This is the fourth member of the train family and fills the gap upstream of the others:

- `issue-train` — **issue → PR** (this skill): triages issues, closes stale ones, opens PRs for the rest. Never merges.
- `review-train` — **review only**: posts reviews + `approved` / `changes-requested` labels on PRs. Writes nothing to code.
- `fix-train` — **fix only**: consumes change requests, applies them, pushes. Never merges.
- `merge-train` — **merge**: orders, fixes CI/conflicts, merges.

The natural pipeline is `issue-train` → PRs opened → `review-train` → `fix-train` → `merge-train` → PRs merge → linked issues auto-close.

This skill performs **irreversible shared-repo actions** (creating branches, pushing, opening PRs, commenting on and closing issues). It follows the same **grouped-confirmation** model as its siblings: all enumeration, linkage detection, and triage are read-only, one complete plan is presented, and it waits for a **single explicit confirmation** before any branch push, PR creation, issue comment, or issue close. Until the user confirms, nothing is written anywhere.

## When to Activate

- User shares a GitHub issues URL and asks to **process / triage / clear / implement** the open issues.
- User says: "process all the open issues", "go through every open issue and open PRs", "triage the issue backlog", "close the stale issues and implement the rest", "clear the issue queue", "open a PR for every open issue that's still pertinent".
- User invokes `/issue-train` (optionally with a GitHub issues URL or `--dry-run`).

If the user asks to *review / fix / merge PRs*, defer to the matching train. Do not blur them.

## Inputs

- **Primary**: a GitHub issues URL. Any of: `/issues`, a search query (`/issues?q=...`), a label/milestone/assignee filter, or a single issue URL. Honor the filter in the URL — only the issues the URL would list are in scope. A single-issue URL ⇒ process just that one.
- If no URL is given, default to the current repo's open issues (`gh issue list`); confirm the repo if ambiguous.
- Flags:
  - `--dry-run` — produce the full plan + the drafted per-issue summaries and stop; never edit, commit, push, comment, or close.
  - `--base <branch>` — branch to start implementation from (default: auto-detect the repo's default/integration branch — never push to it).
  - `--concurrency <n>` — max parallel sub-agents in each phase (default 4).
  - `--max-complexity <simple|medium|complex>` — ceiling for what the implementer will attempt automatically. `simple` = bounded one-file or one-module fix. `medium` (default) = small feature with a clear, scoped acceptance criterion. `complex` = multi-module / unclear-scope work; if you pass this, the implementer will still surface a plan first but will attempt the change. Anything above the chosen ceiling is reported as `needs-human` instead of implemented.
  - `--no-implement` — run triage + linkage detection + close-the-stale, but do not implement / open PRs (useful for an initial cleanup pass).
  - `--no-close` — do not close `not-pertinent` or `silently-fixed` issues; comment-only.
  - `--no-comment` — implement + open PRs but do not post the recap comment on the issue (the PR's `Closes #<n>` still creates the link).
  - `--silent-fix-mode <strict|fuzzy>` — how aggressive the silent-fix detector is. `strict` (default): only match merged PRs that explicitly reference the issue number in title or body. `fuzzy`: additionally semantic-match the issue text against recent merged PR diffs (slower; only over the last `--silent-fix-window` PRs).
  - `--silent-fix-window <n>` — for `fuzzy` mode, how many recent merged PRs to consider per issue (default 50).
  - `--include-stale-label <label>` — additional label that means "candidate for close" (default: `stale`, `wontfix`, `invalid`, `duplicate`).
  - `--ci-timeout <minutes>` — per-PR ceiling on how long to wait for CI after the implementer pushes, before declaring the PR `ci-pending` in the report (default: `30`). Does **not** block opening the PR — the PR is opened as soon as the push completes; the CI wait is just so the report can state CI's verdict.
  - `--ci-poll <seconds>` — interval between `gh pr checks` polls while waiting for CI on the newly-opened PRs (default: `30`).
  - `--no-wait-ci` — open PRs and stop; do not poll CI for the report. Default off.

## Preconditions

Verify before any analysis. If any fail, stop and report the blocker.

1. `gh auth status` succeeds and has `repo` scope (needed to push, open PRs, comment on and close issues, edit labels).
2. `git` is available and the working tree is clean (`git status --porcelain` empty). Implementer agents run in **isolated worktrees**, but a dirty primary tree still risks contamination — stop and ask the user to commit or stash.
3. The target repo is reachable via `gh repo view <owner>/<repo>`.
4. Resolve the default/integration branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` (overridden by `--base`; never pushed to by this skill — recorded so implementers never target it directly).
5. The repo has issues enabled: `gh repo view --json hasIssuesEnabled -q .hasIssuesEnabled` must be `true`. If false, stop — there is nothing to process.

## Workflow

### Phase 1 — Enumerate (read-only)

```bash
gh issue list --repo <owner>/<repo> --state open --limit 200 \
  --json number,title,body,labels,assignees,author,url,createdAt,updatedAt,comments
```

Apply the URL's filter. Pull requests are also returned by some GitHub endpoints under "issues" — filter them out (`gh issue list` already does this, but verify each item lacks a `pull_request` field if you fall back to `gh api repos/<owner>/<repo>/issues`).

### Phase 2 — Linkage detection (read-only, parallel)

For each open issue, determine whether a PR is already attached to it via the **Development field** (the UI label GitHub uses for "linked pull requests"). The Development field is populated by either (a) a closing-keyword reference in a PR body (`Closes #N` / `Fixes #N` / `Resolves #N`), or (b) manual "Link a pull request" via the UI. Both surface as `ConnectedEvent` / `closedByPullRequestsReferences` in the GraphQL API.

For each issue, run in parallel:

a. **Linked PRs via the Development field** — GraphQL:

   ```graphql
   query($owner:String!,$repo:String!,$num:Int!) {
     repository(owner:$owner,name:$repo) {
       issue(number:$num) {
         closedByPullRequestsReferences(first:20, includeClosedPrs:true) {
           nodes { number state url title mergedAt isInMergeQueue }
         }
         timelineItems(first:50, itemTypes:[CONNECTED_EVENT, DISCONNECTED_EVENT, CROSS_REFERENCED_EVENT]) {
           nodes {
             __typename
             ... on ConnectedEvent { subject { ... on PullRequest { number state url } } }
             ... on DisconnectedEvent { subject { ... on PullRequest { number } } }
             ... on CrossReferencedEvent { source { ... on PullRequest { number state url title mergedAt } } }
           }
         }
       }
     }
   }
   ```

   Capture the latest state per PR (a `DisconnectedEvent` after a `ConnectedEvent` ⇒ link was removed).

b. **Silent-fix detector** — only if (a) returned no merged PRs. Find merged PRs that touched this issue without a closing keyword:

   - `strict` mode: `gh search prs --repo <owner>/<repo> --state merged "#<n> in:title,body" --json number,title,url,body,mergedAt,headRefName` — keep matches where `#<n>` appears as a standalone token (regex `(^|[^[:alnum:]])#<n>([^[:alnum:]]|$)`), not inside a longer number.
   - `fuzzy` mode (only if `--silent-fix-mode=fuzzy`): additionally take the last `--silent-fix-window` merged PRs and let a sub-agent compare the issue's title+body against each PR's title+body+`gh pr diff` summary; return the top 3 candidates with a confidence score and a one-line rationale. **Never silently accept a fuzzy match — it is always a `needs-decision` candidate the user can promote.**

c. **Categorize**:

   - `already-linked-open` — at least one linked PR is `OPEN`. Skip; report.
   - `already-linked-merged` — at least one linked PR is `MERGED` but the issue is still open. Propose closing the issue with a comment referencing the merged PR. (The merge keyword likely failed to auto-close, or the link was added manually.)
   - `silently-fixed-strict` — no Development-field link, but at least one merged PR explicitly references `#<n>` in title or body. Propose: edit the PR body to insert `Closes #<n>` (so the Development field shows the link going forward) and close the issue with a comment.
   - `silently-fixed-fuzzy` — fuzzy-match candidates only. Always `needs-decision`: list the candidate PR(s) + confidence for the user to confirm.
   - `unlinked` — no PR linkage at all; falls through to Phase 3 for relevance/complexity triage.

### Phase 3 — Triage the unlinked issues (read-only, parallel)

For each `unlinked` issue, spawn one triage **sub-agent** via the Agent tool, batched at `--concurrency`. Each sub-agent prompt is self-contained and must include:

- The issue number, title, full body, labels, assignees, age (created → updated → today), and URL.
- A short, generated snapshot of the relevant area of the codebase (paths/files that look related, based on the issue's keywords) — gathered in advance by a read-only `Explore`-style search; not invented by the triage agent.
- This instruction: *"Classify the issue against the current state of the codebase. Output exactly three fields. **pertinent**: yes/no/maybe — is this issue still meaningful given the code as it stands today (not stale, not already implemented in a way the reporter missed, not contradicted by a later product decision in the repo). **complexity**: simple/medium/complex — simple = one-file or one-module bounded change; medium = small feature with a clear acceptance criterion fully scoped by the issue; complex = multi-module, unclear scope, or product-decision required. **rationale**: one short paragraph, citing `file:line` for any code evidence and quoting the issue line that resolves the call. If pertinent=no, name the reason (`already-implemented` / `stale-no-longer-relevant` / `duplicate-of-#X` / `out-of-scope-product-decision` / `not-actionable-discussion`)."*
- This guardrail: *"Read-only. Do not modify any file. Do not invent file paths — if you cite a path, it must exist in the repo. If you cannot confidently classify, return pertinent=maybe with the open question."*

Use `subagent_type: general-purpose`. Collect each agent's `pertinent`, `complexity`, and `rationale`.

**Trust but verify.** Spot-check a sample of cited file paths exist before relying on a triage agent's claim. If an agent invented paths, downgrade its verdict to `maybe`.

Combine with Phase 2 to produce per-issue final classification:

- `already-linked-open` → skipped (report only)
- `already-linked-merged` → **close-with-merged-pr** (proposed)
- `silently-fixed-strict` → **close-with-silent-fix** (proposed, optionally edit PR body to add `Closes #<n>`)
- `silently-fixed-fuzzy` → **needs-decision** (candidates surfaced)
- `unlinked` + pertinent=no → **close-stale** (proposed, with the stated reason)
- `unlinked` + pertinent=maybe → **needs-decision** (surfaced, never silently implemented or closed)
- `unlinked` + pertinent=yes + complexity ≤ `--max-complexity` → **actionable** (will be implemented)
- `unlinked` + pertinent=yes + complexity > `--max-complexity` → **needs-human** (surfaced; the user can override per-issue at the confirmation gate)

### Phase 4 — Present the consolidated plan (the single confirmation gate)

Output one Markdown report (see Output Format). For every in-scope issue show: title, age, labels, classification, the action that will be taken, and (for `actionable`) a one-paragraph plan sketch generated by the triage agent. List `needs-decision` and `needs-human` items inline so the user can audit and promote/demote individual issues before any write.

Then ask **one** grouped confirmation:

> "Issue plan ready: N open issues — A already linked (skip), B linked to merged PRs (close), C silently-fixed (close + link), D not pertinent (close with reason), E actionable (plan + build + open PR), F need a human decision, G above complexity ceiling. I will, per actionable issue in an isolated worktree: read the issue, draft a plan, implement the change, run `<detected quality gates>`, commit, push a new branch, and open a PR with `Closes #<n>` in the body so the Development field links it and merging auto-closes the issue. I will close the not-pertinent and silently-fixed issues with a stated reason. No PR review, no merge. Proceed with the full batch? (yes / dry-run / pick a subset / edit classifications)"

- `--dry-run` (or a dry-run answer) ⇒ stop here; write nothing.
- The user may approve a subset, demote `actionable` items to `needs-human`, promote `needs-human` to `actionable`, accept a `silently-fixed-fuzzy` candidate, or reclassify any item — respect the edits exactly.
- Without an explicit "yes", **do nothing**.

### Phase 5 — Close the non-implement set (writes; only after confirmation)

For each issue in the close-with-* / close-stale set, in issue-number order (or in parallel if `--concurrency > 1` — these are independent):

1. **Comment** (unless `--no-comment`): post a `<!-- issue-train -->`-prefixed comment naming the reason and linking the relevant PR if any. If a prior `<!-- issue-train -->` comment by the current user exists on this issue, update it (`gh api ... -X PATCH`) instead of stacking; else create it (`gh issue comment <n> --repo <owner>/<repo> --body-file <tmp>`; write via temp file to preserve formatting; delete the temp file immediately after).
2. **For `silently-fixed-strict` only**: if the merged PR's body does not already contain a `Closes #<n>` / `Fixes #<n>` / `Resolves #<n>` line, edit the PR body to append one (`gh pr edit <pr-number> --repo <owner>/<repo> --body "<existing-body>\n\nCloses #<n>"`). This makes the Development field show the link going forward; it does **not** retroactively auto-close (the PR is already merged), so we close the issue explicitly in step 3.
3. **Close the issue** (unless `--no-close`): `gh issue close <n> --repo <owner>/<repo> --reason <completed|not_planned>` — `completed` for `already-linked-merged` and `silently-fixed-strict`; `not_planned` for `close-stale` with `stale`/`wontfix`/`duplicate`/`out-of-scope`/`not-actionable` rationale.

If a comment / edit / close call fails for one issue, record it and continue — never abort the whole batch for one issue.

### Phase 6 — Dispatch the implementer team (writes; only after confirmation)

For each `actionable` issue, spawn one implementer **sub-agent** via the Agent tool with `isolation: "worktree"` so each agent works on an isolated copy of the repo and parallel implementations never collide. Batch at `--concurrency` (default 4) — send each batch as parallel tool calls in one message, wait, then the next batch.

Each sub-agent prompt is self-contained and must include:

- The issue number, title, full body, labels, URL, and the triage agent's plan sketch.
- The integration branch name (the value resolved in Preconditions step 4) and an explicit instruction never to push to it.
- The repo's detected quality gates (package manager + scripts / Makefile / language toolchain — e.g. lint, typecheck, test, build).
- A short codebase snapshot (relevant paths discovered in Phase 3).
- This instruction: *"In your isolated worktree, check out a new branch off the integration branch named `issue-train/<issue-number>-<short-slug>`. (1) Read the issue end-to-end. (2) Write a plan: list the files you will touch and the smallest set of changes that satisfies the issue's acceptance criteria. If the issue is ambiguous or the plan would exceed the requested scope, **stop and report `needs-human`** with the open question — do not guess. (3) Implement the plan as the minimal change. Do not refactor adjacent code. (4) Run the repo's quality gates and make them pass without weakening them. Never silence a check (`--no-verify`, deleting/skipping tests, loosening lint) to make it green — if a gate fails for a real reason, leave the work unstaged and report `could-not-implement` with the failing gate + reason. (5) Commit with a clear message referencing the issue (e.g. `feat: <title> (refs #<n>)`). (6) Push the branch. (7) Open a PR against the integration branch using `gh pr create --base <integration-branch> --head <branch> --title '<type>: <issue-title>' --body-file <tmp>` where the body **must contain** a line of the form `Closes #<n>` on its own line (so GitHub populates the Development field and merging auto-closes the issue), plus a Summary section and a Test plan section. (8) Output the PR URL, the commit SHA, the files changed, and the quality-gate results."*
- This guardrail: *"Implement only the scope of this one issue. Do not touch unrelated issues, do not open multiple PRs for one issue, do not merge, do not close the issue (the PR's `Closes #<n>` handles that on merge), do not push to the integration branch, do not force-push. If you produce code, the PR body must contain `Closes #<n>` exactly once on its own line — that is the contract this skill depends on."*

Use `subagent_type: general-purpose` (this is implementation work; the code-reviewer subtype is wrong here). Collect each agent's PR URL, commit SHA, files changed, gate results, and any `needs-human` / `could-not-implement` report.

**Trust but verify.** A sub-agent's summary states intent, not ground truth. Before treating an issue as PR'd, verify against GitHub: the PR exists (`gh pr view <url> --json number,body,headRefName,baseRefName,state`), its body contains `Closes #<n>` on its own line, the head branch is the one the agent claimed, and the base branch is the integration branch — not the default branch of a fork, not another feature branch. Also verify the Development field actually shows the link by re-querying the issue's `closedByPullRequestsReferences` (the link should appear within a few seconds of PR creation — if it doesn't, the closing keyword was malformed or scoped to a different repo; ask the agent to edit the PR body). If verification fails, the issue is reported as `pr-link-broken` with the discrepancy — never claim a link that GitHub doesn't show.

### Phase 6b — Wait for CI on the newly-opened PRs (writes-light: just polling + comment; only after confirmation)

For each PR opened in Phase 6, poll CI to give the final report an honest verdict. This phase does **not** fix CI failures (that's `fix-train` after a `review-train` pass) — it only reports.

Per PR (in parallel, batched at `--concurrency`):

a. **Poll CI state**: `gh pr checks <number> --repo <owner>/<repo>`. Categorize each required check as `SUCCESS`, `FAILURE`, `PENDING`.

b. **If every required check is `SUCCESS`** → final state `ci-green`.

c. **If any check is `FAILURE`** → final state `ci-red`; capture the names of the failing checks (not the logs — that's `fix-train`'s job).

d. **If any check is `PENDING` after `--ci-timeout`** → final state `ci-pending`.

e. **If `--no-wait-ci` was passed** → skip Phase 6b; final state `ci-not-checked`.

### Phase 7 — Final report

Summarize per issue:

- **closed**: issue number, reason, comment URL, close action (`completed` / `not_planned`), and (for `silently-fixed-strict`) the PR body that was edited.
- **pr-opened**: issue number, PR URL, branch name, commit SHA, files changed, local gate results, CI verdict (`ci-green` / `ci-red <checks>` / `ci-pending` / `ci-not-checked`), Development-field link verified `yes/no`.
- **already-linked-open**: issue number, the linked PR URL(s) and state(s) — skipped, no action.
- **needs-decision** / **needs-human**: issue number, the open question for the user.
- **could-not-implement**: issue number, the gate that failed or the scope problem the agent hit.
- **pr-link-broken**: issue number, the discrepancy between what the agent claimed and what GitHub shows — the most likely cause is the closing keyword being mis-spelled or in the wrong repo.

Recommend the next action: which PRs are ready for `review-train`, which issues still need human input, and which issues remained open because their PR could not be created.

Explicitly restate that nothing was merged, no PRs were reviewed, and no issues were force-closed without a stated reason.

## Safety Rules

- **One grouped confirmation** before any write. No comment/close/branch-push/PR-create in `--dry-run`.
- **Closing keyword is the contract.** Every PR opened by this skill must contain `Closes #<n>` (or `Fixes #<n>` / `Resolves #<n>`) on its own line in the PR body, exactly once. This is what populates GitHub's Development field and what triggers auto-close on merge — the user explicitly relies on it. After PR creation, **verify the Development field link is live** by re-querying the issue's `closedByPullRequestsReferences`; if the link doesn't appear, the keyword is malformed and the implementer must edit the PR body. Never report `pr-opened` for an issue without a verified Development-field link.
- **Never close an issue without a stated reason.** Every close action posts a `<!-- issue-train -->` comment naming the rationale (`completed-by-#<pr>` / `silently-fixed-by-#<pr>` / `stale` / `wontfix` / `duplicate-of-#<id>` / `out-of-scope` / `not-actionable-discussion`). A bare `gh issue close` is forbidden.
- **Never silently implement an ambiguous issue.** `needs-decision` and `needs-human` items are surfaced for the user, never silently coded. If the implementer agent finds the scope ambiguous mid-implementation, it must stop and report `needs-human` with the open question — not guess.
- **Never silently accept a fuzzy silent-fix match.** Fuzzy matches are always `needs-decision`; only `silently-fixed-strict` (explicit `#<n>` reference in a merged PR) is acted on automatically — and even then, only after the grouped confirmation.
- **Never merge, never review, never label PRs.** Opening the PR is where this skill stops. Merge is `merge-train`'s contract; review is `review-train`'s; fix is `fix-train`'s.
- **Surgical scope.** Implement only the scope of the single issue per PR. No opportunistic refactor, cleanup, renaming, or unrelated file edits. One issue ⇒ one PR ⇒ one set of changes that closes it.
- **Never weaken a quality gate to pass it.** No `--no-verify`, no deleting/skipping/`xfail`-ing tests, no loosening lint/types. A gate failing for a real reason ⇒ that issue is `could-not-implement`, reported honestly.
- **Branch isolation.** Each issue is implemented in its own isolated worktree on its own branch (`issue-train/<issue-number>-<slug>`); parallel implementations must not collide. Never push to the integration branch, never push to anyone else's feature branch.
- **Respect the URL's filter** — never act on issues outside the requested scope.
- **Trust but verify.** Verify every claimed PR, commit, comment, and close against GitHub before reporting it as done. Never report an action that the API doesn't confirm.
- **Idempotent.** Update the prior `<!-- issue-train -->` comment instead of stacking; if the implementer agent finds a PR already opened by a prior `issue-train` run on the same issue (matching head branch `issue-train/<n>-*` exists), it must not open a duplicate — update the existing PR's body if the `Closes` line is missing, otherwise skip with `already-pr'd-prior-run`.
- Repo-agnostic: detect the quality gates from the project (package manager + scripts / Makefile / toolchain). When project instructions (e.g. a `CLAUDE.md`) mandate a specific toolchain or workflow, honor it — do not substitute.

## Output Format

A single Markdown report:

```
## Issue Train — <owner>/<repo> (<N> open issues in scope)
Integration branch: <branch>   Quality gates: <detected commands>
Silent-fix mode: <strict|fuzzy>   Max complexity: <simple|medium|complex>
CI gate: report-only on newly-opened PRs · ci-timeout: <N>min · ci-poll: <N>s · wait-ci: <on|off>

### Overview
#42  bug: X failed to render          → actionable (medium)        → will open PR, Closes #42
#43  feat: Y export                   → needs-human (complex)       → above complexity ceiling
#44  Z deprecated in v3               → close-stale (stale)         → will comment + close (not_planned)
#45  W broken in Safari               → already-linked-open (#101)  → skipped
#46  V column header wrong            → close-with-merged-pr (#88)  → will comment + close (completed)
#47  U slow on large inputs           → close-with-silent-fix (#95) → will edit #95 body + comment + close
#48  T spec unclear                   → needs-decision              → surfaced (ambiguous scope)
#49  S maybe a duplicate              → needs-decision              → fuzzy silent-fix candidates: #80 (0.78), #91 (0.61)
...

### Triage detail
#42 — pertinent: yes — Implement: add null-check at `src/render.ts:120` (one-file, ~20 LoC).
     Plan sketch: …
#43 — pertinent: yes — Complexity: complex (spans 5 modules, requires data-model change).
#44 — pertinent: no — Reason: targets Z which was removed in v3 (commit a1b2c3). Close not_planned.
#46 — already-linked-merged: PR #88 (merged 2026-04-12) but issue still open. Closing keyword likely missing; verifying.
#47 — silent-fix candidate: PR #95 (merged 2026-04-30) — body mentions "fix the slow U pipeline" and references #47. Strict match.
#48 — open question: <quote the ambiguous lines>
#49 — fuzzy candidates: <PR titles + confidence + 1-line rationale per candidate>
...

### Plan
Will close (with comment + reason): #44, #46, #47
Will open PR (with `Closes #<n>`): #42 (+ N more)
Surfaced for human decision: #43, #48, #49
Skipped: #45 (already-linked-open)
No PR review · no merge · no force-close without reason.

> Proceed with the full batch? (yes / dry-run / subset / edit classifications)
```

After execution, append an **Execution result** section: per issue —

- closed: comment URL, close reason, edited-PR-body URL (if any);
- pr-opened: PR URL, branch, commit SHA, files changed, local gate results, CI verdict, Development-field link verified;
- needs-human / needs-decision / could-not-implement / pr-link-broken: the specific blocker;
- skipped: the reason.

Then the recommended follow-up: which PRs are ready for `review-train`, which issues need human input, and which issues remain open because their PR could not be created or could not be linked.
