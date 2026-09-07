# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**Agent Atelier** — a multi-plugin **Claude Code marketplace**, not an application. It curates Big Emotion's first-party skills, commands, and agents into six domain plugins under `plugins/`, distributed as the git repo itself (`/plugin marketplace add big-emotion/agent-atelier`; the marketplace name stays `big-emotion`, so installs are `<plugin>@big-emotion`). There is no build, no runtime, no deploy.

Almost everything here is Markdown. The only executable code is the two CI gates — `scripts/check-templates.mjs` and `scripts/check-manifests.mjs` — and their tests.

## Registry layout

| Plugin | Contents |
|---|---|
| `plugins/prompt-utils` | skills `expertify`, `thought`, `repo-scout` + command `interview` |
| `plugins/project-standard` | the `setup` skill: the seven-module Big Emotion project standard (M1–M7) with runbooks and templates |
| `plugins/pr-trains` | skills `review-train`, `fix-train`, `fix-ci-train`, `merge-train`, `issue-train` |
| `plugins/frontend-fidelity` | skills `reverse-ui`, `blueprint`, `validate-fidelity` |
| `plugins/code-quality` | skill `ai-code-tells`, agent `code-review` (+ `codex/code-review.toml`, the Codex CLI variant) |
| `plugins/agent-comms` | skills `attention-architect`, `video-director`, `audience-audit`, `content-strategist` |

Every plugin is generic by construction: no client names, no infrastructure coordinates, no secrets. New material must arrive already de-branded.

## Commands

```bash
npm test                              # node:test suite over scripts/*.test.mjs
npm run check:templates               # placeholder-registry gate (see below)
npm run check:manifests               # marketplace/plugin/version lockstep gate

# single test
node --test --test-name-pattern "ignores GitHub Actions expressions" scripts/check-templates.test.mjs

# checkers against an arbitrary root (argv[2])
node scripts/check-templates.mjs /path/to/templates
node scripts/check-manifests.mjs /path/to/repo
```

Node ≥ 20, zero runtime dependencies (devDeps are husky/commitlint/lint-staged only). Those three commands are the repo's entire quality surface locally; CI adds gitleaks.

## Architecture

**Module system (project-standard plugin).** The standard is seven independently adoptable modules (M1 CI · M2 Husky hooks · M3 project skills · M4 Atlassian wiring · M5 Ferry · M6 branch/release model · M7 infra & secrets). Each module has exactly three surfaces, and they must stay in lockstep:

- `plugins/project-standard/skills/setup/references/m<N>-*.md` — the install/adaptation runbook the skill follows
- `plugins/project-standard/skills/setup/templates/m<N>-*/` — the files it renders onto a target repo
- `SPEC.md` §2 — the rationale and decisions behind the module

`plugins/project-standard/skills/setup/SKILL.md` is deliberately small: it holds the five-step flow (interview → read-only gap analysis → plan + one confirmation → install in order M6→M1→M2→M4→M3→M5→M7 → verify) and delegates all detail to the reference docs. Paths inside it resolve via `${CLAUDE_PLUGIN_ROOT}`, so the plugin's own files never hardcode the repo layout.

**Placeholder registry.** `plugins/project-standard/skills/setup/templates/params.json` is the authoritative list of every `{{placeholder}}` a template may use; the setup skill's interview is derived from it. `scripts/check-templates.mjs` walks the whole template tree and fails on any placeholder not declared there. The matching shape is `^[a-z][a-z0-9_]*$` preceded by no `$` — this is what excludes GitHub Actions expressions (`${{ github.ref }}`) and Jira smart values (`{{issue.key}}`). Adding a placeholder to a template without registering it breaks CI.

**PROJECT-SPECIFIC markers.** Templates carry `# PROJECT-SPECIFIC:` / `<!-- PROJECT-SPECIFIC: -->` blocks marking where the consuming project supplies its own content. They are install-time instructions, not dead comments — never strip them from a template, and per M3's rules a rendered file that still contains one is an install failure.

**Dogfooding.** This repo applies its own standard to itself: `.github/workflows/ci.yml` and the Husky config are adapted M1/M2, and `.claude/skills/project-standard-{release,audit,spec,ticket,bootstrap-confluence}/` are the M3 templates rendered with `project_slug = project-standard`. When you change a `templates/m3-skills/*.SKILL.md`, consider whether the rendered copy under `.claude/skills/` should follow — they drift silently otherwise.

**Version sync.** All versions move in lockstep: `package.json` `.version`, every `plugins/*/.claude-plugin/plugin.json` `.version`, and every entry in `.claude-plugin/marketplace.json` `.plugins[]` must be identical. `npm run check:manifests` enforces it in CI, and `/project-standard-release` refuses to run on drift. One CHANGELOG, one release cadence for the whole atelier.

**Branch model.** This repo runs single-branch: `main` is both integration and release branch — a deliberate M6 adaptation for a tooling repo with no deploy. Do not "fix" this by adding `develop`. Releases are annotated `v*` tags; the tag triggers no workflow, the GitHub Release is created by the release skill.

## Hard rules

**This repo is public — no secret values and no coordinates.** It documents secret *names*, locations, and acquisition steps only; values live in GitHub secrets, VPS `.env` files, and provider portals. The gitleaks CI job catches accidental value pastes, but it will **not** catch the other half of the rule: real infrastructure coordinates — hostnames, IPs, SSH ports, account handles, cloud resource names — and client or consumer-repo identities must never be committed either, even though they are not secrets. Reference implementations are named by role ("the website repo", "the support-agent repo"). Operators supply coordinates at interview time from private notes outside this repo. See SPEC.md **D9**.

**English only** in every written artifact — docs, comments, commit messages, templates. (User-facing trigger phrases inside skill frontmatter may stay French.)

**Conventional Commits**, enforced by commitlint with the type whitelist in `commitlint.config.mjs`; `release` is the type for version-cutting commits.

## Project skills

- `/project-standard-release` — bump every manifest in lockstep, update CHANGELOG (Keep a Changelog), tag, push after explicit confirmation
- `/project-standard-audit` — read-only production-readiness score → `docs/PRODUCTION-READINESS-AUDIT.md`
- `/project-standard-spec` — Confluence REQ/DEC/ARCH maintainer + Jira drafts (dormant until M4 is wired for this repo)
- `/project-standard-ticket` — full-auto single-Jira-ticket lifecycle (dormant, same reason)
- `/project-standard-bootstrap-confluence` — one-shot spec-tree creation; refuses a second run
