# prompt-utils — commands

What each command in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for, requirements) is in the plugin's [README](../README.md).

## [`interview`](interview.md)

Makes Claude interview you — probing questions, challenged assumptions — until 95% confident before proposing any plan.

```
/prompt-utils:interview I want a dashboard for my team's KPIs
```

→ Instead of a plan, Claude starts probing:

1. Which decision should this dashboard change? What happens differently when a number moves?
2. Who actually looks at it, and when — a daily standup glance or a monthly deep dive?
3. You said "KPIs" — name the three metrics that matter most, and where that data lives today.
4. Is a dashboard the real need, or would a weekly alert on two thresholds solve it?

It keeps digging — challenging what you *think* you should want — and only proposes a solution once it is ~95% confident about what you actually want.
