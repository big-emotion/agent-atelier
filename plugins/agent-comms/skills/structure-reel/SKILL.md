---
name: structure-reel
description: Turns an approved subject report into a short vertical reel plan — the script as scenes (voice-over, on-screen caption text, a source on every claim), the full narration, a shot list of Wikimedia Commons stills or text cards, a caption per network, the sources and the exact quotes. Second step of the idea, structure, produce chain for the reel format. Does not render, voice or read licences itself. Use for "écris le reel", "script de la vidéo", "découpe en scènes", or /structure-reel.
metadata:
  author: Big Emotion
  version: "1.0.0"
  argument-hint: "[path to idea.md / idea.json]"
---

# Structure (reel)

> **Headings are fixed.** Section headings are fixed identifiers: copy them exactly as written in the deliverable templates (English, with the same hash marks), whatever the language of the profile. Only the text under a heading is written in the profile's language.

Turns `idea.md` and `idea.json` into a scene-by-scene reel plan the render side can
consume. It writes the script and the shot list; it does **not** voice, time,
render or read a licence.

```
idea.md + idea.json  →  structure-reel  →  scenes.json, narration.txt, captions.md,
                                           sources.md, images.json, citations.json  →  produce
```

## Two ways to run it

- **Interactive:** show the complete narration and the shot list together and ask
  for approval of the full text before calling the step done.
- **Studio** (`project/studio.md` exists): the contract wins. Never ask, never
  block, write only the six files, list every decision under
  `## Choix faits pour toi` in `captions.md`.

## What you read first

1. `inputs/idea.md` and `inputs/idea.json`. **Consume the subject report; do not
   choose a fresh argument.** A scene that cannot be written from the sources goes
   back as a reservation; never pad it with an invented source, date or image.
2. `project/profile.md`: language, audience, networks and register.
3. On a revision: `revision.md` and `inputs/previous/`.

## The rule that comes first

**Every claim carries its source, and a claim you could not read is not in the
piece.** The hook asks and the closing invites; every `body` scene states
something, so it carries a `source` and a citation.

## The script: `scenes.json`

The contract is `references/scenes-contract.md`, the shape is
`references/reel.schema.json`. In short:

- **3 to 12 scenes.** The first has role `hook`, the last `closing`, the others `body`.
- **Voice-over:** plain language, twenty words per sentence at most, active voice,
  subject first and its reference after. Write it to be heard: no inversion, no
  parenthesis, a foreign word only where the voice will say it correctly.
- **No duration.** The recording sets the timing, never the reverse.
- **`captionText`:** what is shown as a caption for the scene, short.
- **A shot per scene:** either a Commons still (`kind: "still"`, `imageId` from
  `images.json`, `identite`) or a text card (`kind: "textcard"`, 12 words at most).
  Use a text card when no suitable still exists: never an invented image.
- **Title: eight words or fewer**, also the title of the post on every network.
- **The hook is answered by the first body scene** and its debt is paid before the
  closing. Never open a loop the sources cannot close.
- **The closing connects to the project and invites**; it carries no source.

## `narration.txt`

The full voice-over: exactly the `voiceover` of every scene, in order, one per
line, nothing else. It is checked against `scenes.json`.

## Images, licences, citations

Stills come from Wikimedia Commons only; the server reads the licence. See
`references/images-format.md`, `references/licences.md`,
`references/citations-format.md`. Citations use `scene` (the scene `id`), not `card`.

## Captions

`captions.md`: one `## <network>` section per network of the profile, in that
network's register. The reel's title is the title of the post; captions do not
rephrase it.

## What this step does not do

Voice, time, caption-burn or render. Read a licence. Approve its own text. Publish.
