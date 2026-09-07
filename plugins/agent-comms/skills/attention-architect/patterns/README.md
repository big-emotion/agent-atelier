# The pattern ledger

One file per **mechanism**. This is where an interesting thing seen in the wild
becomes something the next script actually inherits.

The operator collects communication ideas as they cross their feed — a
screenshot, a post, a video, a half-remembered rule. Without a ledger those
arrive twice a year, get discussed once, and are gone. With one, each is filed
against a mechanism, checked against what has already been measured, and reused
without being rediscovered.

## Index

| Pattern | Status | Mechanism in one line |
| --- | --- | --- |
| [zeigarnik-open-loop](zeigarnik-open-loop.md) | observed | An unfinished story creates a tension the mind acts to resolve |

## Status values

Be honest here — an over-claimed ledger is worse than a thin one.

- **observed** — we have our own numbers on it, from our own channels. The
  evidence section names the video and the figure.
- **borrowed** — it comes from outside (literature, a practitioner's post, a
  competitor's format) and has not been tested on our audience. A borrowed
  pattern may be used, and every script that uses it should say so, because
  that is how it becomes observed.
- **refuted** — our own measurement contradicts it. **Keep the file, flip the
  status, record what happened.** A deleted refutation gets rediscovered and
  re-adopted six months later.

## Filing a new pattern

1. **Read the source completely.** Open the image, watch the video, read the
   whole post. A headline is not the claim, and a promising description is not
   the content.
2. **Name the mechanism, not the example.** "Zeigarnik / open loop", not
   "that LinkedIn post about hacking". The example goes in the source section.
3. **Check the ledger first.** `grep -ril "<keyword>" patterns/`. If the
   mechanism is already filed, **extend that file** — a second name for one
   mechanism is how a ledger stops being usable. Two files may only exist when
   the two mechanisms fail independently.
4. **Attribute it.** Who said it, where, when. A practitioner's post is a
   source like any other and it carries an authority level: an author asserting
   a principle is not the same as a study measuring it, and the file says which
   it is.
5. **Write the ethical fork.** Every attention mechanism has one — the same
   device that captivates manipulates when the debt goes unpaid. A pattern file
   with no fork section is not finished.
6. **Set the status honestly.** A capture is a claim by its author, not
   evidence about our audience. New patterns are almost always `borrowed`.
7. **Update the index above.**

## The file shape

```markdown
# <Mechanism name>

**Status:** observed | borrowed | refuted
**Filed:** YYYY-MM-DD
**Source:** who, where, when — and what kind of claim it is

## What it is
The mechanism in plain language. Two or three sentences, no jargon.

## How it applies to a 30–45 s vertical
Concretely: which beat, what it changes in the writing.

## The fork
Where the same device becomes manipulation, and the rule that keeps us on the
right side of it.

## Evidence in our own record
What we have actually measured, or an explicit "none yet".

## Related
Links to other patterns.
```

## What does not go in the ledger

- Production settings — fonts, colours, voices, export presets. Those live in
  the project's production reference.
- Distribution decisions — which network, what cadence. Those belong to the
  project's content strategist.
- A principle nobody can state in two sentences. If it cannot be named, it
  cannot be reused, and filing it just makes the ledger longer to read.
