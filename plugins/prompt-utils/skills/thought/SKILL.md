---
name: thought
description: Capture a surprising model answer as a thought entry. Synthesizes the last answer with context, saves as a granular file, and auto-updates the TLDR.
---

# Thought — Capture Surprising Insights

Capture a model answer that surprised you during an exploration conversation. The skill synthesizes the answer with its context, saves it as a granular entry, and updates the TL;DR synthesis file.

**This skill is non-interrupting.** After the thought is saved, resume the conversation exactly where it was — do not change topic or add commentary about the save.

**Directory:** `~/thoughts/` — created on first save; set the `THOUGHTS_DIR` environment variable to override.

## When to Activate

- User triggers `/thought` during a conversation
- The user just read something in your last answer that surprised them — something they were NOT thinking before

## Steps

### Step 1: Synthesize the Last Answer

Look at your **most recent substantive answer** in the conversation (the one just before the user triggered `/thought`).

Produce a synthesis with two parts:

1. **Context** (3-5 sentences max):
   - What the exploration was about (the thread/topic)
   - The specific question or angle that led to the surprising answer

2. **Thought** (3-8 sentences max):
   - The synthesized insight from the model's answer
   - Focus on **what was surprising or non-obvious** — not a generic summary
   - Write in a way that will make sense when re-read weeks later without the full conversation

### Step 2: Present for Confirmation

Show the synthesis to the user in this format:

```
**Context:** [context text]

**Thought:** [thought text]

**Suggested subject:** [1-2 word subject tag, or "none"]
```

Then ask: "Save this? You can: **accept**, **reframe** (tell me what to change), or **cancel**. You can also change or skip the subject."

Wait for the user's response. If they ask to reframe, adjust and present again. If they cancel, stop — resume conversation.

### Step 3: Save the Entry

On confirmation:

1. **Determine the filename:**
   - Format: `YYYY-MM-DD-subject-slug.md` (e.g., `2026-04-06-emergent-patterns.md`)
   - If no subject: `YYYY-MM-DD-untitled.md`
   - If filename already exists, append `-2`, `-3`, etc.

2. **Write the entry file** to the thoughts directory (see **Directory** above):

```markdown
---
subject: [subject or empty]
date: YYYY-MM-DD
---

## Context
[Context text from step 2]

## Thought
[Thought text from step 2]
```

3. **Update TLDR.md** — Read the existing `TLDR.md` in the thoughts directory, then append or update:
   - If the subject already has a section in TLDR.md, add a bullet under it
   - If the subject is new or empty, add under a "## Uncategorized" section (create it if needed)
   - Each bullet is a one-line distillation of the thought with the date: `- **YYYY-MM-DD** — [one-line distillation]`
   - If TLDR.md doesn't exist, create it with a `# Thoughts` heading

### Step 4: Resume Conversation

After saving, confirm briefly: "Saved to `[filename]`."

Then **immediately resume the conversation** where it was before `/thought` was triggered. Do not linger on the save. The user's exploration flow must not be broken.

## Important Rules

- **Never interrupt the conversation flow** — the save is a side action
- **The synthesis must capture surprise** — if it reads like a generic summary, it's wrong
- **Keep it concise** — the user will re-read these entries; brevity is respect for future-self
- **TLDR.md is append-only** (unless reorganizing subjects) — never delete existing entries
