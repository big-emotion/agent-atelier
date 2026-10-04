import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HEADING_ALIASES, CHOICES_HEADING, acceptedHeadings } from "../validators/common.mjs";
import { validateIdeaMd } from "../validators/idea.mjs";
import { validateAudienceReport, validateStrategy } from "../validators/strategy.mjs";
import { validateCaptions } from "../validators/carousel.mjs";
import { renderGuidePrompt } from "../render-guide-prompt.mjs";
import { readFixture, studioDir } from "./helpers.mjs";

const fixture = (...path) => readFileSync(join(studioDir, "fixtures", ...path), "utf8");

// Replaces every heading that has aliases by its first alias, as a translating model would.
const translateHeadings = (markdown) =>
  markdown.replace(/^(#{1,6}) (.+?)\s*$/gm, (line, hashes, text) => {
    const alias = HEADING_ALIASES[`${hashes} ${text}`]?.[0];
    return alias ? `${hashes} ${alias}` : line;
  });

test("the alias table maps each English idea heading to its French name", () => {
  assert.deepEqual(HEADING_ALIASES["## Promise"], ["Promesse"]);
  assert.deepEqual(HEADING_ALIASES["## What this piece will not say"], [
    "Ce que cette pièce ne dira pas",
    "Ce que ce contenu ne dira pas",
  ]);
  assert.deepEqual(HEADING_ALIASES["## Reservations"], ["Réserves", "Réservations"]);
  assert.deepEqual(HEADING_ALIASES["## Question"], ["Question"]);
  assert.equal(HEADING_ALIASES[CHOICES_HEADING], undefined, "the choices heading is never translated");
  assert.deepEqual(acceptedHeadings("## Promise"), ["## Promise", "## Promesse"]);
});

test("an idea.md with French section headings is accepted", () => {
  assert.deepEqual(validateIdeaMd(fixture("accepted", "idea-french-headings.md")), []);
});

test("the alternative French wording of the will-not-say heading is accepted", () => {
  const text = fixture("accepted", "idea-french-headings.md").replace("Ce que cette pièce", "Ce que ce contenu");
  assert.deepEqual(validateIdeaMd(text), []);
});

test("heading matching ignores case, accents and trailing spaces", () => {
  const text = fixture("accepted", "idea-french-headings.md")
    .replace("## Promesse", "## PROMESSE   ")
    .replace("## Réserves", "## reserves")
    .replace("## Angle", "## angle");
  assert.deepEqual(validateIdeaMd(text), []);
});

test("a heading at another level is not the heading", () => {
  const text = fixture("accepted", "idea-french-headings.md").replace("## Promesse", "### Promesse");
  assert.ok(validateIdeaMd(text).some((p) => /Missing section "## Promise"/.test(p)));
});

test("the one-sentence rule applies to the promise under its French heading", () => {
  const text = fixture("accepted", "idea-french-headings.md").replace(
    "Tu sauras ce qui ferme vraiment la route et quand elle rouvre.",
    "Tu sauras. Tu partageras.",
  );
  assert.ok(validateIdeaMd(text).some((p) => /Promise.*exactly one sentence/i.test(p)));
});

test("a truly missing section says the heading expected, both spellings and to keep it as in the prompt", () => {
  const [problem, ...others] = validateIdeaMd(fixture("rejected", "idea-missing-promise.md"));
  assert.deepEqual(others, []);
  assert.match(problem, /^Missing section "## Promise"/);
  assert.ok(problem.includes('"## Promesse"'), problem);
  assert.match(problem, /exactly as written in the prompt/i);
  assert.match(problem, /Il manque la section « Promesse »/);
});

test("a missing section without a French alias still tells the author to keep the heading", () => {
  const text = fixture("accepted", "idea-french-headings.md").replace("## Sources", "## Bibliographie");
  const [problem] = validateIdeaMd(text);
  assert.match(problem, /^Missing section "## Sources"/);
  assert.match(problem, /exactly as written in the prompt/i);
});

test("every heading of the reference idea.md, audit report and strategy validates once translated", () => {
  assert.deepEqual(validateIdeaMd(translateHeadings(readFixture("idea.md"))), []);
  assert.deepEqual(validateAudienceReport(translateHeadings(readFixture("audience-report.md"))), []);
  assert.deepEqual(validateStrategy(translateHeadings(readFixture("strategy.md"))), []);
  assert.notEqual(translateHeadings(readFixture("audience-report.md")), readFixture("audience-report.md"));
});

test("a French-titled audit report and strategy are accepted, a missing section is explained", () => {
  const report = translateHeadings(readFixture("audience-report.md"))
    .replace("# Audience audit —", "# Audit d'audience —")
    .replace(/\bfloor\b/g, "plancher");
  assert.deepEqual(validateAudienceReport(report), []);

  const strategy = translateHeadings(readFixture("strategy.md"))
    .replace("# Content strategy —", "# Stratégie de contenu —")
    .replace("Audit report:", "Rapport d'audit :");
  assert.deepEqual(validateStrategy(strategy), []);

  const broken = strategy.replace(/^## Plan\s*$/m, "## Programme");
  assert.ok(validateStrategy(broken).some((p) => /^Missing section "## Plan"/.test(p) && /Il manque la section/.test(p)));
});

test("the choices heading must stay exactly as written, and its absence is explained", () => {
  const text = fixture("accepted", "idea-french-headings.md").replace("## Choix faits pour toi", "## Choices");
  const problems = validateIdeaMd(text);
  assert.ok(problems.some((p) => p.startsWith(`Missing section "${CHOICES_HEADING}"`) && /Il manque la section/.test(p)), problems.join("\n"));
  assert.ok(validateCaptions("# Captions\n\n## Instagram\n\nA caption.\n").some((p) => /Il manque la section/.test(p)));
});

test("the guide prompt wrapper says headings are fixed identifiers and only the text is translated", () => {
  const pack = { name: "idea", skill: "SKILL", references: [] };
  const prompt = renderGuidePrompt({ pack, profile: "PROFILE", contract: "CONTRACT" });
  assert.match(prompt, /Section headings are fixed identifiers/);
  assert.match(prompt, /exactly as written in the deliverable templates/);
  assert.match(prompt, /only the text under a heading is written in the profile's language/i);
});
