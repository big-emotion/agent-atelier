import { test } from "node:test";
import assert from "node:assert/strict";
import { STEP_DELIVERABLES, deliverablesFor, validateStep } from "../validators/index.mjs";
import { allFixtureFiles, readRun } from "./helpers.mjs";

const files = allFixtureFiles();
const pick = (step) => Object.fromEntries(STEP_DELIVERABLES[step].map((name) => [name, files[name]]));

test("each step has the fixed deliverable names from the plan", () => {
  assert.deepEqual(STEP_DELIVERABLES, {
    idea: ["idea.md", "idea.json"],
    "structure-carousel": ["cards.json", "captions.md", "sources.md", "images.json", "citations.json"],
    "structure-image": ["image.json", "captions.md", "sources.md", "images.json", "citations.json"],
    "structure-reel": ["scenes.json", "narration.txt", "captions.md", "sources.md", "images.json", "citations.json"],
    "audience-audit": ["audience-report.md"],
    "content-strategist": ["strategy.md", "ideas.json"],
  });
});

for (const step of Object.keys(STEP_DELIVERABLES).filter((name) => !["structure-image", "structure-reel"].includes(name))) {
  test(`the reference ${step} deliverables validate together`, () => {
    const result = validateStep(step, pick(step));
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
  });
}

for (const profile of ["fjellvik", "kalinda"]) {
  for (const format of ["image", "reel"]) {
    test(`the reference ${profile} ${format} run validates`, () => {
      const result = validateStep(`structure-${format}`, readRun(profile, format));
      assert.deepEqual(result.problems, []);
    });
  }
}

test("a format picks the structure step and its deliverables", () => {
  assert.deepEqual(deliverablesFor("structure", "reel"), STEP_DELIVERABLES["structure-reel"]);
  assert.deepEqual(deliverablesFor("structure", "image"), STEP_DELIVERABLES["structure-image"]);
  assert.deepEqual(deliverablesFor("structure", "carousel"), STEP_DELIVERABLES["structure-carousel"]);
  assert.deepEqual(deliverablesFor("idea"), STEP_DELIVERABLES.idea);
  assert.throws(() => deliverablesFor("structure", "podcast"), /format/i);
  assert.throws(() => deliverablesFor("structure"), /format/i);
});

test("validateStep accepts the generic structure step with a format", () => {
  const result = validateStep("structure", readRun("fjellvik", "reel"), { format: "reel" });
  assert.deepEqual(result.problems, []);
});

test("a reel's files do not pass as an image step", () => {
  const result = validateStep("structure-image", readRun("fjellvik", "reel"));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.file === "image.json" && p.message === "Missing file."));
});

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
