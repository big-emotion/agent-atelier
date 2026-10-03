import { test } from "node:test";
import assert from "node:assert/strict";
import { renderGuidePrompt } from "../render-guide-prompt.mjs";

const base = () => ({
  pack: {
    name: "idea",
    skill: "SKILL-TEXT-MARKER: write a bounded question.",
    references: [{ path: "references/narrative-patterns.md", content: "REFERENCE-MARKER ten patterns" }],
  },
  profile: "PROFILE-MARKER Fjellvik, English, you.",
  inputs: [
    { name: "seed.md", content: "INPUT-ONE-MARKER why the route closes" },
    { name: "audience-report.md", content: "INPUT-TWO-MARKER 92% bounce" },
  ],
  contract: "CONTRACT-MARKER never ask, never block.",
  revision: null,
  previous: [],
});

test("the prompt inlines the skill, its references, the profile, every input and the contract", () => {
  const prompt = renderGuidePrompt(base());
  for (const marker of [
    "SKILL-TEXT-MARKER",
    "REFERENCE-MARKER",
    "references/narrative-patterns.md",
    "PROFILE-MARKER",
    "INPUT-ONE-MARKER",
    "INPUT-TWO-MARKER",
    "seed.md",
    "audience-report.md",
    "CONTRACT-MARKER",
  ]) {
    assert.ok(prompt.includes(marker), `missing ${marker}`);
  }
});

test("the prompt asks for one block per deliverable in the FILE format", () => {
  const prompt = renderGuidePrompt(base());
  assert.ok(prompt.includes("=== FILE: idea.md ==="));
  assert.ok(prompt.includes("=== FILE: idea.json ==="));
  assert.ok(prompt.includes("outputs/"), "must also cover agents that can write files");
});

test("a revision brings its sentence and the previous version", () => {
  const prompt = renderGuidePrompt({
    ...base(),
    revision: "REVISION-MARKER make the promise shorter",
    previous: [{ name: "idea.md", content: "PREVIOUS-MARKER old draft" }],
  });
  assert.ok(prompt.includes("REVISION-MARKER make the promise shorter"));
  assert.ok(prompt.includes("PREVIOUS-MARKER old draft"));
});

test("without a revision there is no revision section", () => {
  const prompt = renderGuidePrompt(base());
  assert.ok(!prompt.includes("<revision>"));
  assert.ok(!prompt.includes("<previous"));
});

test("the prompt is deterministic and a pure function of its input", () => {
  const input = base();
  const snapshot = JSON.stringify(input);
  assert.equal(renderGuidePrompt(input), renderGuidePrompt(input));
  assert.equal(JSON.stringify(input), snapshot);
});

test("deliverables default to the step's fixed names and can be overridden", () => {
  const structure = renderGuidePrompt({ ...base(), pack: { ...base().pack, name: "structure-carousel" } });
  for (const name of ["cards.json", "captions.md", "sources.md", "images.json", "citations.json"]) {
    assert.ok(structure.includes(`=== FILE: ${name} ===`), name);
  }
  const custom = renderGuidePrompt({ ...base(), deliverables: ["only.md"] });
  assert.ok(custom.includes("=== FILE: only.md ==="));
  assert.ok(!custom.includes("=== FILE: idea.md ==="));
});

test("a step with no known deliverables and no override throws", () => {
  assert.throws(() => renderGuidePrompt({ ...base(), pack: { ...base().pack, name: "reel" } }), /deliverables/i);
});

test("missing required parts throw instead of producing a half prompt", () => {
  for (const key of ["profile", "contract"]) {
    assert.throws(() => renderGuidePrompt({ ...base(), [key]: "" }), new RegExp(key));
  }
  assert.throws(() => renderGuidePrompt({ ...base(), pack: { name: "idea", skill: "", references: [] } }), /skill/);
});

test("a generic structure pack takes its deliverables from the format", () => {
  const generic = { ...base(), pack: { ...base().pack, name: "structure" } };
  const reel = renderGuidePrompt({ ...generic, format: "reel" });
  for (const name of ["scenes.json", "narration.txt", "captions.md"]) assert.ok(reel.includes(`=== FILE: ${name} ===`), name);
  const image = renderGuidePrompt({ ...generic, format: "image" });
  assert.ok(image.includes("=== FILE: image.json ==="));
  assert.ok(!image.includes("=== FILE: scenes.json ==="));
  assert.throws(() => renderGuidePrompt(generic), /format/i);
});
