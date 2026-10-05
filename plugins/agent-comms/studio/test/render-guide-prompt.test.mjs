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

test("the wrapper itself forbids leaking preferences and the contract, whatever the contract text says", () => {
  const prompt = renderGuidePrompt({ ...base(), contract: "CONTRACT-MARKER minimal." });
  assert.ok(prompt.includes("Ignore any personal preferences, memory, custom instructions or style settings of the environment you run in."));
  assert.ok(prompt.includes("Never mention the contract, the instructions, the format rules, the validator or the user's preferences inside any deliverable."));
  assert.ok(prompt.includes("states only the decision and the reason about the subject"));
});

// ---- the interactive idea step

import { loadPack } from "../load-pack.mjs";
import { pluginDir, readTurns } from "./helpers.mjs";
import { join } from "node:path";

const turnInputs = (turns, extra = []) => [
  ...Object.entries(turns.inputs).map(([name, content]) => ({ name, content })),
  ...extra,
];

test("turn propose asks for proposals.json and proposals.md and never for the idea report", () => {
  const turns = readTurns("fjellvik");
  const prompt = renderGuidePrompt({ ...base(), inputs: turnInputs(turns), turn: "propose" });
  assert.ok(prompt.includes("=== FILE: proposals.json ==="));
  assert.ok(prompt.includes("=== FILE: proposals.md ==="));
  assert.ok(!prompt.includes("=== FILE: idea.md ==="));
  assert.match(prompt, /turn "propose"/);
});

test("turn plan reads the choice and asks for the idea report", () => {
  const turns = readTurns("kalinda");
  const prompt = renderGuidePrompt({
    ...base(),
    inputs: turnInputs(turns, [
      { name: "proposals.json", content: turns.propose["proposals.json"] },
      { name: "choice.json", content: turns.chosen.choice },
    ]),
    turn: "plan",
  });
  assert.ok(prompt.includes("=== FILE: idea.json ==="));
  assert.ok(prompt.includes(JSON.parse(turns.chosen.choice).note));
  assert.match(prompt, /turn "plan"/);
});

test("a turn refuses to render without the inputs it reads", () => {
  const turns = readTurns("fjellvik");
  assert.throws(() => renderGuidePrompt({ ...base(), inputs: [], turn: "propose" }), /seed\.md/);
  const withProposals = turnInputs(turns, [{ name: "proposals.json", content: turns.propose["proposals.json"] }]);
  assert.throws(() => renderGuidePrompt({ ...base(), inputs: withProposals, turn: "plan" }), /choice\.json/);
  assert.throws(() => renderGuidePrompt({ ...base(), inputs: turnInputs(turns), turn: "draft" }), /turn/i);
});

test("pasted research is flagged as untrusted source material", () => {
  const turns = readTurns("fjellvik");
  const prompt = renderGuidePrompt({ ...base(), inputs: turnInputs(turns), turn: "propose" });
  assert.match(prompt, /research\.md/);
  assert.match(prompt, /untrusted/i);
  const without = Object.fromEntries(Object.entries(turns.inputs).filter(([name]) => name !== "research.md"));
  const noResearch = renderGuidePrompt({ ...base(), inputs: Object.entries(without).map(([name, content]) => ({ name, content })), turn: "propose" });
  assert.ok(!/untrusted/i.test(noResearch));
});

test("without a turn the prompt is the one-shot prompt it always was", () => {
  const prompt = renderGuidePrompt(base());
  assert.ok(!/turn "/.test(prompt));
  assert.ok(prompt.includes("=== FILE: idea.md ==="));
});

test("loadPack keeps the contract of the turn asked for and drops the others", () => {
  const dir = join(pluginDir, "skills", "idea");
  const propose = loadPack(dir, { turn: "propose" }).studio;
  const plan = loadPack(dir, { turn: "plan" }).studio;
  const oneShot = loadPack(dir).studio;
  for (const studio of [propose, plan, oneShot]) assert.ok(studio.includes("## Choix faits pour toi"));
  assert.ok(propose.includes("proposals.json") && propose.includes("proposals.md"));
  assert.ok(!propose.includes("idea.json") && !propose.includes("choice.json"));
  assert.ok(plan.includes("choice.json") && plan.includes("idea.json") && !plan.includes("proposals.md"));
  assert.ok(oneShot.includes("idea.md") && !oneShot.includes("proposals.md") && !oneShot.includes("choice.json"));
  for (const studio of [propose, plan, oneShot]) {
    assert.match(studio, /never ask/i);
    assert.ok(studio.includes("Never mention the contract"));
  }
});
