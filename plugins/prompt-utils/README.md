# Prompt Utils

> Prompt-side utilities for Claude Code: elicit what you actually want through an interview, rewrite prompts in expert vocabulary, scout GitHub repos for reusable parts, and journal surprising answers.

Part of [Agent Atelier](../../README.md). Install:

```
/plugin marketplace add big-emotion/agent-atelier
/plugin install prompt-utils@big-emotion
```

## How the tools compose

The tools are independent, but interview and expertify compose naturally: run /prompt-utils:interview first to surface what you actually want, then /prompt-utils:expertify on the clarified prompt to restate it in the owning expert's vocabulary before executing it. repo-scout and thought are standalone.

## Tools

### `interview` — command

A prompt directive that flips the usual flow: instead of proposing a solution, Claude interviews you with probing questions and challenged assumptions until it is 95% confident about what you actually want — not what you think you should want. Purely conversational and read-only; it only starts proposing a solution or plan once that confidence bar is met. Optional arguments seed the topic of the interview.

**Use it when:**

- Requirements are fuzzy and a premature plan would just be plausible-but-wrong
- Starting a feature or spec where you suspect your own framing is off
- Before writing a ticket, to have your assumptions challenged first
- You keep re-prompting because your initial ask underspecifies the real need

**Don't use it for:**

- The requirement is already precise — the interview only adds latency
- You want your prompt rewritten rather than a dialog — that is expertify
- You need a codebase analyzed, not your intent — that is repo-scout

**Example:**

```
/prompt-utils:interview I want to add a client area to the marketing site
```

**Requirements:** none

### `expertify` — skill

Identifies the one professional role that owns your topic (preferring the specific title over the generic), builds a 6–12 entry terminology map pairing your lay wording with the field's proper terms — including concepts you didn't know to ask about — and rewrites your prompt opening with 'You are a <role>, and you will <mission>', preserving your intent and scope exactly with zero added or dropped requirements. Runs at most 1–2 web searches, and only for niche, ambiguous, or country-specific domains; it never invents jargon and says so when no established term exists. Keeps the original language (French stays French) and always ends by asking, via AskUserQuestion, whether to execute the rewritten prompt now or stop with the rewrite as the deliverable.

**Use it when:**

- You are about to ask a question outside your domain and want the field's vocabulary first
- "What do you call the person/role who…" — you need the precise job title
- Upgrading a rough prompt before sending it to a model or a human expert
- You want a persona opener grounded in a real professional role, not a generic one
- FR vs EN job-title differences matter for your question

**Don't use it for:**

- The prompt is already domain-fluent — there is nothing to translate
- You need requirements elicited through dialog — expertify never adds or removes requirements; use interview
- You want the answer to the question itself rather than a better way to ask it

**Example:**

```
/prompt-utils:expertify help me make my website load faster on phones
```

**Requirements:** none (web search access used optionally for niche domains)

### `repo-scout` — skill

Shallow-clones a GitHub repo into a temp directory, reads README/CLAUDE.md/SKILL.md/manifests/LICENSE, globs for skill, agent, and reusable-code directories, and skims 5–10 key source files to gauge quality. Produces a fixed-format report: plain-language summary, 3 things to know, reusable parts split between your `.claude/` setup and your projects (with exact cp commands and a why for each item), one copy-paste 'use it right now' example, and quick stats including a restrictive-license flag (GPL/AGPL) and a health rating. Read-and-report only — it writes nothing into your project and deletes the temp clone when done; it is explicitly honest about abandoned or low-value repos.

**Use it when:**

- Someone shares a GitHub URL and you want a practical breakdown fast
- Deciding whether a repo is worth adopting — health, license, code quality
- Harvesting skills, agents, or config snippets from a repo into your `.claude/`
- Finding components, utils, or patterns worth copying into your own project
- Checking whether a repo's license would block reuse before you copy anything

**Don't use it for:**

- You need a thorough code review or security audit — it skims a handful of files by design
- The repo is private and your `gh` auth cannot clone it — the skill stops on clone failure
- You intend to modify or contribute to the repo — this tool never writes to it

**Example:**

```
/prompt-utils:repo-scout https://github.com/owner/repo
```

**Requirements:** git and an authenticated `gh` CLI (used for `gh repo clone` and `gh repo view --json stargazerCount`)

### `thought` — skill

Captures the model answer that just surprised you as a journal entry: it synthesizes the last substantive answer into a short Context (3–5 sentences) plus a Thought focused on what was non-obvious (3–8 sentences), presents it for confirmation with accept/reframe/cancel and an optional subject tag, then writes a dated markdown file to the thoughts directory and appends a one-line distillation to an auto-maintained TLDR.md index. It writes files but never without your explicit confirmation, and it is deliberately non-interrupting — after saving it resumes the conversation exactly where it was.

**Use it when:**

- Mid-exploration, an answer genuinely changed what you were thinking and you want to keep it
- Building a personal insight journal that persists across conversations
- You want a one-line-per-insight TLDR you can re-read weeks later without the full transcript

**Don't use it for:**

- Nothing surprising happened — the skill's own rule rejects generic summaries
- You want session learnings folded into CLAUDE.md or project docs — use a CLAUDE.md-maintenance tool
- You want to archive a whole conversation rather than one distilled insight

**Example:**

```
/prompt-utils:thought (invoked right after the answer that surprised you)
```

**Requirements:** a writable thoughts directory on disk (currently hardcoded to a personal path — must be made configurable before public release; see findings)
