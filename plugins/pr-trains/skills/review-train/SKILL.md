---
name: review-train
description: Batch code-review every open pull request in a GitHub list — review only, nothing else. From a GitHub PRs URL (or the current repo), enumerate every open PR, dispatch a team of parallel reviewer sub-agents (one per PR), and have each produce a high-detail five-axis review in the exact structured format of the project's reference review. Presents one read-only plan, asks for a single grouped confirmation, then posts one review comment per PR and applies an `approved` or `changes-requested` label (removing the opposite). Never fixes CI, never resolves conflicts, never pushes, never merges. Generic and repo-agnostic. Use when the user shares a GitHub pull-requests page and asks to "review all the open PRs", "code review the PR queue", "do a review pass", or invokes /review-train.
metadata:
  author: Big Emotion
  version: "1.1.0"
---

# Review Train

Code-review a whole list of open pull requests in one pass — and **only** review. Enumerate every open PR, dispatch a team of parallel reviewer sub-agents, post one structured high-detail review comment per PR, and tag each PR with an `approved` or `changes-requested` label.

This skill is **strictly review-scoped**. It never fixes CI, never resolves merge conflicts, never pushes to any branch, never merges, never closes PRs. Its only writes are: one review **comment** per PR and one **label** per PR. It still follows a **grouped-confirmation** model — all analysis is done read-only first, one plan is presented, and it waits for a **single explicit confirmation** before posting anything.

If the user also wants CI fixes / conflict resolution / merging, that is a different job — point them at the `merge-train` skill instead. Do not blur the two.

## When to Activate

- User shares a GitHub pull-requests URL and asks to **review** them (not merge).
- User says: "review all the open PRs", "code review the PR queue", "do a review pass on the open PRs", "review and label the PRs", "give me a detailed review on every open PR".
- User invokes `/review-train` (optionally with a GitHub PRs URL or `--dry-run`).

If the user asks to *merge* / *fix CI* / *resolve conflicts*, this is the wrong skill — defer to `merge-train`.

## Inputs

- **Primary**: a GitHub pull-requests URL. Any of: `/pulls`, a search query (`/pulls?q=...`), a label/milestone filter, or a single PR URL. Honor the filter in the URL — only the PRs the URL would list are in scope. A single-PR URL ⇒ review just that one.
- If no URL is given, default to the current repo's open PRs (`gh pr list`); confirm the repo if ambiguous.
- Flags:
  - `--dry-run` — produce the full plan + the drafted review bodies and stop; never post a comment or label.
  - `--reference <comment-url>` — a GitHub comment URL whose **structure and depth** the reviews must match. If omitted, auto-detect (see Phase 0).
  - `--no-label` — post review comments but do not apply/modify labels.
  - `--include-drafts` — also review draft PRs (default: drafts are listed but skipped).
  - `--concurrency <n>` — max parallel reviewer agents (default 4).
  - `--ci-timeout <minutes>` — per-PR ceiling on how long to wait for CI to reach a definitive state before reviewing (default: `30`). Once the ceiling is hit, the PR is reviewed anyway with `CI still pending after <timeout>` recorded as context.
  - `--ci-poll <seconds>` — interval between `gh pr checks` polls while waiting for CI (default: `30`).
  - `--no-wait-ci` — skip the CI-settle wait entirely and review immediately on whatever CI state is current (may be `pending`). Default off.

## Preconditions

Verify before any analysis. If any fail, stop and report the blocker.

1. `gh auth status` succeeds and has `repo` scope (needed to comment + label).
2. `git` is available. A clean working tree is **not** required — this skill never touches branches — but do not switch branches or modify the tree.
3. The target repo is reachable via `gh repo view <owner>/<repo>`.

## Workflow

### Phase 0 — Establish the reference review style (read-only)

The reviews must match a known-good review's **structure and level of detail**, not a generic template.

1. If `--reference <comment-url>` is given, fetch it:
   `gh api repos/<owner>/<repo>/issues/comments/<comment-id> --jq '.body'`
   (comment id is the trailing number in `#issuecomment-<id>`).
2. Else, auto-detect: look at recent review comments on the repo's recently-closed PRs for a structured reviewer comment (e.g. a bot-tagged reviewer comment, or a comment with `Verdict:` / `Issues requiring changes` sections). Pick the most detailed recent one.
3. Else, fall back to the **Canonical Review Format** below.

