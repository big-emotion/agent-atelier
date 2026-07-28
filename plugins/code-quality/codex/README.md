# code-quality — Codex CLI variants

What each variant in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for, requirements) is in the plugin's [README](../README.md).

## [`code-review (Codex port)`](code-review.toml)

Same pre-push diff-review agent packaged for the Codex CLI; identical process and report, but reads AGENTS.md, not CLAUDE.md.

```
"Review my staged changes"
```

Identical review contract to the Claude Code agent — same scope (changed code only, explicitly NOT production readiness), same severity ladder, same report:

```
## Code Review — [short description of what was reviewed]

### Blockers / Should Fix / Nice to Have
**[file:line]** — [issue description]
Suggested fix: [concrete fix or code snippet]

### Verdict
[PASS | PASS WITH COMMENTS | DO NOT PUSH] — [1 sentence justification]
```

Only divergence from the agents/ version: step 1 loads **AGENTS.md** (Codex's convention) instead of CLAUDE.md; empty severity sections are omitted, and a clean diff skips straight to the verdict.
