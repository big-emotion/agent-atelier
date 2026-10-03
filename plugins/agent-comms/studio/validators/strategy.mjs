import {
  isNonEmptyString,
  parseJson,
  requireHeadings,
  validateChoicesSection,
} from "./common.mjs";

const DAY_MS = 86_400_000;
const MAX_REPORT_AGE_DAYS = 30;

const dateOf = (text, pattern) => pattern.exec(text)?.[1] ?? null;
const daysBetween = (earlier, later) => (Date.parse(later) - Date.parse(earlier)) / DAY_MS;

const REPORT_SECTIONS = [
  "## Headline",
  "## Acquisition",
  "## Devices",
  "## Page verdicts",
  "## Coverage",
  "## Findings",
  "## Handoffs",
];

export function validateAudienceReport(text) {
  const problems = requireHeadings(text, REPORT_SECTIONS);
  if (!/^# Audience audit — \d{4}-\d{2}-\d{2}\s*$/m.test(text)) {
    problems.push('Missing the dated title ("# Audience audit — YYYY-MM-DD").');
  }
  // Consent-gated analytics undercount; the downstream strategist must never read the figure as the audience.
  if (!/\bfloor\b/i.test(text)) problems.push('The report must say the measured figure is a floor, not the audience.');
  if (!/^### For content-strategist\s*$/m.test(text)) problems.push('Missing the handoff "### For content-strategist".');
  return [...problems, ...validateChoicesSection(text)];
}

export function validateStrategy(text) {
  const problems = requireHeadings(text, ["## Plan", "## Not collected this run"]);
  const date = dateOf(text, /^# Content strategy — (\d{4}-\d{2}-\d{2})\s*$/m);
  const reportDate = dateOf(text, /^Audit report: (\d{4}-\d{2}-\d{2})\s*$/m);
  if (!date) problems.push('Missing the dated title ("# Content strategy — YYYY-MM-DD").');
  if (!reportDate) problems.push('Missing the line "Audit report: YYYY-MM-DD".');
  if (date && reportDate && daysBetween(reportDate, date) > MAX_REPORT_AGE_DAYS) {
    problems.push(`The audit report is older than ${MAX_REPORT_AGE_DAYS} days: run the audience step again first.`);
  }
  return [...problems, ...validateChoicesSection(text)];
}

export function validateIdeas(text) {
  const parsed = parseJson(text, "ideas.json");
  if (parsed.problems) return parsed.problems;
  const ideas = parsed.value.ideas;
  if (!Array.isArray(ideas) || ideas.length === 0) return ["ideas must list at least one idea."];
  const problems = [];

  ideas.forEach((idea, index) => {
    const at = `ideas[${index}]`;
    if (!isNonEmptyString(idea?.title)) problems.push(`${at}.title is required.`);
    // The seed is what the idea step starts from, so it must stand on its own.
    if (!isNonEmptyString(idea?.seed)) problems.push(`${at}.seed is required: one or two sentences the idea step can start from.`);
    if (!Array.isArray(idea?.channels) || idea.channels.length === 0) problems.push(`${at}.channels must list at least one channel.`);
    if (!isNonEmptyString(idea?.reason)) problems.push(`${at}.reason is required.`);

    // A subject never leaves without its comparable's numbers, or an admission they were never collected.
    const comparable = idea?.comparable;
    if (comparable?.collected === false) {
      if (!isNonEmptyString(comparable.note)) problems.push(`${at}.comparable.note is required when nothing was collected.`);
    } else if (comparable?.collected === true) {
      if (!isNonEmptyString(comparable.summary)) problems.push(`${at}.comparable.summary is required.`);
      if (!isNonEmptyString(comparable.numbers)) problems.push(`${at}.comparable.numbers is required: state the figures.`);
    } else {
      problems.push(`${at}.comparable is required: { collected: true, summary, numbers } or { collected: false, note }.`);
    }
  });
  return problems;
}
