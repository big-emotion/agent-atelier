# PR Trains

> Five confirm-once "train" skills that batch-process GitHub queues end to end — turn open issues into PRs, drive CI green, review, apply requested changes, and merge in dependency order.

Part of [Agent Atelier](../../README.md). Install:

```
/plugin marketplace add big-emotion/agent-atelier
/plugin install pr-trains@big-emotion
```

## How the tools compose

The trains compose in a fixed order and hand off via labels and marker comments: issue-train opens one PR per actionable issue → fix-ci-train drives required checks green (`ci-failing` → `ci-green` is the explicit handoff that unblocks CI-gated review) → review-train posts structured verdicts with `approved` / `changes-requested` labels → fix-train consumes those change requests and flips PRs to `needs-rereview` once CI confirms the fixes → after re-review, merge-train computes the safe order and merges. Each train is deliberately scoped to refuse its siblings' jobs (a review request sent to fix-train is deferred, and vice versa), every train does all analysis read-only first, presents one consolidated plan, and performs zero writes until a single grouped confirmation — `--dry-run` stops at the plan on all five.

## Tools

### `issue-train` — skill

Triages every open GitHub issue in a list, then turns the survivors into pull requests. Read-only phases detect existing PR linkage through the Development field (GraphQL `closedByPullRequestsReferences` + timeline events), detect silent fixes in already-merged PRs (strict `#<n>` reference matching by default; opt-in fuzzy matching is always surfaced for human confirmation, never auto-accepted), and classify unlinked issues by pertinence and complexity via parallel triage sub-agents. After one grouped confirmation it closes stale or already-fixed issues with a stated reason and an idempotent `<!-- issue-train -->` comment, then dispatches one implementer sub-agent per actionable issue in an isolated worktree to implement, run the repo's quality gates, push a branch, and open a PR containing `Closes #<n>` — verifying the Development-field link is actually live and reporting (but never fixing) each new PR's CI verdict.

**Use it when:**

- An issue backlog has accumulated and you want one pass that closes the dead ones and opens PRs for the rest
- You suspect merged PRs fixed issues without ever linking back (silent-fix detection, strict or fuzzy)
- You want a close-only cleanup pass before any implementation (`--no-implement`)
- You want every new PR to auto-close its issue on merge via a verified `Closes #<n>` Development-field link
- A single issue URL: process just that one

**Don't use it for:**

- The work items are already PRs — use review-train, fix-train, fix-ci-train, or merge-train
- Issues are multi-module or ambiguous — anything above `--max-complexity` (default medium) is surfaced as needs-human, not implemented
- You expect the resulting PRs to be merged — issue-train stops at opening them

**Example:**

```
/pr-trains:issue-train https://github.com/acme/app/issues?q=is%3Aopen+label%3Abug --max-complexity simple --dry-run
```

**Requirements:** GitHub CLI (`gh`) authenticated with `repo` scope; `git` with a clean working tree; issues enabled on the target repo; an agent runtime with parallel sub-agents and worktree isolation

### `fix-ci-train` — skill

Walks every open PR whose required checks are red and drives them green — CI only. It fetches failing-step logs, classifies each failure (lint, format, types, tests, build, lockfile, codegen, infra, flake, external, unknown), and builds a per-PR checklist of minimal actionable fixes; ambiguous or out-of-diff failures become needs-decision / out-of-scope and are surfaced, never guessed. After one grouped confirmation, parallel fixer sub-agents (one isolated worktree per PR) apply the fixes, run the repo's quality gates locally, push, and the skill then polls real CI — re-dispatching fixers on new failing logs — until every required check is SUCCESS or a bounded break-out (`--max-iterations`, same-failure-twice, real defect, `--ci-timeout`); the `ci-failing` → `ci-green` label flips only on a genuine CI green, never on local-gate results, and checks are never weakened to pass.

**Use it when:**

- Several open PRs are red on required checks and your review workflow is gated on green CI
- The failures look mechanical: lint, formatting, type errors, lockfile drift, stale codegen, snapshot updates
- You want a per-PR CI-failure diagnosis and fix plan without touching anything (`--dry-run`)
- A single PR's CI needs driving to green (single-PR URL)
- You want fixes done locally as inspectable patches without pushing (`--no-push`)

**Don't use it for:**

- The failure originates outside the PR's diff — broken default branch, infra outage, external scanner status (surfaced, never fixed)
- You want reviewer feedback addressed — that is fix-train
- You want conflicts resolved or the PR merged — that is merge-train

**Example:**

```
/pr-trains:fix-ci-train https://github.com/acme/app/pulls --max-iterations 3 --concurrency 2
```

**Requirements:** GitHub CLI (`gh`) authenticated with `repo` + `actions:read` scopes (run-log access); `git` with a clean working tree; the repo's own toolchain installed for local quality gates; sub-agents with worktree isolation

