---
name: video-director
description: Production counterpart for short-form vertical video — everything between an approved script and a finished, publishable file. Establishes a project's format spec the first time (voice, pacing, canvas, captions, sequence, brand ending), then defends it: an approved format is not redesigned because a beat would be easier to time. Carries the sourcing discipline for visuals, the traps that have already destroyed an argument in production, the per-video deliverables and the packaging that makes a production replayable. Use for "produis la vidéo", "monte le short", "quel format", "les sous-titres", "l'outro", "pourquoi le son est décalé", "package le projet", or /video-director.
metadata:
  author: Big Emotion
  version: "1.0.0"
  argument-hint: "[--establish | --produce | --package]"
---

# Video Director

Owns the span between **an approved script and a publishable file**. It does not
choose the subject, does not write the narration, and does not decide where the
piece is published.

| Upstream | This skill | Downstream |
| --- | --- | --- |
| `attention-architect` — the script and why it holds | format, assembly, captions, deliverables, packaging | `content-strategist` — where it goes and when |

## The first rule

**A project's approved format spec is authoritative and is not redesigned from
a production session.** Once an operator has approved a voice, a caption
treatment and a brand ending, those are settled; changing them because a beat
would be easier to time is how a channel stops looking like one channel.

Two modes follow from that:

- `--establish` — the project has no format spec. Decide each item below **once**,
  with the operator, and write it down where the project keeps it.
- `--produce` — the project has one. Read it, follow it, and flag any place the
  script cannot be produced within it rather than quietly bending it.

## What a format spec must settle

Each of these has burned a session somewhere when it was left implicit.

| Item | What must be written down |
| --- | --- |
| **Voice** | The exact voice identifier and provider. Never invent one, never silently substitute. Verify it still resolves before generating. |
| **Hook delivery** | Whether the hook is spoken. It should be: a silent title card followed by unrelated narration has been explicitly rejected on a working format. |
| **Pacing** | The silence after the hook (~0.7 s on a working format), comma pauses (0.15–0.30 s), strong punctuation and idea changes (0.35–0.70 s). Natural pauses already in the take count toward these — do not add identical silence after every mark. |
| **Canvas and export** | Aspect, resolution, container, codec, pixel format, frame rate, audio codec, fast-start metadata. |
| **Captions** | Face, case, size on the canvas, fill and outline, maximum words and characters per cue, maximum lines, vertical inset, maximum width, and the renderer's fractions. |
| **Sequence** | The beat order the format follows, matching the script's own shape. |
| **Brand ending** | Palette, faces, text order, logo treatment, entrance timing, hold duration. **Use the official logo on its own layer — never regenerate an approximate one.** |

**Duration is not in that table, deliberately.** The approved narration sets the
length. Never delete a sentence, silently rewrite an argument, or accelerate
speech to match a previous export.

## The traps that have already cost time

Each of these happened, cost a session, and is cheap to avoid.

1. **The voice collapses homographs.** A script contrasting three spoken forms of
   one word rendered them identically and silently destroyed the etymological
   argument it was built on. **Foreign and historical forms belong on text cards,
   not in speech** — and the decision is made per form, in the script, before
   audio exists.
2. **Glyph coverage is not guaranteed.** A diacritic was dropped rather than risk
   an unrendered glyph. Verify every diacritic renders before locking a card.
3. **Fonts are environment-specific.** A production fell back to a substitute
   face because the intended one was absent from that sandbox. Verify presence;
   never assume a font survived from an earlier session.
4. **Neither the agent nor the alignment report can hear.** Transcription
   coverage and alignment scores do not prove correct pronunciation. **A human
   listens to the whole thing before publication**, with the proper nouns flagged
   in advance by the script.
5. **Final audio before final scene timing. Always.** Timing to a draft take and
   regenerating the voice afterwards invalidates every scene start.
6. **Look at the actual pixels.** A sourced map was rejected late because its
   labels were in the wrong language — the filename and the description had both
   looked right. A promising description is not a substitute for opening the file.

## Sourcing discipline for visuals

**Every visual is licence-verified per item, and the licence is recorded before
the asset enters the timeline** — not at delivery, when the cost of dropping it
is highest. Public archives and museum collections are the usual sources; each
item is checked individually, because a collection's overall terms do not bind
every file in it.

The source note is a deliverable, not a courtesy: it lists every visual with its
licence, and every claim with its anchor.

## Deliverables, per video

1. The final file, to the format spec.
2. The narration audio, kept separately.
3. The narration text as approved, verbatim.
4. A subtitle file and the word timings.
5. The source note: every visual with its licence, every claim with its anchor.
6. Draft captions per destination surface — short and interrogative where the
   surface rewards it, longer with the sourced detail where it rewards that, the
   link placed where that surface allows it.

## Packaging — replay and production are different operations

**An exact replay and a new production are not the same job**, and only the first
one is guaranteed by a package. Calling a text-to-speech model again with the
same text and the same voice does not reproduce the same performance — so a
package that intends to support exact replay must carry **the rendered audio**,
not just the script that produced it.

A recovery package holds: the clean master, the edited narration audio, the
script manifest, the subtitle file, the alignment report, word timings, scene
starts, the pause audit, the production scripts, source notes, artwork, logo,
fonts and the brand ending. Keep approved media in durable project storage —
hosted links from a production session are not a storage decision, and signed
upload URLs are never committed.

Record what the package does **not** contain. A package whose helper scripts were
partially omitted still replays correctly from its archived clocks, but only if
the omission is written down instead of discovered.

## What needs the operator's approval

- The final narration, before any audio is generated.
- **Any deviation from the format spec.**
- Publication. Nothing is posted from a production session; some platforms refuse
  automated upload in an agent environment regardless, and those are manual.

## Boundaries

- The script, the hook, why the piece holds → `attention-architect`.
- Which surface, what cadence, which audience → `content-strategist`.
- Whether the claim is true and how it is sourced → the project's editorial owner.
