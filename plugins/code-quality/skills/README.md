# code-quality — skills

What each skill in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for, requirements) is in the plugin's [README](../README.md).

## [`ai-code-tells`](ai-code-tells/SKILL.md)

Read-only diff scan for the five tells of unreviewed AI code; reports each finding as file:line, why, and a concrete fix.

```
/code-quality:ai-code-tells src/lib/rate-limit.ts
```

```
[Tell 1 — Narrating comments]
  src/lib/rate-limit.ts:42
    found:   // loop over entries and delete expired ones
    why:     restates what the code literally does; no decision or gotcha
    fix:     delete, or replace with why the sweep runs on read, not on a timer

[Tell 3 — Hollow / over-mocked tests]
  src/lib/rate-limit.test.ts:18
    found:   expect(checkMock).toHaveBeenCalledOnce()
    why:     asserts only that a mock was called, would pass if the logic were wrong
    fix:     call the limiter through its public interface and assert allow/deny output
```
Verdict: 1 narrating comment, 0 generic names, 1 hollow test, 0 signature-restating docs, 0 missing "why" — needs one human pass before PR.

Read-only: nothing is edited unless you then say "fix them".
