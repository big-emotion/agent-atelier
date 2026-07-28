# Agent Atelier

> The Claude Code skills, commands, and agents Big Emotion uses every day — made generic and open-sourced.

[![CI](https://github.com/big-emotion/agent-atelier/actions/workflows/ci.yml/badge.svg)](https://github.com/big-emotion/agent-atelier/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Install

```
/plugin marketplace add big-emotion/agent-atelier
/plugin install prompt-utils@big-emotion        # then pick the other plugins you want
```

> ⚠️ These plugins drive real tools with your credentials (`gh`, your repo, your Jira). Read a skill before running it.

## Where things live

```
plugins/<plugin>/
├── README.md            ← the plugin's guide: use it when / don't use it for, requirements
├── skills/
│   ├── README.md        ← synthesis of the skills, with a prompt → result example for each
│   └── <skill>/SKILL.md ← the skill itself
└── commands/  agents/  codex/
    └── README.md        ← same synthesis for commands, agents, Codex variants
```

## The plugins

### [prompt-utils](plugins/prompt-utils/README.md) — sharpen what you ask before you ask it

`expertify` and `interview` are the most-used tools in the atelier.

- [`expertify`](plugins/prompt-utils/skills/expertify/SKILL.md) — Finds the professional role behind a rough prompt, maps lay wording to field terminology, and rewrites it expert-grade.
- [`interview`](plugins/prompt-utils/commands/interview.md) — Makes Claude interview you — probing questions, challenged assumptions — until 95% confident before proposing any plan.
- [`thought`](plugins/prompt-utils/skills/thought/SKILL.md) — Captures a surprising answer as a dated note in ~/thoughts/, updates the TLDR index, then resumes the conversation.
- [`repo-scout`](plugins/prompt-utils/skills/repo-scout/SKILL.md) — Shallow-clones a GitHub repo, reads its key files, and reports what it does, what's worth stealing, and how to use it.

Use cases (prompt → result): [commands/](plugins/prompt-utils/commands/README.md) · [skills/](plugins/prompt-utils/skills/README.md)

### [project-standard](plugins/project-standard/README.md) — the Jira/Confluence delivery pipeline

One `setup` skill installs the seven-module standard — CI gates, hooks, the five project skills (`spec`, `ticket`, `release`, `audit`, `bootstrap-confluence`), Jira/Confluence wiring, Ferry automation.

- [`setup`](plugins/project-standard/skills/setup/SKILL.md) — Install or audit the 7-module Big Emotion standard on a repo: CI gates, hooks, skills, Atlassian, Ferry, release, infra.

Use cases (prompt → result): [skills/](plugins/project-standard/skills/README.md)

### [pr-trains](plugins/pr-trains/README.md) — batch-process whole GitHub queues

Parallel sub-agents over every open PR or issue — one consolidated plan, one confirmation.

- [`review-train`](plugins/pr-trains/skills/review-train/SKILL.md) — Posts one structured five-axis review comment per open PR and applies an approved/changes-requested label — review only.
- [`fix-train`](plugins/pr-trains/skills/fix-train/SKILL.md) — Applies reviewer-requested changes on every open PR via parallel worktree fixers, pushes, waits for green CI, relabels.
- [`fix-ci-train`](plugins/pr-trains/skills/fix-ci-train/SKILL.md) — Makes CI green on every open PR with red required checks: parallel worktree fixers push minimal fixes, poll until green.
- [`merge-train`](plugins/pr-trains/skills/merge-train/SKILL.md) — Orders open PRs by dependency, fixes CI and conflicts, reviews each, then merges the mergeable ones in safe order.
- [`issue-train`](plugins/pr-trains/skills/issue-train/SKILL.md) — Triages every open issue — closes stale or already-fixed ones, opens one PR per actionable issue with Closes #n linkage.

Use cases (prompt → result): [skills/](plugins/pr-trains/skills/README.md)

### [frontend-fidelity](plugins/frontend-fidelity/README.md) — reproduce any UI pixel-perfect, and prove you did

One oracle, three stages: extract ground truth, spec the codebase, validate the result.

- [`reverse-ui`](plugins/frontend-fidelity/skills/reverse-ui/SKILL.md) — Drives agent-browser over a live site to extract tokens, DOM, SVGs, assets, and responsive screenshots into a repro kit.
- [`blueprint`](plugins/frontend-fidelity/skills/blueprint/SKILL.md) — Extracts a specs/ directory of flat markdown specs (12 axes) from a frontend codebase, for rebuild or migration.
- [`validate-fidelity`](plugins/frontend-fidelity/skills/validate-fidelity/SKILL.md) — Checks a spec or running app against the reverse-ui oracle JSON/screenshots and reports pass/warn/fail drift per REQ.

Use cases (prompt → result): [skills/](plugins/frontend-fidelity/skills/README.md)

### [code-quality](plugins/code-quality/README.md) — review before you push

The `code-review` agent ships a Codex CLI variant.

- [`ai-code-tells`](plugins/code-quality/skills/ai-code-tells/SKILL.md) — Read-only diff scan for the five tells of unreviewed AI code; reports each finding as file:line, why, and a concrete fix.
- [`code-review`](plugins/code-quality/agents/code-review.md) — Pre-push review of local diffs (staged or recent commits) for bugs, edge cases, error handling, type safety, readability.
- [`code-review (Codex port)`](plugins/code-quality/codex/code-review.toml) — Same pre-push diff-review agent packaged for the Codex CLI; identical process and report, but reads AGENTS.md, not CLAUDE.md.

Use cases (prompt → result): [agents/](plugins/code-quality/agents/README.md) · [codex/](plugins/code-quality/codex/README.md) · [skills/](plugins/code-quality/skills/README.md)

## Development

`npm test` · `npm run check:templates` · `npm run check:manifests` — all enforced in CI alongside a gitleaks secret scan. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
