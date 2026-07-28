# Big Emotion Project Standard

> Install, audit, and verify the seven-module Big Emotion project standard — CI quality gates, Husky hooks, five generated project skills, Jira/Confluence spec wiring, Ferry agent automation, a two-branch tag-release model, and deploy infrastructure — on any repo.

Part of [Agent Atelier](../../README.md). Install:

```
/plugin marketplace add big-emotion/agent-atelier
/plugin install project-standard@big-emotion
```

## How the tools compose

The plugin ships one entry point, /project-standard:setup, which runs interview → read-only gap analysis → one confirmed plan → module installs in dependency order M6 (branch model) → M1 (CI) → M2 (hooks) → M4 (Atlassian) → M3 (project skills) → M5 (Ferry) → M7 (infra) → verification. Nothing is written before the single confirmation, and installs are idempotent (compliant repos are reported, drift is flagged, never silently overwritten). The five skills M3 generates then compose as a per-repo lifecycle: <slug>-bootstrap-confluence runs once and writes the lock sentinel → <slug>-spec drafts gated Pending REQ/DEC/ARCH sections plus Jira tickets → <slug>-ticket implements one ticket full-auto up to a PR → <slug>-release ships from the default branch by confirmed annotated tag (the tag push triggers the deploy workflow) → <slug>-audit scores the whole repo read-only at any point.

## Tools

### `setup` — skill

Installs the seven-module project standard (M1 CI gates with gitleaks, M2 Husky hooks, M3 five slug-prefixed project skills, M4 Jira board + Confluence spec tree wiring, M5 Ferry router automation, M6 two-branch tag-release model, M7 VPS/Azure deploy + M365 mail + secrets doctrine) on a new or existing repo, or audits one against it. Steps 1–3 (interview, gap analysis, plan) are strictly read-only; a single explicit confirmation covers the whole install, which then renders {{param}} templates module by module in dependency order, surfaces PROJECT-SPECIFIC markers instead of deleting them, and finishes with per-module verification (hook smoke commit, ferry-doctor, dry skill runs). It documents secret names and where each value lives but never writes, echoes, or stores a secret value, and never overwrites a project's customization without flagging it as drift first.

**Use it when:**

- Starting a new repo that should carry the full standard (default: all seven modules)
- Running a compliance check / gap analysis on an existing repo ("is this repo up to standard?") — read-only, one missing/present/drifted table
- Adding a single module, e.g. wiring Ferry (M5) onto a repo that already has CI, or setting up the VPS deploy + secrets layout (M7)
- Installing the five project skills (<slug>-release/audit/spec/ticket/bootstrap-confluence) rendered with the repo's own slug and coordinates
- Guided setup of the Jira pipeline board, the dedicated ferry Jira user, and the Confluence spec-tree config (M4)

**Don't use it for:**

- Day-to-day lifecycle work — cutting a release, drafting specs, implementing a ticket, auditing: those belong to the generated <slug>-* skills, not to setup
- Migrating a legacy Ferry install (five per-role workflows) — setup flags it as drift but migration is explicitly out of scope
- Expecting Jira projects or boards to be created automatically — the Atlassian MCP cannot create them; setup only guides the manual UI steps and verifies them afterwards

**Example:**

```
/project-standard:setup gap analysis — is this repo up to standard?
```

**Requirements:** gh CLI authenticated on the target repo; Atlassian MCP for M4 id discovery and verification (degrades to fully manual guidance without it); Node >= 20 and npx @big-emotion/ferry for M5 (ferry-init, ferry-doctor); a Claude Pro/Max subscription token via `claude setup-token` for the CLAUDE_CODE_OAUTH_TOKEN secret; repo/org admin rights for secrets and branch protection (otherwise setup emits the exact gh commands for someone who has them).

### `<slug>-release (template: m3-skills/release.SKILL.md)` — skill template installed by setup

Prepares a production release locally: bumps the root package.json semver, updates CHANGELOG.md in Keep a Changelog format (creating it if missing), commits `release: vX.Y.Z`, and creates an annotated tag — only after verifying clean tree, default branch, up-to-date with origin, and CI green on HEAD. It pushes branch then tag only after an explicit affirmative token (yes/push/go/oui/ok); anything else, including silence, keeps everything local. The tag push triggers the project's deploy workflow; a failed branch push stops the tag push.

**Use it when:**

- Cutting a release / "bump version" / "tag a new version" from the default branch
- Shipping the integration branch after it has been promoted onto the default branch
- You want changelog grouping by Conventional Commit type and a bump proposal derived from commits since the last tag

**Don't use it for:**

- CI is red, the tree is dirty, or you are behind origin — the skill refuses by design; fix the blocker instead of forcing
- Deploy mechanics or GitHub Release creation — those belong to the deploy workflow the tag triggers
- Scoring release readiness — that is /<slug>-audit

**Example:**

```
/acme-app-release patch
```

**Requirements:** git; gh CLI authenticated against the repo (the CI-green precondition reads `gh run list`); the M1 ci.yml workflow present so a run exists for HEAD.

### `<slug>-audit (template: m3-skills/audit.SKILL.md)` — skill template installed by setup

Read-only, scored production-readiness audit: snapshots the repo, runs the project's own quality gates, gathers cheap evidence commands (leaked-secret greps, unpinned-action greps, Ferry divergence markers), scores 6 generic domains plus project-specific ones added at install (8–10 total, equal weight), and answers four canonical questions. The only file it ever changes is docs/PRODUCTION-READINESS-AUDIT.md, updated in place. `--quick` skips long/costly gates and scores from the latest CI run, marking stale-data domains as such; unrunnable checks are marked N/A, never invented.

**Use it when:**

