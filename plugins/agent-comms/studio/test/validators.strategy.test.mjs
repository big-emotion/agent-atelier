import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAudienceReport, validateIdeas, validateStrategy } from "../validators/strategy.mjs";
import { jsonFixture, readFixture } from "./helpers.mjs";

test("the reference audience report is valid", () => {
  assert.deepEqual(validateAudienceReport(readFixture("audience-report.md")), []);
});

test("an audience report must say its figure is a floor", () => {
  const md = readFixture("audience-report.md").replace("This is a floor, not the audience.", "");
  assert.ok(validateAudienceReport(md).some((p) => /floor/i.test(p)));
});

test("an audience report names each missing section and needs a dated title", () => {
  const md = readFixture("audience-report.md").replace("## Coverage", "## Misc").replace("# Audience audit — 2026-09-30", "# Report");
  const problems = validateAudienceReport(md);
  assert.ok(problems.some((p) => p.includes("Coverage")));
  assert.ok(problems.some((p) => /dated title/i.test(p)));
});

test("the reference strategy is valid on its own date", () => {
  assert.deepEqual(validateStrategy(readFixture("strategy.md")), []);
});

test("a strategy built on a report older than 30 days is refused", () => {
  const md = readFixture("strategy.md").replace("Audit report: 2026-09-30", "Audit report: 2026-08-01");
  assert.ok(validateStrategy(md).some((p) => /older than 30 days/.test(p)));
});

test("a strategy must name what it could not collect", () => {
  const md = readFixture("strategy.md").replace("## Not collected this run", "## Other");
  assert.ok(validateStrategy(md).some((p) => p.includes("Not collected this run")));
});

test("the reference ideas.json is valid", () => {
  assert.deepEqual(validateIdeas(readFixture("ideas.json")), []);
});

test("an idea with neither comparable numbers nor an admission is refused", () => {
  const ideas = jsonFixture("ideas.json");
  delete ideas.ideas[0].comparable;
  assert.ok(validateIdeas(JSON.stringify(ideas)).some((p) => /comparable/.test(p)));
});

test("a comparable that claims numbers must state them", () => {
  const ideas = jsonFixture("ideas.json");
  ideas.ideas[0].comparable = { collected: true, summary: "did well" };
  assert.ok(validateIdeas(JSON.stringify(ideas)).some((p) => /comparable\.numbers/.test(p)));
});

test("an idea needs a seed the idea step can start from", () => {
  const ideas = jsonFixture("ideas.json");
  ideas.ideas[0].seed = "";
  assert.ok(validateIdeas(JSON.stringify(ideas)).some((p) => /seed/.test(p)));
});

test("the meta-commentary rule also guards the audience report and the strategy", () => {
  const report = readFixture("audience-report.md").replace("it is the default and no other period was supplied", "the contract asks for 30 days");
  assert.ok(validateAudienceReport(report).some((p) => /contract/.test(p) && /Choix faits pour toi/.test(p)));
  const strategy = readFixture("strategy.md").replace("the report shows one dead end worth fixing first", "ma préférence de style");
  assert.ok(validateStrategy(strategy).some((p) => /préférence/.test(p)));
});