### `review-train` — skill

Code-reviews every open PR in a list and nothing else — its only writes are one marker-prefixed review comment per PR (idempotently updated on re-runs, never stacked) and an `approved` / `changes-requested` label (creating the label definitions if absent). One reviewer sub-agent per PR produces a five-axis review (correctness, readability, architecture, security, performance) that mirrors a reference review's exact structure — supplied via `--reference <comment-url>`, auto-detected from recent structured reviews on the repo, or a built-in canonical Why/Fix format. It waits read-only for CI to settle before reviewing (bounded by `--ci-timeout`), includes every full drafted review body in the plan for audit, and posts only after one grouped confirmation; it never posts a formal merge-blocking GitHub review unless explicitly asked.

**Use it when:**

- You want a consistent, structured review and verdict label on every open PR in one pass
- Reviews must match a house style — point `--reference` at a known-good review comment
- You want to audit all drafted review bodies before anything is posted (`--dry-run`)
- You are producing the change-request input that fix-train will consume downstream

**Don't use it for:**

- CI is red and you want it fixed — review-train never touches CI (use fix-ci-train)
- You want fixes applied, conflicts resolved, or PRs merged — fix-train / merge-train
- You need a formal merge-gating GitHub review — the contract is comment + label, which does not block merges

**Example:**

```
/pr-trains:review-train https://github.com/acme/app/pulls --reference https://github.com/acme/app/pull/12#issuecomment-123456
```

**Requirements:** GitHub CLI (`gh`) authenticated with `repo` scope; `git` (a clean working tree is not required — it never touches branches); parallel reviewer sub-agents

### `fix-train` — skill

Applies the changes reviewers asked for across every open PR — fix only, no merge. It collects formal CHANGES_REQUESTED reviews, unresolved inline review comments, and review-train marker comments / `changes-requested` labels (selectable via `--source`) into a deduplicated per-PR checklist, classifying each item actionable, needs-decision (ambiguous or contradictory feedback is surfaced, never guessed — opposing reviewer requests are both flagged), or stale. After one grouped confirmation, parallel fixer sub-agents in isolated worktrees implement the minimal fixes, run the repo's quality gates, push to each PR branch, then iterate on CI failures until green before flipping `changes-requested` → `needs-rereview` and posting one idempotent `<!-- fix-train -->` status comment; every claimed fix is verified against the actually-pushed diff before being reported.

**Use it when:**

- A review pass (review-train or human reviewers) left change requests across many PRs
- You want the changes-requested queue cleared, with the label flipped only once CI confirms the fixes
- You want addressed inline review threads replied to and resolved (`--reply-threads`)
- You want the fixes prepared locally for inspection without pushing (`--no-push`)

**Don't use it for:**

- No review feedback exists yet — run review-train first; fix-train never reviews from scratch
- CI is failing for reasons unrelated to the requested changes — that is fix-ci-train
- Merge conflicts or merging — that is merge-train

**Example:**

```
/pr-trains:fix-train https://github.com/acme/app/pulls --source review-train
```

**Requirements:** GitHub CLI (`gh`) authenticated with `repo` scope; `git` with a clean working tree; the repo's own toolchain installed for local quality gates; sub-agents with worktree isolation

### `merge-train` — skill

Processes a whole PR queue through to merge. It computes a safe merge order from stacked branches (strongest signal), explicit `depends on #N` / `blocked by #N` mentions, file overlap, and size/risk — dependency cycles or contradictory signals stop and ask, never guess — then triages each PR as mergeable, changes-required, or blocked-by-order, with a proportionate five-axis review per diff. After one grouped confirmation it resolves conflicts (preserving both sides' intent), loops fix-and-push on mechanical CI failures until every required check is SUCCESS — a PR is never merged on red or pending CI, and checks are never weakened or `--admin`-bypassed — merges in order using the repo's merge method, re-evaluates downstream PRs after each merge, and posts a status comment on every PR it did not merge.

**Use it when:**

- You want the queue actually merged, in a dependency-safe order
- PRs are stacked on each other or declare `depends on #N` and you need the order computed and honored
- You accept mechanical CI fixes and conflict resolution as part of getting each PR mergeable
- End of the pipeline, after reviews and requested changes have landed

**Don't use it for:**

- You only want reviews or fixes — use the scoped sibling trains instead
- Draft PRs — they are reported but never merged
- Merging would require bypassing branch protection — it refuses `--admin` merges unless explicitly asked

**Example:**

```
/pr-trains:merge-train https://github.com/acme/app/pulls --ci-timeout 45
```

**Requirements:** GitHub CLI (`gh`) authenticated with `repo` scope (merge + comment); `git` with a clean working tree; the repo's own toolchain to verify CI and conflict fixes locally
