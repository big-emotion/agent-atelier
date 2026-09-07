# agent-comms — skills

What each skill in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for) is in the plugin's [README](../README.md).

## [`attention-architect`](attention-architect/SKILL.md)

Turns a subject into an approvable narrated script and names the mechanism behind every beat.

```
/agent-comms:attention-architect Le Cameroun porte le nom d'une crevette
```

Six beats: open the loop → make it plausible → show the proof → give the context → reframe → pay the debt. The deliverable is the narration verbatim, plus the claim map, the rhetoric flags, the speech/text split and the pronunciation flags.

```
Hook (flat impossible assertion, 6 words) — spoken:
  « Le Cameroun porte le nom d'une crevette. »

Reframe (beat 5) — the sentence people will quote:
  « Le nom donné à un fleuve, pour ce qu'on y pêchait, a fini par désigner tout un pays. »

Speech/text split: "Rio dos Camarões" is SHOWN, not spoken — the voice
collapses it toward the French form and the etymology dies silently.

Closing line: subject class = place name → « Retrouve l'histoire de chaque
pays sur EthniAfrica » (never « chaque peuple » on a toponym episode).
```

Run it with `--critique` on a piece that underperformed, and it walks the beats in order and reports the *first* one that fails — attention leaks forward, so a broken beat 1 makes beats 2–6 unmeasurable.

Run it with `--learn` on a screenshot or a link, and it files the principle in [`patterns/`](attention-architect/patterns/README.md) against a mechanism, dedupes it against what is already there, and marks it `borrowed` until your own numbers make it `observed`.

## [`video-director`](video-director/SKILL.md)

Everything between an approved script and a publishable file.

```
/agent-comms:video-director --establish
```

Walks the seven format decisions once — voice, hook delivery, pacing, canvas and export, captions, sequence, brand ending — and writes them where the project keeps them. Duration is deliberately not among them: the approved narration sets the length, never the reverse.

```
Format spec settled. Six traps flagged for this project:

1. Homograph collapse — 2 foreign forms in the queue must be text cards
2. Glyph coverage — 1 diacritic unverified in the chosen face
3. Font availability — verify per environment, do not assume
4. Nobody can hear — 5 proper nouns flagged for human listen-through
5. Final audio before final scene timing
6. Look at the actual pixels — 1 sourced map not yet opened
```

## [`audience-audit`](audience-audit/SKILL.md)

Measures the audience, classifies every visited page, writes one dated report.

```
/agent-comms:audience-audit --period=30d
```

Crosses the analytics breakdowns (`detailed=true`, explicit `limit`) with the site's own URL inventory, then gives each URL one verdict and names which of the four confusable patterns it is.

```
Report written: docs/audience/audit-2026-09-07.md

3 findings, each tied to a number:
  1. Second-most-visited page is a dead end (92% bounce, 76% scroll) —
     the visitor read it all and left. Missing next step, not bad content.
  2. The channel carrying 45% of traffic is scheduled last in the plan.
  3. 91% mobile, bouncing ~4x more than desktop, on a mobile-first project.

3 video platforms show zero: recorded as UNMEASURED (no campaign tags),
not as "did not work".
```

A [worked example](audience-audit/references/worked-example.md) records what those findings looked like on a real first run.

## [`content-strategist`](content-strategist/SKILL.md)

Decides what ships next, where, how often, for whom — with the comparable's numbers attached.

```
/agent-comms:content-strategist --both --collect-metrics
```

Refuses to run on a report older than 30 days. Ranks short-form by hook rate, then view duration as a fraction of length, then saves and shares, then link clicks — views last. Never compares a view across platforms.

```
Social: 3 slots filled. Slot 2 changes vehicle —
  LinkedIn gets a TEXT post with the link, not the video.
  Reason: 3 video posts → 0 clicks; 2 text posts → all of them.

Site: convert the dead end before creating anything new. That page
already has the audience a new page would have to earn.

Not collected this session: one platform stalled on bot detection.
Recorded empty, NOT zero.
```
