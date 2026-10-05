import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderResearchPrompt } from "../research-prompt.mjs";
import { findForbiddenTerms } from "../../../../scripts/forbidden-terms.mjs";
import { readTurns, studioDir } from "./helpers.mjs";

const inputsOf = (profile) => {
  const { inputs } = readTurns(profile);
  return { seed: inputs["seed.md"], cadrage: JSON.parse(inputs["cadrage.json"]), history: JSON.parse(inputs["history.json"]) };
};
const termsOf = (profile) => JSON.parse(readFileSync(join(studioDir, "fixtures/profiles", profile, "terms.json"), "utf8")).terms;

test("the prompt carries the seed and the dates, in French by default", () => {
  const input = inputsOf("fjellvik");
  const prompt = renderResearchPrompt(input);
  assert.ok(prompt.includes(input.seed.trim()));
  assert.ok(prompt.includes(input.cadrage.today));
  assert.ok(prompt.includes(input.cadrage.publishDate));
  assert.match(prompt, /du plus ancien au plus récent/);
  assert.match(prompt, /URL/);
});

test("the prompt separates what was read from what was not, and what was not found", () => {
  const prompt = renderResearchPrompt(inputsOf("kalinda"));
  assert.match(prompt, /lue? en entier/i);
  assert.match(prompt, /non lu|pas lu/i);
  assert.match(prompt, /non trouvé|pas trouvé/i);
  assert.match(prompt, /hypothèse/i);
  assert.match(prompt, /lectures concurrentes/i);
  assert.match(prompt, /fiabilité/i);
});

test("the English version asks the same things", () => {
  const prompt = renderResearchPrompt({ ...inputsOf("fjellvik"), language: "en" });
  assert.match(prompt, /oldest to newest/i);
  assert.match(prompt, /read in full/i);
  assert.match(prompt, /not found/i);
  assert.match(prompt, /hypothesis/i);
  assert.match(prompt, /competing readings/i);
  assert.match(prompt, /reliability/i);
  assert.ok(!/du plus ancien/.test(prompt));
});

test("the model piece and the already published contents are named, so they are not repeated", () => {
  const input = inputsOf("fjellvik");
  const prompt = renderResearchPrompt(input);
  assert.ok(prompt.includes(input.cadrage.modelPiece.title));
  assert.ok(prompt.includes(input.history[1].title));
  assert.ok(prompt.includes(input.history[1].publishedAt));
});

test("no project name appears unless the inputs carry it", () => {
  for (const profile of ["fjellvik", "kalinda"]) {
    for (const language of ["fr", "en"]) {
      const prompt = renderResearchPrompt({ ...inputsOf(profile), language });
      const other = profile === "fjellvik" ? "kalinda" : "fjellvik";
      assert.deepEqual(findForbiddenTerms(prompt, termsOf(other)), [], `${profile}/${language}`);
    }
  }
  const bare = renderResearchPrompt({ seed: "A neutral seed.", cadrage: { today: "2026-01-02" }, history: [] });
  for (const profile of ["fjellvik", "kalinda"]) assert.deepEqual(findForbiddenTerms(bare, termsOf(profile)), []);
});

test("optional parts are left out cleanly, and bad input throws", () => {
  const prompt = renderResearchPrompt({ seed: "Une graine.", cadrage: { today: "2026-01-02" } });
  assert.ok(!prompt.includes("undefined") && !prompt.includes("null"));
  assert.ok(!/date de publication/i.test(prompt));
  assert.throws(() => renderResearchPrompt({ seed: "", cadrage: { today: "2026-01-02" } }), /seed/);
  assert.throws(() => renderResearchPrompt({ seed: "x", cadrage: { today: "soon" } }), /today/);
  assert.throws(() => renderResearchPrompt({ seed: "x", cadrage: { today: "2026-01-02" }, language: "de" }), /language/);
});

test("the prompt is a pure function of its input", () => {
  const input = inputsOf("kalinda");
  const snapshot = JSON.stringify(input);
  assert.equal(renderResearchPrompt(input), renderResearchPrompt(input));
  assert.equal(JSON.stringify(input), snapshot);
});
