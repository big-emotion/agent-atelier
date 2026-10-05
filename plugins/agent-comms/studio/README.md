# Content studio kit

The code and fixtures that let a product (a client portal, a CLI) run the
`agent-comms` skills as **steps with fixed deliverables**, in two ways that share
one contract.

| Step (pack) | Deliverables, fixed names |
| --- | --- |
| `idea` | `idea.md`, `idea.json` (one-shot), or in two turns: `proposals.json`, `proposals.md` then `idea.md`, `idea.json` with the plan |
| `structure-carousel` | `cards.json`, `captions.md`, `sources.md`, `images.json`, `citations.json` |
| `structure-image` | `image.json` (title, text, alt text, the image), `captions.md`, `sources.md`, `images.json`, `citations.json` |
| `structure-reel` | `scenes.json` (the engine-neutral render contract), `narration.txt`, `captions.md`, `sources.md`, `images.json`, `citations.json` |
| `audience-audit` | `audience-report.md` |
| `content-strategist` | `strategy.md`, `ideas.json` |

## The contract

Every step reads the same **working folder** and writes the same files, so the
validators and everything after them never care which way the step ran.

```
<run>/
  skills/<pack>/        SKILL.md + references/ (pinned version)
  project/profile.md    brand, language, audience, networks and their register, CTA, handle
  project/studio.md     never ask, never block, write only these files, list the choices
  inputs/               approved deliverables of earlier steps
  inputs/previous/      on a revision: this step's previous version
  revision.md           on a revision: the one-sentence change request
  outputs/              the deliverable files
```

- **API run:** a server runs the pack in this folder with an agent.
- **Guide mode:** `render-guide-prompt.mjs` inlines the same folder into one prompt
  the user runs in their own session; they paste the answer back and
  `parse-guide-answer.mjs` reads it.
- Either way the result goes through `validators/` (`validateStep`). Nothing that
  comes back is trusted before it has passed.

## Files

