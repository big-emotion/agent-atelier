# Code Quality

> Read-only code-quality reviewers for local diffs: a pre-push bug-and-quality review agent (with an OpenAI Codex CLI port) and a focused skill that scans a diff for the tells of unreviewed AI-generated code.

Part of [Agent Atelier](../../README.md). Install:

```
/plugin marketplace add big-emotion/agent-atelier
/plugin install code-quality@big-emotion
```

## How the tools compose

The tools compose loosely rather than as a strict pipeline: after generating or writing a non-trivial chunk of code, run ai-code-tells first as a self-review pass (it targets AI-generation smells while the diff is fresh, and its own doc recommends running before opening a PR); then run the code-review agent as the final pre-push gate for bugs, edge cases, error handling, and in-diff security. Both are read-only, so neither blocks the other. codex/code-review.toml is not a pipeline stage — it is the same pre-push reviewer ported to the OpenAI Codex CLI for teams running both harnesses.

## Tools

### `ai-code-tells` — skill

A focused, read-only review that scans a code diff for five recurring signatures of unreviewed AI-generated code: narrating comments, generic domain-blind names, hollow or over-mocked tests, docs that restate signatures, and non-obvious decisions with no recorded rationale. It resolves its own target in a fixed order (explicit path/file list/PR number, else staged changes, else working tree, else the branch diff against the merge-base with the default branch) and reviews only changed lines, never the whole repo. Findings are reported grouped by tell as file:line with the offending snippet, why it is a tell, and the concrete fix, ending with a per-tell count verdict; it never edits unless the user explicitly says "fix them" afterwards, and repo-level hard gates (from the project's CLAUDE.md) are reported as blocking rather than advisory.

**Use it when:**

- As a self-review pass before opening a PR, on the branch's full diff against the default branch
- Right after an AI agent generated a non-trivial chunk of code, before presenting or accepting it as done
- A diff smells of play-by-play comments, `data`/`result`/`handle()` naming, or tests that only assert a mock was called
- You want a precise, defensible report (file:line, why, concrete fix) of AI smells without anything being modified
- Auditing staged changes for readability and rationale debt while keeping the human's mental model intact

**Don't use it for:**

- You are hunting bugs, edge cases, type-safety, or security issues — that is the code-review agent's axis, not this skill's
- You want a whole-repo audit — the skill deliberately restricts itself to changed lines and stops if nothing is in scope
- You expect automatic remediation — it is read-only by default and applies fixes only on an explicit follow-up request

**Example:**

```
/code-quality:ai-code-tells src/services/checkout.ts
```

**Requirements:** git CLI only (for diff resolution); no MCP servers, no credentials

### `code-review` — agent (Claude Code sub-agent, model: opus, memory: user)

A pre-push code reviewer sub-agent for local changes. It first loads project context (CLAUDE.md, tsconfig/eslint/vite config), then gathers the diff via git (git status, git diff --staged, or git diff HEAD~N for recent commits — asking which commits if unclear) and reviews only the changed code for bugs and logic errors, edge cases, error handling, TypeScript type safety, in-diff security (hardcoded secrets, XSS, unsanitized input), readability, and untested logic changes. It outputs findings grouped by severity (Blockers / Should Fix / Nice to Have), each with file:line and a concrete suggested fix, and closes with a PASS / PASS WITH COMMENTS / DO NOT PUSH verdict; it is read-and-report only and explicitly excludes production-readiness concerns (monitoring, CI/CD, deployment, project-level architecture).

**Use it when:**

- "Review my changes before I push" — a last local gate on a feature branch
- Checking what you just committed (recent commits) for logic errors, missing edge cases, or swallowed errors
- Vetting staged changes for unsafe `any`, missing error handling, or hardcoded secrets before committing
- Changed logic landed with no corresponding test changes and you want that flagged per TDD
- Reviewing a refactor of a service or API integration for retry/timeout/error-handling gaps

**Don't use it for:**

- You need a production-readiness assessment (monitoring, observability, CI/CD, deployment, backward compatibility) — explicitly out of this agent's scope
- You specifically want AI-generation smells (narrating comments, generic names, hollow tests) — ai-code-tells is the targeted pass
- Reviewing a remote pull request rather than local work — the agent operates on the local git diff

**Example:**

```
"Review my staged changes before I push" (Claude Code delegates to the code-quality:code-review agent)
```

**Requirements:** git CLI; Claude Code with access to an Opus-class model (the agent frontmatter pins model: opus); no MCP servers, no credentials

### `code-review (Codex CLI variant)` — codex agent (TOML definition for the OpenAI Codex CLI)

The same pre-push reviewer as the Claude Code agent, packaged as a TOML definition (name, description, developer_instructions) for the OpenAI Codex CLI. The review contract is identical — same diff-gathering steps, same review axes, same Blockers / Should Fix / Nice to Have grouping and PASS / PASS WITH COMMENTS / DO NOT PUSH verdict — with one adaptation: the context step reads AGENTS.md instead of CLAUDE.md. Like its Claude counterpart it reads and reports only; it never edits or pushes.

**Use it when:**

- Your team runs the OpenAI Codex CLI and wants the exact same pre-push review contract as the Claude Code agent
- You need review output that stays comparable across both harnesses (same severities, same verdict vocabulary)
- The repo uses AGENTS.md as its agent-convention file and reviews happen from Codex

**Don't use it for:**

- You are working in Claude Code — use agents/code-review.md; Claude Code does not read the codex/ TOML
- You want the AI-tells scan — the ai-code-tells skill has no Codex port in this plugin

**Example:**

```
codex "Review my staged changes" (with codex/code-review.toml installed as a Codex CLI agent definition)
```

**Requirements:** OpenAI Codex CLI with the TOML installed as an agent definition; git CLI; no MCP servers, no credentials
