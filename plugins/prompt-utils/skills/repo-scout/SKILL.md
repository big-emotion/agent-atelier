---
name: repo-scout
description: Analyze a GitHub repo to understand what it does, extract its best parts, find reusable components, and get actionable usage instructions. Use when the user shares a GitHub URL and wants a practical breakdown.
metadata:
  author: Big Emotion
  version: "2.0.0"
---

# Repo Scout

Quickly understand a GitHub repo, extract what's valuable — both for `.claude/` and for your own projects — and get concrete usage instructions.

## When to Activate

- User shares a GitHub repo URL and wants to understand it
- User says "scout this repo", "what does this repo do", "analyze this repo"
- User wants to know what's reusable in a repo
- User asks "what can I steal from this repo"

## Input

The skill takes one argument: a GitHub repo URL (e.g., `https://github.com/owner/repo`).
The URL may include extra path segments or query params (e.g. `?tab=readme-ov-file`) — strip them and extract `owner/repo`.

If no URL is provided, ask for one.

## Workflow

### Step 1: Clone and Explore

1. Extract `owner/repo` from the URL
2. Clone into `/tmp/repo-scout-{repo}` using `gh repo clone {owner/repo} /tmp/repo-scout-{repo} -- --depth 1`
3. If the clone fails (auth, not found), inform the user and stop

### Step 2: Read Key Files

Read these files in parallel (skip any that don't exist):

- `README.md` (or `readme.md`, `README`)
- `CLAUDE.md`
- `SKILL.md`
- `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` (for metadata + dependencies)
- `LICENSE`

Then do a structural deep scan:
- `ls` the root directory
- Glob for `**/*.md` to find other documentation
- Glob for skill/agent definitions: `**/SKILL.md`, `**/skills/**`, `**/agents/**`, `**/.claude/**`
- Glob for reusable code: `**/components/**`, `**/utils/**`, `**/lib/**`, `**/services/**`, `**/hooks/**`, `**/helpers/**`, `**/middleware/**`, `**/prompts/**`, `**/templates/**`
- Read key source files that look reusable (utilities, services, core logic) — skim 5-10 files max to understand quality and patterns

### Step 3: Analyze and Respond

Produce a structured response with exactly these sections:

```markdown
## What it does
[2-3 sentence plain-language summary. No marketing fluff. What problem does it solve, for whom.]

## 3 things you need to know
1. **[Thing]** — [concise explanation. Focus on what matters for someone evaluating this repo]
2. **[Thing]** — [architecture, key pattern, or important limitation]
3. **[Thing]** — [maturity, quality, or gotcha worth knowing]

## Reusable parts — what to steal

### For `~/.claude/` (skills, agents, configs)
[List specific files/directories worth copying into .claude/, with exact cp commands.
Focus on: skills, agents, CLAUDE.md snippets, prompts, configurations.
If nothing is worth copying, say "Nothing `.claude/`-specific here." and move on.]

### For your projects (components, utils, patterns)
[List reusable code: components, utilities, services, patterns, middleware, configs.
For each item:]
- **`path/to/file.ts`** — [what it does] — **Why:** [why it's worth reusing over writing your own]

[If the repo has nothing worth extracting, say so honestly. Don't invent value.]

## Use it right now
[One concrete, copy-paste example of using this repo/tool/skill TODAY.
Include the actual command or code. No "you could" — show "do this".
If it's a library: install + minimal usage.
If it's a tool: run command.
If it's a collection of files: exact cp/curl commands.]

## Quick stats
- **Language:** [primary language]
- **License:** [license type — flag if restrictive]
- **Last commit:** [date, from git log --format="%ai" -1]
- **Stars:** [from gh repo view --json stargazerCount]
- **Health:** [Active / Maintained / Stale / Abandoned — based on commit frequency and issue activity]
```

### Step 4: Cleanup

Delete the cloned repo: `rm -rf /tmp/repo-scout-{repo}`

## Rules

1. **Be honest.** If the repo is abandoned, empty, or low-quality, say so. Don't sugarcoat.
2. **Be practical.** The user wants to use this today, not read a thesis.
3. **Explain "why".** For every reusable item, explain why it's worth taking instead of building from scratch.
4. **Respect licenses.** Flag restrictive licenses (GPL, AGPL) that would limit reuse. Note when MIT/Apache makes copying easy.
5. **Read before recommending.** Don't recommend a file you haven't actually read. Skim the source to confirm quality.
6. **No fluff.** Skip filler like "This is an interesting project". Get to the point.
7. **Always clean up.** Delete the `/tmp` clone when done.

## Examples

```
/repo-scout https://github.com/anthropics/claude-code-tricks
/repo-scout https://github.com/someuser/awesome-claude-skills
/repo-scout https://github.com/org/some-tool
/repo-scout https://github.com/user/repo?tab=readme-ov-file
```
