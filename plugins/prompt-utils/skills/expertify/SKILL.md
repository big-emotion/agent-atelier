---
name: expertify
description: Identify the precise professional role behind a topic or rough prompt, map lay wording to the field's proper terminology, and rewrite the prompt as an expert-grade prompt prefixed with "You are a <role>, and you will <mission>". Use when the user invokes /expertify, asks "what's the proper term for…", "what do you call the person/role who…", or wants their prompt upgraded with the right domain vocabulary before asking it.
argument-hint: <rough prompt, topic, or fuzzy role description>
---

# Expertify — proper role + domain terminology

Turn a layperson's prompt into an expert-grade prompt: find the professional role that owns the subject, swap lay wording for the field's established terminology, and produce a rewritten prompt that opens with a persona line.

## Input

`$ARGUMENTS` is one of:

- a **rough prompt** the user intends to ask ("help me make my website load faster on phones"),
- a **topic** they want the vocabulary for ("retirement savings in France"),
- a **fuzzy role description** ("the person who decides which features get built").

If `$ARGUMENTS` is empty, ask the user for the prompt or topic to expertify, then proceed.

## Workflow

### 1. Identify the domain and the role

- Extract the subject domain from the input. If the input describes a person/function rather than a subject, map the description to the actual job title.
- Pick **one primary role** — the most precise title an expert in this exact question would hold. Prefer the specific over the generic: "ophthalmologist" over "eye doctor", "SRE" over "sysadmin", "notaire" over "legal person", "conversion rate optimizer" over "marketing person".
- If two roles genuinely split the subject, keep one as primary and mention the alternative in one line.

### 2. Verify when unsure

- Mainstream domain and you are confident → use your own knowledge, no search.
- Niche domain, ambiguous role, possibly evolved terminology, or country-specific titles (FR vs EN job markets differ) → run 1–2 web searches (e.g. `<domain> job titles`, `<domain> glossary terminology`) and cross-check before answering. Do not over-search; two queries max unless results conflict.

### 3. Build the terminology map

- List the lay terms in the user's input and pair each with the field's proper term.
- Add the key concepts an expert would name that the user did not know to ask about — these are often the most valuable entries.
- 6–12 entries. Every entry must be relevant to the actual input; no glossary padding.
- Never invent jargon. If no established term exists for something, say so explicitly.

### 4. Rewrite the prompt

- **Line 1 — persona**: `You are a <precise role title>, and you will <the user's goal restated in expert terms>.`
- **Body**: the user's original intent, scope, and constraints preserved exactly — only the vocabulary is upgraded. Never add requirements, never drop any, no scope creep. The rewrite must remain something the user could have written themselves.
- **Language**: same language as the user's original input (French stays French). Keep established English technical terms where the French field genuinely uses them (e.g. "product manager", "load time").
- If the input was only a topic or role description (no actual prompt to rewrite), skip the rewrite body and provide the persona line as a ready-to-use prompt opener instead.

### 5. Output

Present in this order:

1. **Role** — the title plus one line on what this role owns.
2. **Terminology** — a table: `Your wording | Proper term | What it means`. Concepts the user didn't mention go in with `—` in the first column.
3. **Rewritten prompt** — in a fenced code block, copy-paste ready.
4. *(optional)* One line on the alternative role, if any.

### 6. Ask before executing

After presenting the output, **always ask** the user whether to execute the rewritten prompt now in this session (use AskUserQuestion: "Execute the rewritten prompt now?" — Yes / No). If yes, treat the rewritten prompt as the user's new instruction and carry it out. If no, stop — the deliverable was the rewrite itself.