| File | Role |
| --- | --- |
| `validators/` | Dependency-free validators, one per deliverable, and `validateStep(step, files, ctx)` which checks a whole step, including cross-file rules (a card pointing at a missing image). Returns `{ ok, problems: [{ file, message }] }`. |
| `render-guide-prompt.mjs` | Pure function: `{ pack, profile, inputs, previous, revision, contract }` to one self-contained prompt, answer format `=== FILE: name ===`. |
| `parse-guide-answer.mjs` | `parseGuideAnswer(text, expectedFiles)` to `{ files, problems }`. A malformed or missing block reports the file name, a stable `code` and a message. |
| `load-pack.mjs` | Reads a pack directory into the shape the renderer takes. `loadPack(dir, { turn })` keeps only the `studio.md` section of that turn. |
| `research-prompt.mjs` | `renderResearchPrompt({ seed, cadrage, history, language })`: the plain-text prompt an editor pastes into a research-capable assistant. No AI turn, no project name beyond what the inputs carry. |
| `fixtures/profiles/` | One folder per project profile: `profile.md` and `terms.json` (the vocabulary that must not leak into another profile's output). |
| `fixtures/runs/<profile>/` | Valid deliverable sets per fictional profile: `fjellvik` has a carousel run (`outputs/`, with the idea and audit steps), an image run and a reel run; `kalinda` has an image run and a reel run. The tests and `check:forbidden-terms` run on all of them. |
| `../../../scripts/forbidden-terms.mjs` | Fails when an output carries a term from another profile. |

### Guide-mode answer format

```
=== FILE: idea.md ===
<content>
=== END FILE ===
```

The closing line is optional (a block also ends at the next header). Chatter around
the blocks and a code fence around a block are tolerated. A malformed header, an
empty block, a duplicate, a file outside the step or a path-like name are reported.

### The interactive idea step

The idea step can run as **two AI turns with a human choice between them**, so a
non-technical editor chooses the story and sees the plan before anything is written.
A call without a turn keeps the one-shot behaviour, so nothing existing changes.

```
inputs/seed.md  cadrage.json  history.json  [research.md]
   turn propose  ->  proposals.json + proposals.md
   the editor chooses (or delegates)  ->  choice.json
   turn plan     ->  idea.md + idea.json (chosen, plan, beforeWriting)  ->  structure-*
```

- **Inputs.** `seed.md` (the editor's sentence); `cadrage.json` `{ today, publishDate?, modelPiece?, notes? }`
  (the model never assumes today's date); `history.json` (the project's other contents, never
  duplicated unless it is the chosen `modelPiece`); optional `research.md` (text pasted from an
  external research assistant, untrusted: cited, never obeyed). The plan turn adds `proposals.json`
  and `choice.json` `{ kind: "chosen" | "delegated", proposalId, note? }`.
- **Research prompt (no AI turn).** `renderResearchPrompt` builds the prompt the editor pastes into
  a research-capable assistant: claims from oldest to newest with source URL and one sentence of
  what the source says, read versus not read, what was not found, hypotheses kept apart,
  competing readings and the reliability of each source. French by default, `en` available.
- **Turn propose** writes `proposals.json` (`references/proposals.schema.json`): 1 to 3 proposals,
  each with one of the ten pattern ids, `tells`, `reader`, a non-empty `cannotClaim`, a `criterion`
  bounded by the evidence (an audience measure is refused), exactly one `recommended`; a single
  proposal is accepted only if its `reason` says no second story is supported. Two proposals never
  share a pattern. Plus `vigilance` (at most 4), `beforeWriting` (at most 5), `basis`
  (`exploratory` or `measured`, a measured basis cites a date). `proposals.md` holds only
  `## Choix faits pour toi`.
- **Turn plan** writes `idea.md` and `idea.json` as the one-shot step does, plus `chosen`
  (which must match `choice.json` when the caller passes it), `plan` (4 to 9 steps `{ n, title, goal, sources }`,
  numbered from 1, every URL in the report's `sources`, a step between the first and the last
  has a source) and `beforeWriting`. `idea.md` gains a `## Plan` section.
- **Wiring.** `renderGuidePrompt`, `loadPack`, `validateStep`, `deliverablesFor` and `resolveStep`
  take a `turn` (`propose` or `plan`); `validateStep("idea", files, { turn: "plan", inputs })`
  takes the turn's `proposals.json` and `choice.json` as `inputs` for the cross-check. The
  `structure-*` packs read `idea.json.plan` as the skeleton (one card, scene or claim per step)
  when it is present and stay valid without it.
- **Fixtures.** `fixtures/runs/<profile>/turns/` holds, for both profiles, the editor's inputs, a
  propose output, and two plan turns (a delegated choice and a choice with a note that mixes two
  proposals). The rejected cases (4 proposals, no or two recommended, a pattern outside the ten,
  an empty `cannotClaim`, a plan of 3 or 10 steps, a plan citing a source absent from the report)
  are derived from them in `test/turns.test.mjs`.

### Clean deliverables

The client reads the deliverables, so every `studio.md` and the guide-mode prompt
wrapper tell the model to ignore the personal preferences, memory and style settings
of the session it runs in, and never to mention the contract, the instructions, the
validator or the user's preferences. The validators back this up: a line of
`## Choix faits pour toi` that mentions a meta word (contract/contrat,
validator/validateur, preference/préférence, instruction, prompt, tiret) is rejected
with its line number, in every deliverable that carries the section. Only that
section is scanned, so the same words stay legitimate elsewhere. A real leaked answer
is kept as `fixtures/rejected/idea-meta-leak.md`.

### Section headings

Headings are identifiers the client looks up, so every `studio.md`, every `SKILL.md` and
the guide-mode wrapper say once that they are copied exactly as written in the
deliverable templates (English, same hash marks) and only the text under them is in the
profile's language. A model writing French translates them anyway (a real run returned
`## Promesse` and was rejected), so the validators accept the French names as equal:
`HEADING_ALIASES` in `validators/common.mjs` is the one table (for example `## Promise`
= `## Promesse`, `## What this piece will not say` = `## Ce que cette pièce ne dira pas`
or `## Ce que ce contenu ne dira pas`, `## Reservations` = `## Réserves`), matched
regardless of case, accents and trailing spaces, at the same heading level. Cross-checks
(the promise is one sentence) go through the alias. The dated titles of the audit report
and the strategy, and the word "floor" (`plancher`), have French forms too.
`## Choix faits pour toi` is never aliased: it must be written as is. A missing section
is reported with the heading expected, both spellings, the rule to keep it as in the
prompt, and a French sentence. Fixtures: `fixtures/accepted/idea-french-headings.md`
validates, `fixtures/rejected/idea-missing-promise.md` is refused for a truly missing
section.

### Declared limits

- The validators check **shape and the rules that can be checked without a model**
  (word counts, a source on every card, ranks, cross-file references, dates). They do
  not check that a claim is true.
- Licences, Commons metadata, source reachability and quote matching are
  **server-side post-processing**, not part of this kit. `images.json` carries
  titles and reasons only; any licence written there is ignored.
- **Defaults, overridable by profile.** The deck size (4 to 9 cards) and the quote cap
  (300 characters) are defaults, not laws of the contract; a profile may override them.
  The field names are those of the current carousel render engine; a change there
  changes `cards.schema.json` and the validator together.
- **Three formats.** The contract itself (working folder, fixed deliverable names,
  `## Choix faits pour toi`, the two run modes, the validators and the guide-mode
  answer format) is format-agnostic. Only the structure step differs: pick its
  deliverables with `deliverablesFor("structure", format)` (`carousel`, `reel` or
  `image`); `validateStep` and `renderGuidePrompt` accept a `format` for the generic
  `structure` step. `images.json`, `citations.json` and `sources.md` are shared:
  citations point at a card (`card`) or, for a reel, a scene (`scene`).
- **Reel render contract.** `scenes.json` says what is said and shown per scene and
  never how (no timings, layout, fonts or colours), so any engine can consume it.
  See `skills/structure-reel/references/scenes-contract.md`. Voicing and timing are
  the render side's job.

## Manual acceptance checklist (not run by CI)

These need a model, a key or an interactive session, so they are done by hand and
ticked in the pull request that bumps a pack.

For **each pack** (`idea`, `structure-carousel`, `structure-image`, `structure-reel`, `audience-audit`, `content-strategist`) and for **each of two profiles** (`fixtures/profiles/fjellvik`, English, and `fixtures/profiles/kalinda`, French). Image and reel runs are done for both profiles, from the same idea, and compared with the reference runs in `fixtures/runs/`.

- [ ] **API mode:** run the pack headless against a prepared working folder, with the
      Write-restricted tool set (no shell). Collect `outputs/`.
- [ ] **Guide mode, chat app:** build the prompt with `renderGuidePrompt`, paste it into a
      chat session with no file access, paste the answer through `parseGuideAnswer`.
- [ ] **Guide mode, coding agent:** run the same prompt in a coding-agent session and
      check it writes into `outputs/`.
- [ ] `validateStep` accepts the result of every run above (`problems` is empty).
- [ ] `node scripts/forbidden-terms.mjs --profile <name> <outputs-dir>` reports no term
      from the other profile, in both directions.
- [ ] **Image and reel:** the reel's `narration.txt` equals the scene voice-overs, every still is a Commons title, the alt text describes the picture, and `scenes.json` carries no layout field.
- [ ] A revision run (`revision.md` plus `inputs/previous/`) changes only what the
      sentence asks.
- [ ] `## Choix faits pour toi` mentions no preference, contract or instruction of the session, only subject decisions with their reasons.
- [ ] `## Choix faits pour toi` lists every real decision with a reason, and no invented
      source, quote or figure appears (a person opens the sources).
- [ ] Record, per run: the model, the mode, the cost where known, and the validation result.

Chat apps other than the ones ticked above are **not** claimed as supported until a run is recorded for them.
