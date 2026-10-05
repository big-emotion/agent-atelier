---
name: structure-image
description: Turns an approved subject report into a single sourced image post — an image brief (title, at most two sentences, the Wikimedia Commons picture, alt text), a caption per network, the sources and the exact quote behind the claim. Second step of the idea, structure, produce chain for the single-image format. Does not render and does not read licences itself. Use for "une image seule", "un visuel", "un post image", or /structure-image.
metadata:
  author: Big Emotion
  version: "1.0.0"
  argument-hint: "[path to idea.md / idea.json]"
---

# Structure (single image)

> **Headings are fixed.** Section headings are fixed identifiers: copy them exactly as written in the deliverable templates (English, with the same hash marks), whatever the language of the profile. Only the text under a heading is written in the profile's language.

Turns `idea.md` and `idea.json` into a one-picture post. It writes words and picks
one image title; it does **not** render, redesign a layout or read a licence.

```
idea.md + idea.json  →  structure-image  →  image.json, captions.md, sources.md,
                                            images.json, citations.json  →  produce
```

## Two ways to run it

- **Interactive:** show the title, text, alt text and captions, and ask for approval.
- **Studio** (`project/studio.md` exists): the contract wins. Never ask, never
  block, write only the five files, list every decision under
  `## Choix faits pour toi` in `captions.md`.

## What you read first

1. `inputs/idea.md` and `inputs/idea.json`. **Consume the subject report; do not
   choose a fresh argument.** A single image carries one claim: pick the one the
   sources support best and leave the rest for another format.
   **When `idea.json` carries a `plan`**, take the claim of its best-sourced step
   and leave the other steps for another format; `beforeWriting` lists what the
   idea step could not verify, and the image never states a claim that depends on
   it. Without a plan, choose the claim from the report as before.
2. `project/profile.md`: language, audience, networks and their register.
3. On a revision: `revision.md` and `inputs/previous/`.

## The rule that comes first

**Every claim carries its source, and a claim you could not read is not in the
piece.** A title-only image makes no claim and needs no source.

## The image brief: `image.json`

The shape is `references/image.schema.json`.

- **Title: eight words or fewer.** It is what most people will see.
- **`texte`: at most two short sentences**, twenty words each, subject first and
  its reference after, plain language. Optional; with it comes a `source`.
- **`alt`: required.** One description of what the picture shows, 150 characters at
  most, written for someone who cannot see it. Not "image of…", not the claim.
- **`image`:** an id from `images.json` and `identite`, one sentence on what the
  picture shows, without naming its author or licence.
- Nothing internal is printed: no "TODO", no "to confirm", no markup.

## Images, licences, citations

Exactly as for a carousel, with one image: see `references/images-format.md`,
`references/licences.md` and `references/citations-format.md`. The server reads the
licence from Wikimedia Commons; anything you write about licences is ignored. The
citation for the claim is `card: 1` with the exact words from the source.

## Captions

`captions.md` has one `## <network>` section per network of the profile, in that
network's register. Lead with the claim, name the source in the text where the
profile asks for it, and end per the profile (a question, a link, hashtags).

## What this step does not do

Render. Pick a layout. Read a licence. Approve its own text. Publish.
