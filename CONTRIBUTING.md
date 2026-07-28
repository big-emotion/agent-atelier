# Contributing to Agent Atelier

Thanks for wanting to sharpen the tools. A few rules keep this atelier usable by everyone.

## What belongs here

- **First-party work only.** Original skills, commands, or agents — not re-publications of third-party material.
- **Production-proven.** A tool enters the atelier after it has actually been used on real work, not as a speculative idea.
- **Generic by construction.** No client names, no infrastructure coordinates (hostnames, IPs, account handles, resource names), no Jira project keys, no personal paths, no secrets. If a tool only makes sense inside one company's setup, genericize it first or keep it private.
- **One plugin per domain.** Add a new tool to the existing domain plugin it belongs to (`prompt-utils`, `project-standard`, `pr-trains`, `frontend-fidelity`, `code-quality`). Propose a new plugin only for a genuinely new domain.

## Tool shape

- Skills: `plugins/<plugin>/skills/<name>/SKILL.md` with `name` and `description` frontmatter; supporting material in `references/` and `scripts/` next to it.
- Commands: `plugins/<plugin>/commands/<name>.md` (frontmatter `description`, body is the prompt; `$ARGUMENTS` receives the user's input).
- Agents: `plugins/<plugin>/agents/<name>.md`; a Codex CLI variant, when provided, goes in `plugins/<plugin>/codex/`.
- Every plugin folder carries a `README.md` explaining, per tool, when to use it and when not to. A new tool means a new entry there.

## Quality gates

All three must pass locally before you open a PR (CI runs them plus a gitleaks secret scan):

```bash
npm test
npm run check:templates
npm run check:manifests
```

- **English only** in docs, comments, and commit messages (French trigger phrases inside skill frontmatter descriptions are fine).
- **Conventional Commits**, enforced by commitlint.
- **Versions move in lockstep**: `package.json`, every `plugins/*/.claude-plugin/plugin.json`, and every marketplace entry carry the same version, bumped together at release time — never in a feature PR.

## Flow

Single-branch model: open your PR against `main`. Releases are annotated `v*` tags cut by the maintainer; one CHANGELOG (Keep a Changelog) covers the whole atelier.
