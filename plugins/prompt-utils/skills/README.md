# prompt-utils — skills

What each skill in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for, requirements) is in the plugin's [README](../README.md).

## [`expertify`](expertify/SKILL.md)

Finds the professional role behind a rough prompt, maps lay wording to field terminology, and rewrites it expert-grade.

```
/prompt-utils:expertify help me make my website load faster on phones
```

**Role** — Web performance engineer: owns page speed, Core Web Vitals, and mobile optimization.

| Your wording | Proper term | What it means |
|---|---|---|
| load faster | improve LCP / TTI | time to render main content and become interactive |
| on phones | mobile performance budget | speed targets for constrained devices and networks |
| — | render-blocking resources | CSS/JS that delays first paint |

```
You are a web performance engineer, and you will optimize a website's mobile Core Web Vitals…
```

→ then asks: "Execute the rewritten prompt now?" — Yes / No (No = the rewrite was the deliverable).

## [`repo-scout`](repo-scout/SKILL.md)

Shallow-clones a GitHub repo, reads its key files, and reports what it does, what's worth stealing, and how to use it.

```
/prompt-utils:repo-scout https://github.com/anthropics/claude-code-tricks
```

## What it does
Plain 2–3 sentence summary: what problem it solves, for whom. No marketing fluff.
## 3 things you need to know
1. **Key pattern or architecture** — what matters when evaluating it
2. **Important limitation** — e.g. state lives in one SQLite file
3. **Maturity/gotcha** — e.g. last commit 14 months ago
## Reusable parts — what to steal
### For `~/.claude/` — exact `cp` commands, or "Nothing `.claude/`-specific here."
### For your projects
- **`src/lib/retry.ts`** — backoff wrapper — **Why:** worth reusing over writing your own
## Use it right now
One copy-paste command or minimal install + usage snippet — "do this", not "you could".
## Quick stats
- **Language:** TypeScript · **License:** MIT · **Last commit:** date · **Stars:** n · **Health:** Active / Maintained / Stale / Abandoned

## [`thought`](thought/SKILL.md)

Captures a surprising answer as a dated note in ~/thoughts/, updates the TLDR index, then resumes the conversation.

```
/prompt-utils:thought
```

**Context:** We were exploring why public LLM benchmarks drift; the question was whether the benchmark or the model moves first.

**Thought:** The surprising part: the benchmark decays faster than the model — public test sets leak into training data, so scores rise while capability stays flat.

**Suggested subject:** evals

"Save this? You can: **accept**, **reframe** (tell me what to change), or **cancel**. You can also change or skip the subject."

→ accept → "Saved to `2026-07-29-evals.md`" — and `TLDR.md` gains, under its subject section:
`- **2026-07-29** — public benchmarks decay by leaking into training data`

Then the conversation resumes exactly where it was — the save never interrupts the flow.