- "Is the project production-ready?" / "score the project" before a go-live or stakeholder review
- Checking security posture, secrets hygiene, or compliance surface specifically
- A periodic health pass after significant merges, to see what drifted from the standard

**Don't use it for:**

- Fixing anything it finds — the audit only reports; remediation goes through ticketed work or the release flow
- Live end-to-end measurement (Lighthouse-style runs, live API probes) — domains score on configuration and recorded evidence only
- Auditing neighbouring systems owned by other repos — explicitly out of scope

**Example:**

```
/acme-app-audit --quick
```

**Requirements:** The repo's own toolchain to run its gates (full mode); gh CLI best-effort for CI history; no MCP servers; no credentials — credential-gated live checks are marked N/A when absent.

### `<slug>-spec (template: m3-skills/spec.SKILL.md)` — skill template installed by setup

Turns a free-text problem (bug, feature idea, architectural concern) into Pending REQ/DEC/ARCH draft sections on Confluence plus matching Jira tickets, choosing the Jira granularity (Epic+Stories / Story / Task-Bug / no ticket) from the shape of the Confluence change. Steps 1–5 are pure reads (dedupe via CQL/JQL, impact propagation up the ARCH → DEC → REQ graph); a hard preview gate requires an explicit token before anything is written. Writes are append-only, Pending-only, Confluence first then Jira, then the bidirectional link is closed — it never edits non-Pending sections, never flips Status macros, never touches existing tickets.

**Use it when:**

- A bug suggests a requirement is wrong or missing and the spec tree must record it
- "We should add …" / "j'aimerais ajouter …" — a feature idea that needs REQ/DEC/ARCH drafting before implementation
- An architecture change needs a recorded decision with alternatives and tradeoffs
- You want Jira tickets whose Confluence-impact section (NEW/EDIT/RETIRE) is machine-parseable and linked both ways

**Don't use it for:**

- You already have a ticket key/URL to implement — that path belongs to /<slug>-ticket
- Flipping a section's status (Pending → Implemented) — humans only, via the Confluence UI; the skill refuses
- Bootstrapping or repopulating the spec tree — that is the one-shot /<slug>-bootstrap-confluence

**Example:**

```
/acme-app-spec the contact form silently drops attachments over 5 MB
```

**Requirements:** Atlassian MCP (Confluence + Jira reads, updateConfluencePage, createJiraIssue); a bootstrapped tree — docs/.confluence-bootstrap-complete sentinel, complete docs/confluence-spec/config.json, and docs/templates/jira-ticket-template.md.

### `<slug>-ticket (template: m3-skills/ticket.SKILL.md)` — skill template installed by setup

Full-auto local implementation of one Jira ticket, the on-demand counterpart to Ferry: self-assigns, refines the ticket with a visible Jira comment, creates ordered sub-tasks, cuts an isolated git worktree off the remote integration branch (the user's checkout is never touched), implements via parallel sub-agents with TDD, runs the project's quality gates, pushes, opens the PR, then transitions the ticket to the review column and comments the PR link. No confirmation gates, but hard safety blockers (ambiguous key, missing ferry.config.json, failing gates) stop it rather than force through — it never opens a knowingly-broken PR, never uses --no-verify. Base branch, PR target, and review column are read from ferry.config.json at runtime, never hardcoded; the ferry/ branch namespace is left to Ferry.

**Use it when:**

- You paste a Jira ticket URL or key and want it taken end-to-end locally ("prends ce ticket")
- Implementing a Story that /<slug>-spec just created
- You want branch, sub-tasks, PR, and the Jira transition handled unattended on your machine instead of waiting on the cloud pipeline

**Don't use it for:**

- There is no ticket yet — draft one with /<slug>-spec first
- You want the async cloud pipeline — assign the dedicated ferry user in Jira and let Ferry run the same lifecycle
- Batch work — the skill processes exactly one ticket per invocation

**Example:**

```
/acme-app-ticket https://your-org.atlassian.net/browse/ACME-123
```

**Requirements:** Atlassian MCP; gh CLI authenticated on the repo; ferry.config.json present and parseable at the repo root; git with worktree support.

### `<slug>-bootstrap-confluence (template: m3-skills/bootstrap-confluence.SKILL.md)` — skill template installed by setup

One-shot creation of the four-page Confluence spec tree (Requirements / Decisions / Architecture / Obsolete) as empty skeletons under the configured engineering root page, gated on the user typing the exact case-sensitive phrase `bootstrap publish approved`. On success it writes the four page ids back into docs/confluence-spec/config.json, writes the docs/.confluence-bootstrap-complete sentinel, and commits both on a dedicated bootstrap branch without pushing. While the sentinel exists every future invocation aborts in Phase 0 — the skill is create-only (never updates or deletes a page) and never touches Jira.

**Use it when:**

- Initializing the spec system on a new project, right after M4 placed config.json with the root page id
- Re-initializing a tree deliberately after the old ids were cleared from config.json (and no sentinel exists)

**Don't use it for:**

- Any ongoing spec maintenance — adding or editing REQ/DEC/ARCH is /<slug>-spec territory
- The sentinel already exists — the skill refuses by contract; deleting the sentinel manually is a deliberate act with consequences
- Bulk-migrating existing docs into the tree — each goes through /<slug>-spec as a reviewed draft

**Example:**

```
/acme-app-bootstrap-confluence
```

**Requirements:** Atlassian MCP (getAccessibleAtlassianResources, getConfluencePage, getConfluencePageDescendants, getConfluenceSpaces, createConfluencePage); docs/confluence-spec/config.json with non-null cloudId, siteUrl, spaceKey, and engineeringRootPageId; a clean git working tree.
