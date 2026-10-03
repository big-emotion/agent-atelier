# Content studio kit

The code and fixtures that let a product (a client portal, a CLI) run the
`agent-comms` skills as **steps with fixed deliverables**, in two ways that share
one contract.

| Step (pack) | Deliverables, fixed names |
| --- | --- |
| `idea` | `idea.md`, `idea.json` |
| `structure-carousel` | `cards.json`, `captions.md`, `sources.md`, `images.json`, `citations.json` |
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
| `load-pack.mjs` | Reads a pack directory into the shape the renderer takes. |
| `fixtures/profiles/` | One folder per project profile: `profile.md` and `terms.json` (the vocabulary that must not leak into another profile's output). |
| `fixtures/runs/fjellvik/outputs/` | A complete, valid set of deliverables for the fictional profile; the tests and `check:forbidden-terms` run on it. |
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

### Declared limits

- The validators check **shape and the rules that can be checked without a model**
  (word counts, a source on every card, ranks, cross-file references, dates). They do
  not check that a claim is true.
- Licences, Commons metadata, source reachability and quote matching are
  **server-side post-processing**, not part of this kit. `images.json` carries
  titles and reasons only; any licence written there is ignored.
- The deck size (4 to 9) and the engine's field names are those of the current
  render engine; a change there changes `cards.schema.json` and the validator together.

## Manual acceptance checklist (not run by CI)

These need a model, a key or an interactive session, so they are done by hand and
ticked in the pull request that bumps a pack.

For **each pack** (`idea`, `structure-carousel`, `audience-audit`, `content-strategist`) and for **each of two profiles**: the production profile of the first project, and a fictional profile from a different domain and language (`fixtures/profiles/fjellvik`).

- [ ] **API mode:** run the pack headless against a prepared working folder, with the
      Write-restricted tool set (no shell). Collect `outputs/`.
- [ ] **Guide mode, chat app:** build the prompt with `renderGuidePrompt`, paste it into a
      chat session with no file access, paste the answer through `parseGuideAnswer`.
- [ ] **Guide mode, coding agent:** run the same prompt in a coding-agent session and
      check it writes into `outputs/`.
- [ ] `validateStep` accepts the result of every run above (`problems` is empty).
- [ ] `node scripts/forbidden-terms.mjs --profile <name> <outputs-dir>` reports no term
      from the other profile, in both directions.
- [ ] A revision run (`revision.md` plus `inputs/previous/`) changes only what the
      sentence asks.
- [ ] `## Choix faits pour toi` lists every real decision with a reason, and no invented
      source, quote or figure appears (a person opens the sources).
- [ ] Record, per run: the model, the mode, the cost where known, and the validation result.

Chat apps other than the ones ticked above are **not** claimed as supported until a run is recorded for them.
