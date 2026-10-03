---
name: idea
description: Turns a rough idea, a theme or an audience finding into a subject report a writer can build cards from without asking another question — the question, the angle, a one-sentence promise, what the piece will not say, its sources and its reservations. First step of the idea, structure, produce chain. Also carries the narrative design stages (frame, research, propose, choose, develop) for a carousel, a reel or a single image. Never writes a card, picks an image or opens a template. Use for "j'ai une idée de…", "on pourrait parler de…", "trouve-moi un sujet", "quels récits possibles pour ce sujet", or /idea.
metadata:
  author: Big Emotion
  version: "1.0.0"
  argument-hint: "[seed idea or theme]"
---

# Idea

Turns a seed into **a subject report**, not a piece of content. The report is the
document that lets the next step (`structure-carousel`, `structure-reel` or `structure-image`), write cards without asking
another question. Nothing comes before this step.

```
seed (or audit report)  →  idea  →  idea.md + idea.json  →  structure-carousel | structure-reel | structure-image
```

The handoff is files, not a conversation: the next session never saw this one.

## Two ways to run it

- **Interactive** (a person is in the session): follow the five stages below and
  stop where the table says, so the person makes the real choices.
- **Studio** (`project/studio.md` exists in the working folder): the contract wins.
  Never ask, never block. Run the five stages yourself, choose the proposal the
  evidence best supports, and list every decision under `## Choix faits pour toi`
  with one reason each. Write only the files the contract names.

## What you read first

1. `project/profile.md`: the brand, the language, the audience, the networks and
   their register. Write the report in the profile's language.
2. Everything under `inputs/`: the seed, and when present an audience report or a
   strategy. A seed is a starting point, not a brief.
3. On a revision (`revision.md` and `inputs/previous/`): start from the previous
   version, change what the sentence asks, keep the rest.

## The five stages

| Stage | What you do | You stop when |
| --- | --- | --- |
| 1. Frame | Subject, audience, material supplied, earlier work on the same subject | The subject and the task are unambiguous |
| 2. Research | Reuse valid research, fill the real gaps with the tools you have | You can judge the stories, or the gaps are named precisely |
| 3. Propose | Examine the ten patterns (`references/narrative-patterns.md`) against the evidence | Each proposal says what it promises, how it unfolds and what it cannot claim |
| 4. Choose | Interactive: record the person's choice in their words. Studio: pick one and say why | One proposal is named |
| 5. Develop | Expand the chosen proposal into a card-by-card outline | The outline is complete before anything is written in full |

- **The ten patterns are examined, not ten pieces proposed.** A pattern the
  evidence cannot carry is reported with its reason. One viable story is fine:
  never invent a competitor.
- **A recommendation is not a choice** in interactive mode. After stage 3, wait.
- **An unknown is valid content.** Never invent a date, an author or a route to fill
  a block. A claim with no source cannot carry the chosen outline.
- **Duration does not exist for a carousel or an image.** The deck size comes from the
  project's carousel profile, not from this step. A reel's length is set later by the
  voice-over, never by this step.
- **Pick the formats the sources can carry.** One claim fits a single image; a short
  argument fits a reel; a longer argument with several sources fits a carousel.

## The rules that make a subject worth keeping

- **A hook the sources cannot pay off is bait.** `idea.json` carries the hook and
  where its debt is paid (`hook.payoff`). If the sources cannot pay it, the subject
  dies here, where it costs nothing.
- **Rhetoric stays labelled as rhetoric.** An editorial flourish never becomes a
  finding on its way down the chain.
- **Never invent a source, a licence or a number.** A figure you could not verify
  is written as unverified.
- **State what the piece will not say.** It is the most important section: it stops
  the next step from writing a sentence the sources do not carry.
- **One question per angle.** Two questions are two angles, hence two pieces.
- **Say the basis.** `dated-evidence` cites the audience report (with its date);
  `exploratory` says why no comparable exists. An exploratory subject is
  legitimate; it is never dressed up as measured.
- **A topical event** can bring a subject forward. Say so under the reservations.

## Deliverables

Two files, with fixed names, written to `outputs/`.

### `idea.md`

```markdown
# <working title>

## Question
<one bounded question the sources can answer honestly>

## Angle
<one sentence: what this subject says that is not said elsewhere>

## Promise
<one sentence, in the reader's future: what they will know afterwards>

## What this piece will not say
- <a thing the sources do not allow us to claim>

## Sources
- <title>, <url>: <what it supports>

## Reservations
- <what could make the subject fail>

## Choix faits pour toi
- <a decision you took> — <the reason, in one clause>
```

### `idea.json`

The machine form of the same report; the portal and the next step read it.
`references/idea.schema.json` is the shape. Required: `question`, `angle`,
`promise`, `audience`, `hook` (`text`, `payoff`), `wontSay[]`, `sources[]`
(`title`, `url`, `supports`), `reservations[]`, `formats` (any of `carousel`, `reel`, `image`),
`networks[]` (from the profile), `basis` and `basisReason`.

## What this step does not do

Write cards. Choose images. Render anything. Publish. Check the facts for you: the
sources are listed so that a human can open them.
