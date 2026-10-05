# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **agent-comms** studio: guide-mode answers were refused when the model drifted from the exact header ("Il manque le fichier cards.json" although the block was there). `parseGuideAnswer` now accepts the common header variants (`### x`, `**x**`, `File: x`, `Fichier : x`, `x:`, `--- x ---`, a path prefix, any case), an optional end marker, a fence around the content and trailing chat prose; it assigns an unlabeled or mis-named JSON block to the single deliverable it structurally fits and reports it in a new `assumptions` list (`recognised-by-content`). Loose headers count only for the step's own deliverable names, JSON is never repaired (comments and trailing commas give `invalid-json` with line and column), and the result stays `{ files, problems }` plus `assumptions`. New exported `normaliseAnswerHeader`; `renderGuidePrompt` shortens the answer-format instruction and shows the exact block once.
- **agent-comms** studio: a model writing for a French profile translated the section headings (`## Promesse`) and the validator rejected the file with an English message. Every `SKILL.md`, `studio.md` and the guide-mode prompt now say that headings are fixed identifiers copied exactly from the templates; the validators accept the French names as equal through one tested table (`HEADING_ALIASES`), case, accent and trailing-space tolerant, with the promise-is-one-sentence check applied through the alias; every missing-section message names the expected heading, both spellings and the rule, with a French sentence. New accepted and rejected idea fixtures.

### Added

- **agent-comms** studio: the `idea` step becomes interactive in two AI turns with the editor's real choice in between. Turn `propose` writes `proposals.json` (1 to 3 storylines, each with one of the ten narrative patterns, what it cannot claim and a success criterion bounded by the evidence, exactly one recommended) and `proposals.md`; turn `plan` follows the choice (and the editor's note) and writes `idea.md` and `idea.json` extended with `chosen`, a 4 to 9 step `plan` whose sources all appear in the report, and `beforeWriting`. `renderGuidePrompt`, `loadPack`, `validateStep`, `deliverablesFor` and `resolveStep` are turn-aware (a call without a turn is the one-shot step, unchanged); `studio.md` holds one contract per turn; `skills/idea/SKILL.md` is restructured around the two turns; the `structure-*` packs read `idea.json.plan` as the skeleton when present. New `renderResearchPrompt` builds the prompt an editor pastes into a research assistant (claims oldest to newest, read versus not read, what was not found, competing readings). New `validateProposals*` validators, friendly French-tail messages, `proposals.schema.json`, an extended `idea.schema.json`, and turn fixtures for both profiles.
- **agent-comms** studio packs: `idea` and `structure-carousel` skills (generic, de-branded, each with a `studio.md` contract and a `derived-from.json` recording the source path and sha256), the `images.json` and `citations.json` formats and `cards.schema.json`, dependency-free validators for every deliverable, `render-guide-prompt.mjs` and `parse-guide-answer.mjs` for guide mode, `scripts/forbidden-terms.mjs` with two profile fixtures, `structure-image` and `structure-reel` packs (single image with alt text; reel with an engine-neutral `scenes.json` render contract and a narration check), format-aware `validateStep`, `renderGuidePrompt` and answer parsing, image and reel fixtures for both profiles, and a studio contract plus `ideas.json` for `audience-audit` and `content-strategist`. Deliverables stay clean: every contract and the guide-mode prompt tell the model to ignore the session's personal preferences and never to mention the contract, and the validators reject meta-commentary (contract, validator, preference, instruction, prompt, tiret) in `## Choix faits pour toi`. Manual API and guide acceptance runs are a checklist in `plugins/agent-comms/studio/README.md`.
- **agent-comms** plugin: `attention-architect` (turn a subject into an approvable narrated script and name the mechanism behind every beat, plus a pattern ledger with an intake protocol), `video-director` (the span between an approved script and a publishable file — format spec, sourcing discipline, the traps that have already cost a session, packaging), `audience-audit` (cross privacy analytics with the site's own URL inventory into one dated report of per-page verdicts), `content-strategist` (decide what ships next and where, with the comparable's numbers attached). The attention doctrine is derived from measured productions rather than from a marketing manual; the plugin carries no SEO skill and says so.

## [0.2.0] - 2026-07-28

### Changed

