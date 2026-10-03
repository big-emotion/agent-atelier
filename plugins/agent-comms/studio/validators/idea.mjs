import {
  isHttpUrl,
  isNonEmptyString,
  parseJson,
  requireHeadings,
  sectionBody,
  splitSentences,
  validateChoicesSection,
} from "./common.mjs";

const BASES = ["dated-evidence", "exploratory"];
const FORMATS = ["carousel"];

export function validateIdeaJson(text) {
  const parsed = parseJson(text, "idea.json");
  if (parsed.problems) return parsed.problems;
  const idea = parsed.value;
  const problems = [];

  for (const field of ["question", "angle", "promise", "audience"]) {
    if (!isNonEmptyString(idea[field])) problems.push(`${field} is required.`);
  }
  if (isNonEmptyString(idea.promise) && splitSentences(idea.promise).length !== 1) {
    problems.push("promise must be exactly one sentence.");
  }

  // A hook the sources cannot pay off is bait: the payoff names where it is paid.
  if (!isNonEmptyString(idea.hook?.text)) problems.push("hook.text is required.");
  if (!isNonEmptyString(idea.hook?.payoff)) {
    problems.push("hook.payoff is required: say where the sources pay the hook off, or drop the hook.");
  }

  if (!Array.isArray(idea.wontSay) || idea.wontSay.length === 0 || !idea.wontSay.every(isNonEmptyString)) {
    problems.push("wontSay must list at least one thing the piece will not claim.");
  }

  if (!Array.isArray(idea.sources) || idea.sources.length === 0) {
    problems.push("sources must list at least one source.");
  } else {
    idea.sources.forEach((source, index) => {
      if (!isNonEmptyString(source?.title)) problems.push(`sources[${index}].title is required.`);
      if (!isHttpUrl(source?.url)) problems.push(`sources[${index}].url must be an http(s) URL.`);
      if (!isNonEmptyString(source?.supports)) problems.push(`sources[${index}].supports is required.`);
    });
  }

  if (!Array.isArray(idea.reservations) || !idea.reservations.every(isNonEmptyString)) {
    problems.push("reservations must be a list of strings (empty only if nothing can fail the piece).");
  }

  if (!Array.isArray(idea.formats) || idea.formats.length === 0 || !idea.formats.every((f) => FORMATS.includes(f))) {
    problems.push(`formats must be a non-empty list drawn from: ${FORMATS.join(", ")}.`);
  }
  if (!Array.isArray(idea.networks) || idea.networks.length === 0 || !idea.networks.every(isNonEmptyString)) {
    problems.push("networks must list at least one network from the profile.");
  }

  if (!BASES.includes(idea.basis)) {
    problems.push(`basis must be one of: ${BASES.join(", ")}.`);
  } else if (!isNonEmptyString(idea.basisReason)) {
    problems.push("basisReason is required.");
  } else if (idea.basis === "dated-evidence" && !/\d{4}-\d{2}-\d{2}/.test(idea.basisReason)) {
    problems.push("basisReason must cite the date (YYYY-MM-DD) of the audience report for dated-evidence.");
  }

  return problems;
}

const IDEA_SECTIONS = [
  "## Question",
  "## Angle",
  "## Promise",
  "## What this piece will not say",
  "## Sources",
  "## Reservations",
];

export function validateIdeaMd(text) {
  const problems = requireHeadings(text, IDEA_SECTIONS);
  if (!/^# \S/m.test(text)) problems.push('Missing the working title ("# <title>").');
  const promise = sectionBody(text, "## Promise");
  if (promise && splitSentences(promise).length !== 1) problems.push('The "Promise" section must be exactly one sentence.');
  return [...problems, ...validateChoicesSection(text)];
}
