# Agent Comms

> Four skills for publishing short-form video and social content: why the viewer stays, how the file gets made, what the audience actually did, and what to publish next.

Part of [Agent Atelier](../../README.md). Install:

```
/plugin marketplace add big-emotion/agent-atelier
/plugin install agent-comms@big-emotion
```

## How the tools compose

The four skills form a loop, and each hands the next a written artefact rather than a conversation.

`attention-architect` turns a subject into an approvable narrated script and names the mechanism behind every beat — it owns the question of why the viewer stays and why they click. `video-director` takes that approved script and produces the file, defending the project's format spec against the temptation to redesign it for one awkward beat. Once the piece is published, `audience-audit` measures what the audience actually did and writes one dated report classifying every visited URL. `content-strategist` reads that report, collects per-post platform numbers, and decides what ships next, on which channel — then hands a subject back to `attention-architect`, and the loop closes.

The loop only works because each step refuses to do the next one's job. The audit does not decide what to publish. The strategist does not write the hook. The architect does not render. And none of the four publishes anything without explicit per-post approval.

## Tools

### `attention-architect` — skill

Turns a subject into an approvable narrated script — hook, open loop, retention beats, reframe, call to action — and states the mechanism behind each choice together with the line it must not cross. Its doctrine is derived from measured productions rather than from a marketing manual: the six-beat shape, four hook forms ranked by what they actually produced, the reframe sentence every approved script carries, the exit re-open, and declared doubt as a retention device. It also keeps a pattern ledger with an intake protocol, so a screenshot or a post becomes a reusable principle instead of a conversation that happens twice a year.

**Use it when:**

- You have a subject and need the script — the hook written out, the beats in order, the closing line that answers the hook's own question
- A video explains well and still flattens, and you need to know at which beat attention leaks
- Someone sends you a persuasion principle worth keeping, and you want it filed against a mechanism rather than remembered badly
- You are writing social copy and need the same loop opened on a surface where video is not the vehicle

**Don't use it for:**

- Rendering, captions, voice or export — that is `video-director`
- Deciding which channel or how often — that is `content-strategist`
- Establishing whether a claim is true — that belongs to the project's editorial owner, and the skill refuses to invent a figure a source cannot state

**Example:**

```
/agent-comms:attention-architect Le Ghana porte le nom d'un empire qui n'était pas sur son territoire
```

### `video-director` — skill

Owns everything between an approved script and a publishable file. Establishes a project's format spec the first time — voice, hook delivery, pacing, canvas and export, captions, sequence, brand ending — then defends it, because an approved format is not redesigned from a production session. Carries the sourcing discipline for visuals, the six traps that have already destroyed an argument or cost a session in production, the per-video deliverables, and the packaging discipline that separates an exact replay from a new production.

**Use it when:**

- A project has no format spec yet and every video re-litigates the same seven decisions
- You have an approved script and need the file, to a format somebody already approved
- The audio and the scene timing have drifted, or a foreign word came out of the voice as a different word
- You need to package a production so it can actually be replayed months later

**Don't use it for:**

- Writing or fixing the narration — that is `attention-architect`
- Changing an approved format because a beat is awkward to time; the skill exists partly to refuse that

**Example:**

```
/agent-comms:video-director --establish
```

### `audience-audit` — skill

Crosses privacy-analytics data with the repository's own URL inventory and gives every visited page exactly one verdict — Keep, Improve, Merge, Create. Names the four patterns that are easily confused and have different fixes: the dead end, the bounce-through, cannibalisation, and the channel that looks dead but is merely untagged. Read-only on source; writes exactly one dated Markdown report, and never overwrites a previous one, because the series is the point.

**Use it when:**

- You are about to plan editorial or UX work and have no current measurement
- A page attracts visits and you cannot tell whether it satisfied the visitor or lost them
- A channel you publish to shows zero traffic and you need to know whether that means "it failed" or "we never measured it"
- You want a monthly series comparable enough that movement, not level, becomes readable

**Don't use it for:**

- Fixing anything it finds — it measures and classifies, nothing else
- Deciding what to publish next; that is the report's consumer

**Example:**

```
/agent-comms:audience-audit --period=30d
```

### `content-strategist` — skill

Decides what to publish next, on which channel, how often and for whom — from the dated audit and the real publishing history, never from taste. Returns directives with the reason attached rather than a menu handed back to a non-specialist. Enforces one rule above all: never propose a subject without stating how the comparable published content performed, and say plainly when the numbers were never collected instead of implying success.

**Use it when:**

- You have a current audit and need the next month's plan, ranked
- You are unsure whether a channel deserves video at all, or a text post with the link
- Someone asks which metrics actually matter for short-form, and views is the wrong answer
- You want to know which single platform API is worth connecting first, and only that one

**Don't use it for:**

- Publishing, scheduling or posting — never done without explicit approval for that specific post
- Writing the hook, or rendering the file

**Example:**

```
/agent-comms:content-strategist --both --collect-metrics
```

## What this plugin does not carry

**No SEO skill exists yet.** Search visibility is currently handled inside `audience-audit` (acquisition sources, intent arriving where nothing answers it) and inside project engineering work on metadata. A dedicated skill would own per-page metadata, structured data, internal linking and index coverage — it is a real gap, named here rather than papered over with a thin file.

**No client material, ever.** Like every plugin in this marketplace, this one is generic by construction. The measured examples come from Big Emotion's own public projects and carry no infrastructure coordinates, no identifiers and no signed URLs.
