# code-quality — agents

What each agent in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for, requirements) is in the plugin's [README](../README.md).

## [`code-review`](code-review.md)

Pre-push review of local diffs (staged or recent commits) for bugs, edge cases, error handling, type safety, readability.

```
"Review my changes before I push"
```

→ reads CLAUDE.md + project config, runs `git status` / `git diff --staged`

```
## Code Review — contact-form throttle refactor

### Blockers
> Must fix before pushing.

**src/lib/rate-limit.ts:57** — window reset uses `>` instead of `>=`, so the boundary request slips through
Suggested fix: `if (now - entry.windowStart >= windowMs) { … }`

### Should Fix
> Creates risk or technical debt if left as-is.

**src/components/contact-form.tsx:112** — fetch error swallowed; user gets no feedback
Suggested fix: set a form-level error state in the catch branch

### Verdict
DO NOT PUSH — one boundary bug lets throttled requests through; fix and re-run.
```
