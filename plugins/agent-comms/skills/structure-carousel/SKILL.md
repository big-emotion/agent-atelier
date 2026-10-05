---
name: structure-carousel
description: Turns an approved subject report into a sourced carousel — the card copy, a caption per network, the sources, the images (Wikimedia Commons titles with a reason) and the exact quotes that support each claim. Second step of the idea, structure, produce chain. Every claim carries its source, the cover title is eight words or fewer, sentences stay at twenty words, and the subject comes before its reference. Does not render and does not read licences itself. Use for "écris les cartes", "prépare le carrousel", "rédige les légendes", or /structure-carousel.
metadata:
  author: Big Emotion
  version: "1.0.0"
  argument-hint: "[path to idea.md / idea.json]"
---

# Structure (carousel)

> **Headings are fixed.** Section headings are fixed identifiers: copy them exactly as written in the deliverable templates (English, with the same hash marks), whatever the language of the profile. Only the text under a heading is written in the profile's language.

Turns `idea.md` and `idea.json` into everything the render step needs. It writes
words and picks image titles; it does **not** render, redesign a layout or read
a licence.

```
idea.md + idea.json  →  structure-carousel  →  cards.json, captions.md, sources.md,
                                               images.json, citations.json  →  produce
```

## Two ways to run it

- **Interactive:** show every title, body and source in deck order and ask for
  approval of the complete text before calling the step done.
- **Studio** (`project/studio.md` exists): the contract wins. Never ask, never
  block, write only the five files, and list every decision under
  `## Choix faits pour toi` in `captions.md`.

## What you read first

1. `inputs/idea.md` and `inputs/idea.json`: the question, the angle, the promise,
   what the piece will not say, the sources, the reservations. **Consume the
   subject report; do not choose a fresh argument.** A card that cannot be written
   from the sources goes back to the idea step as a reservation; it is never
   padded with an invented source, date or image.
   **When `idea.json` carries a `plan`, it is the skeleton**: one card per plan
   step, in its order, each card built on the sources of its step (the plan's
   steps are 4 to 9, as is a deck). Depart from it only with a reason in
   `## Choix faits pour toi`. `beforeWriting` lists what the idea step could not
   verify: no card states a claim that depends on it. Without a plan, build the
   deck from the report as before.
2. `project/profile.md`: language, audience, the networks and the register of each.
3. On a revision: `revision.md` and `inputs/previous/`. Change what is asked, keep
   the rest, return every file in full.

## The rule that comes first

**Every claim carries its source, and a claim you could not read is not in the
piece.** "Read" means you opened the page and saw the words. A source assumed from
a title, a reputation or a neighbouring card is not a source you read; in that case
the card changes its claim.

## The deck

`cards.json` follows `references/cards.schema.json`. The order is in
`references/carousel-sequence.md`.

- **Cover title: eight words or fewer.** It is the one thing most people will see.
  The development starts on the next card.
- **A useful answer or orientation arrives by card 2.** The payoff never depends on
  a second carousel.
- **Plain language.** Subject, verb, complement. **Twenty words per sentence at
  most**, active voice, no inversion. A hard word is explained in the sentence that
  follows it. Many readers do not have the language as their first.
- **The subject comes first and its reference after.** Do not lead a sentence on a
  scholar, an author or a book as borrowed authority ("According to X, …").
  Contested explanations stay qualified, attributed to whoever holds them, none
  crowned. A publication year is not an event date.
- **Uncertainty travels with the claim**, on the card, not only in the caption.
- **A short, identifiable `source` on every card after the cover**, except a
  closing card that only invites.
- **Nothing internal is printed.** No "TODO", "to confirm", "claim 3", no markup.
  Gaps stay in the reservations of `idea.md`.
- **Every card has an image**, chosen from the Commons titles in `images.json`,
  referenced by `image.id`, with `image.identite`: one sentence on what the image
  shows, written without naming its author or licence.
- **Do not set `disposition`** to anything but `auto` unless you can say why.
- **A deck has 4 to 9 cards.** If the argument does not fit, narrow the question or
  split into complete pieces; never shrink the type or drop an uncertainty.

## Images, licences, citations

The licence of an image is read **by the server, from Wikimedia Commons**, never by
you. See `references/images-format.md`, `references/licences.md` and
`references/citations-format.md`. In short:

- `images.json` lists Commons file titles and why each is there. Anything else in
  it, a licence included, is ignored.
- `citations.json` gives, per claim, the source URL and an exact quote that the
  server will look for word for word. Quote the one sentence that carries the claim,
  copied, not paraphrased.
- `sources.md` lists every image and every cited source in plain text for a person
  to open.

## Captions

`captions.md` has one `## <network>` section per network of the profile, written in
that network's register (person, length, hashtags, link rules). Ask of each network
only what the profile says. The cover title is the title of the post on every
network; captions do not rephrase it. A question asked to the audience is a debt:
the caption says it will be answered.

## What this step does not do

Render. Pick a layout. Read a licence. Approve its own text. Publish.
