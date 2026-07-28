# Agent Atelier

> **Big Emotion's workshop of Claude Code plugins — the skills, commands, and agents we use every day, made generic and open-sourced.**

[![CI](https://github.com/big-emotion/agent-atelier/actions/workflows/ci.yml/badge.svg)](https://github.com/big-emotion/agent-atelier/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

```
/plugin marketplace add big-emotion/agent-atelier
        │
        ▼
/plugin install prompt-utils@big-emotion      ──▶  /prompt-utils:expertify <your rough prompt>
/plugin install pr-trains@big-emotion         ──▶  /pr-trains:review-train <PRs URL>
```

Agent Atelier is a curated, multi-plugin Claude Code marketplace: five plugins, one per domain of daily agent-assisted work — prompt crafting, project delivery, PR-queue operations, frontend fidelity, and code quality. Every tool was distilled from live production use before being de-branded, so it works on any repo, for anyone.

---

## What Agent Atelier is — and isn't

**Agent Atelier is:**

- A **plugin marketplace**: add it once, install only the domains you actually need
- **First-party and battle-tested**: every skill, command, and agent here was authored by Big Emotion and used daily on live production repos before being genericized
- **Self-contained**: dependency-free and almost entirely Markdown; the only executables are two CI gate scripts and the extraction scripts inside `reverse-ui`

**Agent Atelier is not:**

- An awesome-list of third-party skills — nothing here is vendored or re-published
- A framework — each tool stands alone; there is no shared runtime, and plugins install independently

---

## The plugins at a glance

Not every tool is useful to everyone — that is the point of the folder-per-domain layout. Pick the domains that match your work; each folder's README tells you precisely when to reach for each tool and when not to.

| Plugin | Contents | Use it to… |
|---|---|---|
| [**prompt-utils**](plugins/prompt-utils/) | `expertify` · `interview` · `thought` · `repo-scout` | Sharpen what you ask before you ask it |
| [**project-standard**](plugins/project-standard/) | `setup` (modules M1–M7) | Install a complete delivery standard — CI gates, hooks, project skills, Jira/Confluence wiring, agent automation — on any repo |
| [**pr-trains**](plugins/pr-trains/) | `review-train` · `fix-train` · `fix-ci-train` · `merge-train` · `issue-train` | Batch-process whole GitHub PR/issue queues with parallel sub-agents |
| [**frontend-fidelity**](plugins/frontend-fidelity/) | `reverse-ui` · `blueprint` · `validate-fidelity` | Reproduce any UI pixel-perfect — and prove you did |
| [**code-quality**](plugins/code-quality/) | `ai-code-tells` · `code-review` agent | Catch the tells of unreviewed AI code and review diffs before they ship |

---

## How it works

```
agent-atelier/
├── .claude-plugin/marketplace.json     ← the marketplace: lists the five plugins
├── plugins/
│   ├── prompt-utils/                   ← one folder = one domain = one installable plugin
│   │   ├── .claude-plugin/plugin.json
│   │   ├── README.md                   ← use cases: when to use each tool, when not to
│   │   ├── skills/…                    ← Claude Code skills (SKILL.md each)
│   │   └── commands/…                  ← slash commands
│   ├── project-standard/
│   ├── pr-trains/
│   ├── frontend-fidelity/
│   └── code-quality/                   ← also ships agents/ and a Codex CLI variant
└── scripts/                            ← the two CI gates (template + manifest checks)
```

Two invariants hold everywhere: tools that write (to your repo, your GitHub, your Jira) present a plan and ask **one explicit confirmation** before acting, and all plugin versions move **in lockstep** with the repo version (CI-enforced).

---

> ⚠️ **These plugins drive real tools with your credentials.** `pr-trains` pushes branches and posts comments via your `gh` CLI; `project-standard:setup` writes files onto your repo (after one confirmation); the Atlassian-facing skills create Jira issues and Confluence pages through your MCP connection. Nothing phones home and no data leaves your machine beyond the tools you invoke — but read a skill before running it, like any code you execute.

---

## Requirements

- Claude Code with plugin support
- `gh` CLI, authenticated — for `pr-trains` and `repo-scout`
- An Atlassian MCP connection — only for `project-standard`'s Jira/Confluence modules
- Setup time: under a minute

---

## Setup — 2 steps to your first expert prompt

### Step 1 — Add the marketplace

```
/plugin marketplace add big-emotion/agent-atelier
```

### Step 2 — Install the plugins you want

```
/plugin install prompt-utils@big-emotion
/plugin install project-standard@big-emotion
/plugin install pr-trains@big-emotion
/plugin install frontend-fidelity@big-emotion
/plugin install code-quality@big-emotion
```

Codex CLI users: the `code-review` agent ships a Codex variant — `cp plugins/code-quality/codex/code-review.toml ~/.codex/agents/`.

---

## Development

```bash
npm test                  # node:test suite
npm run check:templates   # every {{placeholder}} declared in params.json
npm run check:manifests   # marketplace ↔ plugins ↔ versions in lockstep
```

CI runs all three plus a gitleaks secret scan on every PR. English-only docs, Conventional Commits.

See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute.

---

## Contributors

| Role | GitHub |
|---|---|
| Creator & maintainer | [@jean-noe](https://github.com/jean-noe) |

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=big-emotion/agent-atelier&type=date)](https://star-history.com/#big-emotion/agent-atelier&Date)

---

## License

MIT
