import { test } from "node:test";
import assert from "node:assert/strict";
import { validateIdeaJson, validateIdeaMd } from "../validators/idea.mjs";
import { jsonFixture, readFixture } from "./helpers.mjs";

const breakIdea = (mutate) => {
  const idea = jsonFixture("idea.json");
  mutate(idea);
  return JSON.stringify(idea);
};

test("the reference idea.json is valid", () => {
  assert.deepEqual(validateIdeaJson(readFixture("idea.json")), []);
});

test("idea.json that is not JSON reports a parse problem", () => {
  const [problem] = validateIdeaJson("{ nope");
  assert.match(problem, /not valid JSON/i);
});

test("a promise that is two sentences is refused", () => {
  const problems = validateIdeaJson(
    breakIdea((idea) => (idea.promise = "You will know. You will share it.")),
  );
  assert.ok(problems.some((p) => /promise.*one sentence/i.test(p)), problems.join("\n"));
});

test("a hook with no payoff is bait and is refused", () => {
  const problems = validateIdeaJson(breakIdea((idea) => (idea.hook.payoff = "")));
  assert.ok(problems.some((p) => /hook\.payoff/.test(p)));
});

test("a piece with no source cannot pay off its hook", () => {
  const problems = validateIdeaJson(breakIdea((idea) => (idea.sources = [])));
  assert.ok(problems.some((p) => /sources/.test(p)));
});

test("every source needs an http(s) url", () => {
  const problems = validateIdeaJson(
    breakIdea((idea) => (idea.sources[0].url = "see the plan")),
  );
  assert.ok(problems.some((p) => /sources\[0\]\.url/.test(p)));
});

test("what the piece will not say must be listed", () => {
  const problems = validateIdeaJson(breakIdea((idea) => (idea.wontSay = [])));
  assert.ok(problems.some((p) => /wontSay/.test(p)));
});

test("dated-evidence basis must cite a date, exploratory must give a reason", () => {
  const dated = validateIdeaJson(
    breakIdea((idea) => {
      idea.basis = "dated-evidence";
      idea.basisReason = "the last report";
    }),
  );
  assert.ok(dated.some((p) => /basisReason.*date/i.test(p)));

  const exploratory = validateIdeaJson(breakIdea((idea) => (idea.basisReason = "")));
  assert.ok(exploratory.some((p) => /basisReason/.test(p)));

  const unknown = validateIdeaJson(breakIdea((idea) => (idea.basis = "gut feeling")));
  assert.ok(unknown.some((p) => /basis/.test(p)));
});

test("formats are carousel, reel or image", () => {
  const problems = validateIdeaJson(breakIdea((idea) => (idea.formats = ["podcast"])));
  assert.ok(problems.some((p) => /formats/.test(p)));
});

test("the reference idea.md is valid", () => {
  assert.deepEqual(validateIdeaMd(readFixture("idea.md")), []);
});

test("idea.md names each missing section", () => {
  const md = readFixture("idea.md").replace("## What this piece will not say", "## Misc");
  const problems = validateIdeaMd(md);
  assert.ok(problems.some((p) => p.includes("What this piece will not say")));
});

test("idea.md without the choices section is refused", () => {
  const md = readFixture("idea.md").replace("## Choix faits pour toi", "## Choices");
  const problems = validateIdeaMd(md);
  assert.ok(problems.some((p) => p.includes("Choix faits pour toi")));
});

test("a choice with no reason is refused", () => {
  const md = readFixture("idea.md").replace(
    /## Choix faits pour toi[\s\S]*$/,
    "## Choix faits pour toi\n\n- One carousel only\n",
  );
  const problems = validateIdeaMd(md);
  assert.ok(problems.some((p) => /reason/i.test(p)));
});

// ---- meta-commentary in "Choix faits pour toi" (guide mode leaked chat preferences and the contract)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { studioDir } from "./helpers.mjs";

const leak = readFileSync(join(studioDir, "fixtures/rejected/idea-meta-leak.md"), "utf8");

test("a real leaked answer is refused, naming the line and the word", () => {
  const problems = validateIdeaMd(leak);
  const lines = leak.split("\n");
  const first = lines.findIndex((line) => line.includes("préférence")) + 1;
  const second = lines.findIndex((line) => line.includes("le contrat")) + 1;
  assert.ok(problems.some((p) => p.includes(`line ${first}`) && /préférence/.test(p)), problems.join("\n"));
  assert.ok(problems.some((p) => p.includes(`line ${second}`) && /contrat/.test(p)), problems.join("\n"));
  assert.ok(problems.every((p) => !/line \d+/.test(p) || /Choix faits pour toi/.test(p)));
});

test("each meta word is caught in a choice, French and English, accents and plurals included", () => {
  const words = ["contrat", "contract", "validateur", "validator", "préférence", "preferences", "instruction", "instructions", "prompt", "tiret"];
  for (const word of words) {
    const md = readFixture("idea.md").replace(
      /## Choix faits pour toi[\s\S]*$/,
      `## Choix faits pour toi\n\n- Un seul format — à cause du ${word} reçu.\n`,
    );
    assert.ok(validateIdeaMd(md).some((p) => p.includes(word)), word);
  }
});

test("subject text outside the choices is never flagged, even when it uses those words", () => {
  const md = readFixture("idea.md")
    .replace("The closure is a drainage decision, not a weather decision.", "The contract with the council sets the instructions for the closure; a prompt reopening is a preference.")
    .replace("- That the closure is permanent.", "- That the validator tool or a tiret matters.");
  assert.deepEqual(validateIdeaMd(md), []);
});

test("a choice about the subject that merely contains similar letters is not flagged", () => {
  const md = readFixture("idea.md").replace(
    /## Choix faits pour toi[\s\S]*$/,
    "## Choix faits pour toi\n\n- Les contractions sont gardées — la voix les dit naturellement.\n- Un prompteur n'est pas utilisé — aucune source ne le demande.\n",
  );
  assert.deepEqual(validateIdeaMd(md), []);
});