- The repo becomes **Agent Atelier** (`big-emotion/agent-atelier`, renamed from `project-standard`): a multi-plugin Claude Code marketplace curating Big Emotion's first-party skills, commands, and agents, grouped by domain. The `big-emotion` marketplace now lists five plugins; installs of the existing plugin (`project-standard@big-emotion`) keep working — GitHub redirects the old repo URL.
- The project-standard plugin moved unchanged from the repo root to `plugins/project-standard/` (its internal paths resolve via `${CLAUDE_PLUGIN_ROOT}` and needed no edits).
- CI's inline manifest JSON-parse check is replaced by the `check:manifests` gate.

### Added

- **prompt-utils** plugin: `expertify` (rewrite a lay prompt with the precise professional role and the field's terminology), `interview` (interview the user until their real intent is clear), `thought` (capture surprising model answers as durable notes), `repo-scout` (break down any GitHub repo into reusable parts).
- **pr-trains** plugin: `review-train`, `fix-train`, `fix-ci-train`, `merge-train`, `issue-train` — batch operators over GitHub PR/issue queues with parallel sub-agents and one grouped confirmation.
- **frontend-fidelity** plugin: `reverse-ui`, `blueprint`, `validate-fidelity` — extract a pixel-perfect reproduction kit from any web app, spec it, and catch fidelity drift.
- **code-quality** plugin: the `ai-code-tells` skill (scan a diff for the tells of unreviewed AI-generated code) and the `code-review` pre-push agent, including its Codex CLI variant (`codex/code-review.toml`).
- `scripts/check-manifests.mjs` (+ tests): CI gate enforcing that every plugin is listed in the marketplace, names match directories, and all versions move in lockstep with `package.json`.
- `CONTRIBUTING.md`.

## [0.1.1] - 2026-07-21

### Added

- MIT `LICENSE`, declared in `package.json` — the repo was public and installable as a plugin but carried no licence, so nobody could legally reuse it. Matches Ferry, the other public Big Emotion tool. (#3)

### Security

- Removed every infrastructure coordinate and client identity from the repo **and from its published git history**: VPS host/IP/SSH port, provider account handle, cloud resource and OIDC identity names, sending mailbox, both reference-repo slugs, and the Jira project key. The repo is public, so this material — though it contained no secret values — was readable by anyone. Verified with gitleaks over the full history plus per-pattern sweeps across every commit.

### Removed

- `skills/setup/references/m7-bigemotion-internal.md`, the single internal coordinates file. Operators now supply M7 coordinates at interview time from a private source outside this repo; the setup skill ships no defaults for them.

### Changed

- **SPEC `D9` supersedes `D7`**: the "hybrid coordinates model" (parameterized module + one isolated internal file) is replaced by a no-coordinates model. A coordinate committed here is a leak even when it is not a secret.
- The two reference implementations are named by role — "the website repo", "the support-agent repo" — instead of by org/repo slug, keeping every runbook's technical substance intact.
- The audit skill's "M7 isolation" check became a shape-based coordinates sweep: it now looks for coordinates *anywhere* in the tree rather than confirming they sit in one file.
- `templates/params.json` examples no longer carry a real Atlassian tenant, Jira key or sending domain.

## [0.1.0] - 2026-07-19

### Added

- The seven-module Big Emotion project standard, codified in `SPEC.md`: M1 CI quality gates, M2 Husky hooks, M3 project skills, M4 Atlassian wiring, M5 Ferry (router model), M6 branch & release model, M7 infrastructure & secrets (OVH VPS target, Azure variant, M365 mail, secrets doctrine with the hybrid coordinates model).
- The `/project-standard:setup` skill: interview → gap analysis → confirmed per-module install → verification, with per-module reference runbooks and fully parameterized templates (`{{placeholder}}` registry in `templates/params.json`, enforced by `scripts/check-templates.mjs`).
- Claude Code plugin packaging: the repo is its own marketplace (`big-emotion`), installable via `/plugin marketplace add big-emotion/project-standard`.
- Dogfood of the standard on this repo itself: adapted M1 CI (tests, template checker, manifest validation, gitleaks), M2 hooks, and the five self-rendered project skills (`project-standard-{release,audit,spec,ticket,bootstrap-confluence}`).
- First production-readiness audit (`docs/PRODUCTION-READINESS-AUDIT.md`): 8.1/10.
- Real-world validation of M1+M2 on a live consumer repo: green PR, hooks active, one pre-existing lint bug caught.

[Unreleased]: https://github.com/big-emotion/agent-atelier/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/big-emotion/agent-atelier/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/big-emotion/agent-atelier/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/big-emotion/agent-atelier/releases/tag/v0.1.0
