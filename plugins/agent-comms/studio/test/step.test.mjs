import { test } from "node:test";
import assert from "node:assert/strict";
import { STEP_DELIVERABLES, validateStep } from "../validators/index.mjs";
import { allFixtureFiles } from "./helpers.mjs";

const files = allFixtureFiles();
const pick = (step) => Object.fromEntries(STEP_DELIVERABLES[step].map((name) => [name, files[name]]));

test("each step has the fixed deliverable names from the plan", () => {
  assert.deepEqual(STEP_DELIVERABLES, {
    idea: ["idea.md", "idea.json"],
    "structure-carousel": ["cards.json", "captions.md", "sources.md", "images.json", "citations.json"],
    "audience-audit": ["audience-report.md"],
    "content-strategist": ["strategy.md", "ideas.json"],
  });
});

for (const step of Object.keys(STEP_DELIVERABLES)) {
  test(`the reference ${step} deliverables validate together`, () => {
    const result = validateStep(step, pick(step));
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
  });
}

test("a missing deliverable is reported by file name", () => {
  const outputs = pick("structure-carousel");
  delete outputs["citations.json"];
  const result = validateStep("structure-carousel", outputs);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.problems.filter((p) => p.file === "citations.json").map((p) => p.message),
    ["Missing file."],
  );
});

test("a file outside the contract is reported", () => {
  const result = validateStep("idea", { ...pick("idea"), "notes.txt": "hi" });
  assert.ok(result.problems.some((p) => p.file === "notes.txt" && /not part of this step/i.test(p.message)));
});

test("cross-file problems are attributed to the file that must change", () => {
  const outputs = pick("structure-carousel");
  outputs["images.json"] = JSON.stringify({ images: [{ id: "img-1", commonsTitle: "File:Only.jpg", reason: "x" }] });
  const result = validateStep("structure-carousel", outputs);
  assert.ok(result.problems.some((p) => p.file === "cards.json" && /img-2/.test(p.message)));
});

test("an unknown step throws", () => {
  assert.throws(() => validateStep("reel", {}), /unknown step/i);
});
