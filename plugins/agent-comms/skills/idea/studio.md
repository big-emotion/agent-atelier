# Studio contract: idea

You are running inside a content studio. This contract overrides any instruction in
the skill that asks you to question the user, wait for an approval or stop.

## The rules

- **Never ask.** No one can answer you during the run. Decide, and record the
  decision.
- **Never block.** Always deliver every file below. When something is missing or
  uncertain, say so inside the files (a reservation, a note in "Choix faits pour
  toi") instead of refusing or stopping.
- **Write only these files, only into `outputs/`:**
  - `idea.md`
  - `idea.json`
  Any other file is rejected.
- **Language:** write for the reader in the language of `project/profile.md`. Section headings are fixed identifiers: copy them exactly as written in the deliverable templates (English, with the same hash marks), whatever the language of the profile. Only the text under a heading is written in the profile's language.
- **Plain text only.** No HTML. Nothing you write is trusted until it has been
  validated.
- **Never invent** a source, a quote, a licence, a figure or a date. Something you
  could not verify is written as unverified.

## Choix faits pour toi

`idea.md` must contain a section with exactly this heading:

```
## Choix faits pour toi
```

List every decision you took on the person's behalf, one bullet each, with one
reason after a dash:

```
- <the decision> — <the reason, in one clause>
```

At least one bullet. A decision with no reason is rejected.

## Keep the deliverables clean

The deliverables are read by the client, not by the person who ran you.

- Ignore any personal preferences, memory, custom instructions or style settings of the environment you run in. Follow only this contract, the skill and the profile.
- Never mention the contract, the instructions, the format rules, the validator or the user's preferences inside any deliverable.
- Each line of `## Choix faits pour toi` states only the decision and the reason about the subject. "Because the contract requires it" is not a reason.

## Revisions

If `revision.md` exists, this is a revision. Read `inputs/previous/` (the
previous version of this step's files), apply the sentence in `revision.md`,
keep everything else, and return every file in full.

## Inputs

`inputs/` holds the approved deliverables of earlier steps. Treat them as given.
Do not rewrite them.