Extract from the reference: section headings, ordering, how issues are itemized (numbering, **Why**/**Fix** sub-structure), and how the verdict is phrased. Every PR review in this run must reproduce that exact shape. Show the user which reference was used.

### Phase 1 — Enumerate (read-only)

```bash
gh pr list --repo <owner>/<repo> --state open --limit 200 \
  --json number,title,headRefName,baseRefName,isDraft,author,url,labels,body,additions,deletions,changedFiles
```

Apply the URL's filter. Drafts are listed but skipped unless `--include-drafts`.

### Phase 2 — Per-PR context gathering (read-only)

For each in-scope PR collect, in parallel where possible:

- **Diff**: `gh pr diff <number> --repo <owner>/<repo>` (and `--name-only` for the file list).
- **Linked ticket / intent**: parse the PR body + title for a ticket key or "expected behaviour". If the repo uses Jira/Linear keys, capture the key so the review can state *expected behaviour from the ticket* like the reference does.
- **CI status — wait for it to settle before reviewing (read-only, never fixed here)**: `gh pr checks <number>`. A review whose "CI: pending" line is meaningless devalues the review. So if any required check is `PENDING` (`QUEUED` / `IN_PROGRESS` / `WAITING`), **poll every `--ci-poll` seconds (default 30s) until every required check is `SUCCESS` or `FAILURE`, bounded by `--ci-timeout` (default 30 min)**. The reviewer sub-agent only runs once CI has settled (or the timeout is hit, in which case the review notes `CI still pending after <timeout>` explicitly). If `--no-wait-ci` is passed, skip the wait and capture whatever state CI is in. The skill **never fixes CI**, never re-runs workflows — that is `merge-train` / `fix-train`. CI state is surfaced in the review body as an observation that the reviewer can weigh (e.g. a `FAILURE` is a blocker the reviewer should reference; `SUCCESS` is reassurance).
- **Existing reviews/labels**: `gh pr view <number> --json reviewDecision,labels` — so we replace, not duplicate, our own prior `review-train` comment/label.
- **Size/risk**: additions/deletions, files touched, core-source vs docs/deps/config.

### Phase 3 — Dispatch the reviewer team (read-only, parallel)

Spawn one reviewer **sub-agent per PR** via the Agent tool, batched at `--concurrency` (default 4) — send the batch as parallel tool calls in one message, wait, then the next batch.

Each sub-agent prompt is self-contained and must include:

- The PR number, title, author, base/head, and URL.
- The full diff (or, for very large diffs, the file list + diff for the highest-risk files plus a note that the diff was truncated).
- The linked ticket text / stated expected behaviour if any.
- The CI status as read-only context.
- The **exact reference review structure** extracted in Phase 0 (paste the headings and the Why/Fix itemization rules).
- This instruction: *"Produce a five-axis review (correctness, readability, architecture, security, performance) scoped strictly to this diff. Match the provided reference structure and depth exactly. Be specific: cite `file:line`. Separate blocking issues from nits. End with an explicit verdict: `approved` or `changes-requested`. Output only the review body, ready to post as a PR comment."*
- This guardrail: *"Review only. Do not propose to fix CI, resolve conflicts, push, or merge. You have no write authority."*

Use a code-review-specialised subagent type if the environment provides one (e.g. `code-review`); otherwise `general-purpose`. Collect each agent's review body + parsed verdict.

A reviewer agent's summary describes intent, not ground truth — sanity-check each returned review against the diff (right PR, real file paths, verdict consistent with the issues listed) before trusting it.

### Phase 4 — Assemble verdicts (read-only)

For each PR derive:

- **verdict** = `approved` if the reviewer found no blocking issues, else `changes-requested`.
- The drafted comment body (reference-formatted), prefixed with a stable marker line so re-runs can find and update the prior comment instead of stacking duplicates, e.g. the first line: `<!-- review-train -->`.
- The label transition: add `approved` **or** `changes-requested`; remove the opposite if present. (Skip entirely under `--no-label`.)

Draft PRs (unless `--include-drafts`) get **no verdict** — reported as skipped.

### Phase 5 — Present the consolidated plan (the single confirmation gate)

Output one Markdown report (see Output Format). It must show every PR with: author, size, verdict, count of blocking issues vs nits, the label transition, and whether this would update an existing `review-train` comment or create a new one. Include the **full drafted review body** for each PR (collapsed/inline) so the user can audit before anything is posted.

Then ask **one** grouped confirmation:

> "Reviews ready: N PRs reviewed → A approved, C changes-requested, K drafts skipped. I will post one review comment per PR and apply the matching label (`approved` / `changes-requested`), removing the opposite. No CI fix, no conflict resolution, no merge — review only. Proceed with the full batch? (yes / dry-run / pick a subset)"

- `--dry-run` (or a dry-run answer) ⇒ stop here; write nothing.
- The user may approve a subset; respect it.
- Without an explicit "yes", **do nothing**.

### Phase 6 — Post (writes; only after confirmation)

For each in-scope, confirmed PR, in PR-number order:

1. **Comment**: if a prior `<!-- review-train -->` comment by the current user exists, update it (`gh api ... -X PATCH`); else create it (`gh pr comment <number> --repo <owner>/<repo> --body-file <tmp>`). Write the body via a temp file to preserve formatting; delete the temp file immediately after.
2. **Label** (unless `--no-label`):
   - Ensure the two labels exist; create any missing one:
     `gh label create approved --repo <owner>/<repo> --color 0E8A16 --description "review-train: approved"`
     `gh label create changes-requested --repo <owner>/<repo> --color D93F0B --description "review-train: changes requested"`
   - `gh pr edit <number> --repo <owner>/<repo> --add-label <verdict> --remove-label <opposite>`.
3. If a comment or label call fails, record the failure for that PR and continue with the rest — never abort the whole batch for one PR.

Never post a formal blocking GitHub *review* (`gh pr review --request-changes`) unless the user explicitly asks — the contract here is **comment + label**, which does not gate merges.

### Phase 7 — Final report

Summarize: per PR — verdict, comment URL (new vs updated), label applied, any post failures. List skipped drafts. Recommend next action for the `changes-requested` set. Explicitly restate that nothing was merged, fixed, or pushed.

## Canonical Review Format

Used when no reference comment is available. When a reference exists, **mirror the reference instead** — this is only the fallback.

```
<!-- review-train -->
**Review summary for <PR #/ticket>:**

**Expected behaviour**
- <bullets: what the ticket/PR description says should happen>

**What the diff delivers**
- `<path>` — <what this file's change does>
- ...

**Issues requiring changes**
1. `<path:line>` — **Why**: <concrete defect: correctness / security / contract violation, with the consequence>. **Fix**: <specific actionable fix>.
2. ...

**Nits (non-blocking)**
- `<path:line>` — <minor readability/style/perf note>

**Verdict**: Approved — no blocking issues.
   ─ or ─
**Verdict**: Changes requested — <one-line reason naming the hard blocker(s)>.
```

Rules: every blocking issue gets its own number, an explicit **Why** (with the consequence, not just "this is wrong") and a concrete **Fix**, and a `file:line` anchor. Nits are listed separately and never change the verdict. The verdict line is unambiguous and maps 1:1 to the label.

## Safety Rules

- **Review only.** Never fix CI, never resolve conflicts, never push, never merge, never close, never re-run workflows. If tempted, stop — that is `merge-train` / `fix-train`'s job, not this skill's. The CI-wait in Phase 2 is a *read-only* poll, not an attempt to influence CI.
- **Wait for CI to settle before reviewing** (bounded by `--ci-timeout`). A review produced while required checks are still `PENDING` is half-informed; poll until they reach a definitive state, then review. If the timeout is hit, review anyway and explicitly note that CI did not settle in time. Opt out only via `--no-wait-ci`.
- **One grouped confirmation** before any write. No write in `--dry-run`.
- The only writes permitted: one PR **comment** per PR and one **label** per PR (and creating the two label definitions if absent). Nothing else.
- Idempotent: update the prior `<!-- review-train -->` comment instead of stacking duplicates; flip the label instead of accumulating both.
- Never post a merge-blocking formal GitHub review unless explicitly asked.
- Never review a draft PR unless `--include-drafts`.
- Respect the URL's filter — never act on PRs outside the requested scope.
- Reviews must be grounded in the actual diff. Do not invent file paths or issues; if a sub-agent's review cites paths not in the diff, discard and re-review that PR.
- A `changes-requested` verdict must be justified by a real defect (correctness/security/contract). Style-only nits never produce `changes-requested`.

## Output Format

A single Markdown report:

```
## Review Train — <owner>/<repo> (<N> open PRs in scope)
Reference style: <reference comment URL | auto-detected | canonical fallback>
CI gate: wait for CI to settle before review · ci-timeout: <N>min · ci-poll: <N>s · wait-ci: <on|off>

### Verdict overview
#12  feat: X            → approved            (0 blockers · 2 nits)   label: +approved -changes-requested   comment: new
#15  refactor: Y        → changes-requested   (3 blockers · 1 nit)    label: +changes-requested -approved    comment: update
#18  wip: Z (draft)     → skipped             (draft)
...

### Drafted reviews
<for each PR: the full reference-formatted review body>

### Plan
Will comment + label: #12 (approved), #15 (changes-requested), ...
Skipped (draft): #18
No CI fix · no conflict resolution · no merge — review only.

> Proceed with the full batch? (yes / dry-run / subset)
```

After execution, append an **Execution result** section: per-PR comment URL (new/updated), label applied, failures, skipped drafts, and the recommended follow-up for the changes-requested set.
