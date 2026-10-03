import { validateIdeaJson, validateIdeaMd } from "./idea.mjs";
import { validateCaptions, validateCards, validateCitations, validateImages, validateSources } from "./carousel.mjs";
import { validateAudienceReport, validateIdeas, validateStrategy } from "./strategy.mjs";

export const STEP_DELIVERABLES = {
  idea: ["idea.md", "idea.json"],
  "structure-carousel": ["cards.json", "captions.md", "sources.md", "images.json", "citations.json"],
  "audience-audit": ["audience-report.md"],
  "content-strategist": ["strategy.md", "ideas.json"],
};

const VALIDATORS = {
  "idea.md": validateIdeaMd,
  "idea.json": validateIdeaJson,
  "cards.json": validateCards,
  "captions.md": validateCaptions,
  "sources.md": validateSources,
  "images.json": validateImages,
  "citations.json": validateCitations,
  "audience-report.md": validateAudienceReport,
  "strategy.md": validateStrategy,
  "ideas.json": validateIdeas,
};

// Validates every deliverable of a step against the same files, so a problem
// that lives across two files (a card pointing at a missing image) is reported
// on the file the author has to change. `ctx` may add `networks` and
// `captionLimits` from the project profile.
export function validateStep(step, files, ctx = {}) {
  const expected = STEP_DELIVERABLES[step];
  if (!expected) throw new Error(`Unknown step "${step}".`);
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
