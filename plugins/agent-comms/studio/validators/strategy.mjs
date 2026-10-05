import {
  isNonEmptyString,
  parseJson,
  hasHeading,
  missingSectionMessage,
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
  if (!/^# (Audience audit|Audit d['’]audience) [—–-] \d{4}-\d{2}-\d{2}\s*$/m.test(text)) {
    problems.push(
      'Missing the dated title ("# Audience audit — YYYY-MM-DD", or "# Audit d\'audience — YYYY-MM-DD"). (Il manque le titre daté : garde le format du prompt.)',
    );
  }
  // Consent-gated analytics undercount; the downstream strategist must never read the figure as the audience.
  if (!/\b(floor|plancher)\b/i.test(text)) {
    problems.push('The report must say the measured figure is a floor ("plancher"), not the audience. (Dis que le chiffre mesuré est un plancher, pas l\'audience.)');
  }
  if (!hasHeading(text, "### For content-strategist")) problems.push(missingSectionMessage("### For content-strategist"));
  return [...problems, ...validateChoicesSection(text)];
}

export function validateStrategy(text) {
  const problems = requireHeadings(text, ["## Plan", "## Not collected this run"]);
  const date = dateOf(text, /^# (?:Content strategy|Strat[ée]gie de contenu) [—–-] (\d{4}-\d{2}-\d{2})\s*$/m);
  const reportDate = dateOf(text, /^(?:Audit report|Rapport d['’]audit) ?: (\d{4}-\d{2}-\d{2})\s*$/m);
  if (!date) {
    problems.push(
      'Missing the dated title ("# Content strategy — YYYY-MM-DD", or "# Stratégie de contenu — YYYY-MM-DD"). (Il manque le titre daté : garde le format du prompt.)',
    );
  }
  if (!reportDate) {
    problems.push('Missing the line "Audit report: YYYY-MM-DD", or "Rapport d\'audit : YYYY-MM-DD". (Il manque la ligne de la date du rapport d\'audit.)');
  }
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
