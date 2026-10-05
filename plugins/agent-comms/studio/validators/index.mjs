import { validateIdeaJson, validateIdeaMd } from "./idea.mjs";
import { validateProposalsJson, validateProposalsMd } from "./proposals.mjs";
import { validateCaptions, validateCards, validateCitations, validateImages, validateSources } from "./carousel.mjs";
import { validateImageJson, validateNarration, validateScenes } from "./formats.mjs";
import { validateAudienceReport, validateIdeas, validateStrategy } from "./strategy.mjs";

export const STEP_DELIVERABLES = {
  idea: ["idea.md", "idea.json"],
  "structure-carousel": ["cards.json", "captions.md", "sources.md", "images.json", "citations.json"],
  "structure-image": ["image.json", "captions.md", "sources.md", "images.json", "citations.json"],
  "structure-reel": ["scenes.json", "narration.txt", "captions.md", "sources.md", "images.json", "citations.json"],
  "audience-audit": ["audience-report.md"],
  "content-strategist": ["strategy.md", "ideas.json"],
};

// The idea step can run as two AI turns with the editor's choice in between.
// A call without a turn is the one-shot step above.
export const TURNS = { idea: ["propose", "plan"] };
export const TURN_DELIVERABLES = {
  idea: {
    propose: ["proposals.json", "proposals.md"],
    plan: ["idea.md", "idea.json"],
  },
};

const VALIDATORS = {
  "proposals.md": validateProposalsMd,
  "proposals.json": validateProposalsJson,
  "idea.md": validateIdeaMd,
  "idea.json": validateIdeaJson,
  "cards.json": validateCards,
  "captions.md": validateCaptions,
  "sources.md": validateSources,
  "images.json": validateImages,
  "citations.json": validateCitations,
  "image.json": validateImageJson,
  "scenes.json": validateScenes,
  "narration.txt": validateNarration,
  "audience-report.md": validateAudienceReport,
  "strategy.md": validateStrategy,
  "ideas.json": validateIdeas,
};

export const FORMATS = ["carousel", "reel", "image"];

// The generic "structure" step takes its deliverables from the format of the
// piece; every other step is format-independent.
export function resolveStep(step, format, turn) {
  if (turn !== undefined && turn !== null) {
    if (!TURNS[step]?.includes(turn)) {
      const where = TURNS[step] ? `step "${step}" has the turns ${TURNS[step].join(", ")}` : `step "${step}" has no turns`;
      throw new Error(`Unknown turn "${turn}": ${where}.`);
    }
    return `${step}:${turn}`;
  }
  if (step !== "structure") return step;
  if (!FORMATS.includes(format)) throw new Error(`Step "structure" needs a format: ${FORMATS.join(", ")}.`);
  return `structure-${format}`;
}

export function deliverablesFor(step, format, turn) {
  const resolved = resolveStep(step, format, turn);
  const [turnStep, turnName] = resolved.split(":");
  const names = turnName ? TURN_DELIVERABLES[turnStep][turnName] : STEP_DELIVERABLES[resolved];
  if (!names) throw new Error(`Unknown step "${resolved}".`);
  return names;
}

// Validates every deliverable of a step against the same files, so a problem
// that lives across two files (a card pointing at a missing image) is reported
// on the file the author has to change. `ctx` may add `networks` and
// `captionLimits` from the project profile.
export function validateStep(step, files, ctx = {}) {
  const expected = deliverablesFor(step, ctx.format, ctx.turn);
  const problems = [];

  for (const name of Object.keys(files)) {
    if (!expected.includes(name)) problems.push({ file: name, message: "This file is not part of this step." });
  }
  for (const name of expected) {
    if (typeof files[name] !== "string") {
      problems.push({ file: name, message: "Missing file." });
      continue;
    }
    for (const message of VALIDATORS[name](files[name], { ...ctx, files })) problems.push({ file: name, message });
  }
  return { ok: problems.length === 0, problems };
}

export { validateProfile } from "./profile.mjs";
