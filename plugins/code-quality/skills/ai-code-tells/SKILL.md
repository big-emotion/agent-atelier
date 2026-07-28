---
name: ai-code-tells
description: Scan a code diff for the consistent "tells" of unreviewed AI-generated code — narrating comments, generic names, hollow over-mocked tests, signature-restating docs, and unjustified decisions. Read-only; reports each finding with file:line, why it's a tell, and the concrete fix. Use when the user says "check for AI tells", "review this diff for AI smells", "ai-code-tells", or invokes /ai-code-tells. Works standalone; pairs well with any always-on code-quality rules you define in your own CLAUDE.md.
metadata:
  author: Big Emotion
  version: "1.0.0"
---

# AI-Code Tells Review

A focused, read-only review that catches the five consistent signatures of AI code that nobody read before accepting it. It does **not** fix anything by default — it reports findings so a human keeps the mental model. Apply fixes only when the user asks.

The five tells below are the complete rule set — the skill needs no external configuration. If your user-level or project CLAUDE.md defines equivalent always-on code-quality guardrails, this skill acts as their on-demand review pass; honor any project-level tightening in the repo's own CLAUDE.md (e.g. hard gates).

## When to Activate

- The user invokes `/ai-code-tells` or asks to "check for AI tells / AI smells".
- After generating a non-trivial chunk of code, before presenting it as done.
- Before opening a PR, as a self-review pass.

## Scope — what to review

Resolve the target in this order, stop at the first that applies:

1. An explicit path, file list, or PR number the user named.
2. Staged changes: `git diff --cached`. If empty →
3. Working-tree changes: `git diff`. If empty →
4. The current branch vs its merge-base with the default branch: `git diff $(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)...HEAD`.

Review only the changed lines and enough surrounding context to judge them. Do not audit the whole repo. If nothing is in scope, say so and stop.

## The five tells

For each, scan the diff and record findings. A finding is `file:line — <tell> — why it's a tell — concrete fix`.

1. **Narrating comments.** Comments that restate what the code literally does (`// increment counter`, `// loop over the list and process each item`, `// return the result`). The fix: delete it, or replace it with the *why* (a decision, constraint, or gotcha) if one exists. A method whose every line has a play-by-play comment is the strongest signal.

2. **Generic, domain-blind names.** Identifiers like `data`, `result`, `item`, `value`, `obj`, `temp`, `process()`, `handle()`, `doStuff()`, `Manager`, `Helper`, `Util` where a domain word exists. The fix: rename to what it *is* in the problem domain. Flag only where a more meaningful name is genuinely available — loop indices and trivially-scoped temporaries are fine.

3. **Hollow / over-mocked tests.** Tests that (a) mock or stub the very thing under test, (b) reach into private internals via reflection / `as any` / `@ts-ignore` / accessing `_private` members instead of the public interface, (c) assert only that a mock was called rather than on real output/behavior, or (d) are elaborate scaffolding that would pass even if the logic were wrong. The fix: test the public interface the way a caller uses it; assert on observable output or state; mock only true external boundaries (network, clock, fs).

4. **Docs that restate signatures.** Doc comments / JSDoc / docstrings that just re-list the parameters and return type the signature already shows, with zero rationale. The fix: keep docs that explain *why*, constraints, edge cases, and tradeoffs; drop the rest.

5. **Decisions with no recorded "why".** A non-obvious choice (an algorithm, a data shape, a dependency, a workaround, a magic number) introduced with no comment, commit-body line, ADR, or PR note explaining the reasoning. The fix: add the rationale where the project records it (inline comment for local choices, ADR / changelog / PR body for architectural ones).

## Output format

Report grouped by tell, most severe first. For each finding:

```
[Tell N — short label]
  path/to/file.ext:LINE
    found:   <the offending snippet, one line>
    why:     <why this is a tell>
    fix:     <the concrete change>
```

End with a one-line verdict: a count per tell and whether the diff reads like code a human reviewed. If the diff is clean on a given axis, say so explicitly rather than omitting it — "0 narrating comments" is a useful signal.

## Rules

- **Read-only by default.** Report findings; do not edit. If the user then says "fix them", apply the minimal change per finding and nothing else (scope discipline).
- **No false-positive padding.** A name is only flagged when a better domain name actually exists. A comment is only flagged when it adds nothing. Precision over volume — a noisy report trains the user to ignore it, which defeats the point.
- **Be able to defend every finding.** This skill exists to rebuild the reading habit, not to nag. If you can't say *why* a flag matters, drop it.
- **Respect project tightening.** If the repo's CLAUDE.md promotes any tell to a hard gate (e.g. "no reflection in tests", "names from the domain glossary"), report violations of it as blocking, not advisory.
