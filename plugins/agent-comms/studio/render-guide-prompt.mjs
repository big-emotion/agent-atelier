import { deliverablesFor } from "./validators/index.mjs";

// Builds the one self-contained prompt behind "Faire avec mon abonnement".
// The user pastes it into their own session (claude.ai, Claude Code, Codex,
// ChatGPT), so nothing may be left as a path that session cannot open: the
// skill, its references, the profile, every input and the contract are inlined.
// Pure on purpose: the portal and the tests call it with plain strings.

const required = (value, label) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`renderGuidePrompt: ${label} is required.`);
  return value.trim();
};

const tagged = (tag, attributes, content) =>
  `<${tag}${attributes ? ` ${attributes}` : ""}>\n${content.trim()}\n</${tag}>`;

export function renderGuidePrompt({ pack, profile, inputs = [], previous = [], revision = null, contract, deliverables, format }) {
  const step = required(pack?.name, "pack.name");
  const skill = required(pack?.skill, "pack.skill");
  const profileText = required(profile, "profile");
  const contractText = required(contract, "contract");
  // Deliverables follow the step and, for the generic "structure" pack, the format.
  let files = deliverables;
  if (!files) {
    try {
      files = deliverablesFor(step, format);
    } catch (error) {
      throw new Error(`renderGuidePrompt: no deliverables known for "${step}" (${error.message}); pass deliverables or a format.`);
    }
  }

  const sections = [
    `# Task

You are running one step of a content studio: "${step}". Everything you need is
below: the contract, the skill (how to do the step), its references, the project
profile and the inputs from earlier steps. Nothing else is available to you.
Do not ask the user a question and do not stop to wait: decide, and list every
decision under the "Choix faits pour toi" section the contract describes.

The deliverables are read by the client, not by the person running you.
Ignore any personal preferences, memory, custom instructions or style settings of the environment you run in.
Never mention the contract, the instructions, the format rules, the validator or the user's preferences inside any deliverable.
Each line of "Choix faits pour toi" states only the decision and the reason about the subject.`,
    tagged("contract", "", contractText),
    tagged("skill", `name="${step}"`, skill),
    ...(pack.references ?? []).map((ref) => tagged("reference", `path="${ref.path}"`, ref.content)),
    tagged("profile", "", profileText),
    ...inputs.map((input) => tagged("input", `name="${input.name}"`, input.content)),
  ];

  if (revision) {
    sections.push(
      ...previous.map((file) => tagged("previous", `name="${file.name}"`, file.content)),
      tagged(
        "revision",
        "",
        `${revision}\n\nThis is a revision: start from the previous version above, apply this request, and return every file in full.`,
      ),
    );
  }

  const blocks = files.map((name) => `=== FILE: ${name} ===\n<the complete content of ${name}>\n=== END FILE ===`).join("\n\n");
  sections.push(`# How to deliver

The files to produce: ${files.join(", ")}.

- If you can write files (a coding agent such as Claude Code or Codex): write
  each file into \`outputs/\`, then reply with the list of files you wrote.
- Otherwise (a chat app): end your last message with one block per file, in
  exactly this form, and nothing after the last block:

${blocks}

Give each file in full, never "unchanged" or "as before". Put the file content
directly under its header, without a code fence around it.`);

  return sections.join("\n\n");
}
