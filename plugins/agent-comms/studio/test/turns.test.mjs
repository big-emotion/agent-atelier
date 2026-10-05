import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TURN_DELIVERABLES, deliverablesFor, resolveStep, validateStep } from "../validators/index.mjs";
import { PATTERN_IDS, validateProposalsJson, validateProposalsMd } from "../validators/proposals.mjs";
import { validateIdeaJson } from "../validators/idea.mjs";
import { planContext, pluginDir, readTurns, studioDir } from "./helpers.mjs";

const PROFILES = ["fjellvik", "kalinda"];
const messages = (result) => result.problems.map((p) => `${p.file}: ${p.message}`).join("\n");

// A broken copy of a profile's accepted propose output.
function breakProposals(turns, mutate) {
  const proposals = JSON.parse(turns.propose["proposals.json"]);
  mutate(proposals);
  return { ...turns.propose, "proposals.json": JSON.stringify(proposals) };
}

function breakPlanIdea(turns, variant, mutate) {
  const idea = JSON.parse(turns[variant].outputs["idea.json"]);
  mutate(idea);
  return { ...turns[variant].outputs, "idea.json": JSON.stringify(idea) };
}

const proposeProblems = (files) => validateStep("idea", files, { turn: "propose" }).problems;
const planProblems = (turns, files, variant = "chosen") => validateStep("idea", files, planContext(turns, variant)).problems;

// ---- wiring

test("the idea step has two turns with their own deliverables, and no turn keeps the one-shot step", () => {
  assert.deepEqual(TURN_DELIVERABLES.idea.propose, ["proposals.json", "proposals.md"]);
  assert.deepEqual(TURN_DELIVERABLES.idea.plan, ["idea.md", "idea.json"]);
  assert.deepEqual(deliverablesFor("idea", undefined, "propose"), ["proposals.json", "proposals.md"]);
  assert.deepEqual(deliverablesFor("idea", undefined, "plan"), ["idea.md", "idea.json"]);
  assert.deepEqual(deliverablesFor("idea"), ["idea.md", "idea.json"]);
  assert.equal(resolveStep("idea", undefined, "propose"), "idea:propose");
  assert.equal(resolveStep("idea"), "idea");
  assert.equal(resolveStep("structure", "reel", undefined), "structure-reel");
});

test("an unknown turn, or a turn on another step, is refused", () => {
  assert.throws(() => deliverablesFor("idea", undefined, "draft"), /turn/i);
  assert.throws(() => deliverablesFor("structure", "reel", "plan"), /turn/i);
});

test("a turn's files are not accepted by the other turn or by the one-shot step", () => {
  const turns = readTurns("fjellvik");
  const wrongTurn = validateStep("idea", turns.propose, { turn: "plan" });
  assert.equal(wrongTurn.ok, false);
  const oneShot = validateStep("idea", turns.propose);
  assert.ok(oneShot.problems.some((p) => p.file === "proposals.json" && /not part of this step/.test(p.message)));
});

// ---- propose turn

for (const profile of PROFILES) {
  const turns = readTurns(profile);

  test(`${profile}: the reference propose output validates`, () => {
    assert.deepEqual(proposeProblems(turns.propose), []);
  });

  test(`${profile}: four proposals are refused`, () => {
    const files = breakProposals(turns, (p) => p.proposals.push({ ...p.proposals[0], id: "p3", recommended: false }, { ...p.proposals[0], id: "p4", recommended: false }));
    assert.ok(proposeProblems(files).some((p) => /at most 3|1 to 3/.test(p.message)));
  });

  test(`${profile}: no recommended proposal is refused`, () => {
    const files = breakProposals(turns, (p) => p.proposals.forEach((x) => (x.recommended = false)));
    assert.ok(proposeProblems(files).some((p) => /exactly one/i.test(p.message) && /recommended/.test(p.message)));
  });

  test(`${profile}: two recommended proposals are refused`, () => {
    const files = breakProposals(turns, (p) => p.proposals.forEach((x) => (x.recommended = true)));
    assert.ok(proposeProblems(files).some((p) => /exactly one/i.test(p.message)));
  });

  test(`${profile}: a pattern outside the ten is refused and the list is named`, () => {
    const files = breakProposals(turns, (p) => (p.proposals[1].pattern = "storytelling"));
    const problem = proposeProblems(files).find((p) => /pattern/.test(p.message));
    assert.ok(problem, "no pattern problem");
    assert.ok(problem.message.includes("received-claim-examined"), "names the allowed patterns");
  });

  test(`${profile}: an empty cannotClaim is refused`, () => {
    const files = breakProposals(turns, (p) => (p.proposals[0].cannotClaim = "  "));
    assert.ok(proposeProblems(files).some((p) => /cannotClaim/.test(p.message)));
  });

  test(`${profile}: an audience metric as success criterion is refused`, () => {
    const files = breakProposals(turns, (p) => (p.proposals[0].criterion = "The piece reaches 10,000 views and strong engagement."));
    assert.ok(proposeProblems(files).some((p) => /criterion/.test(p.message) && /audience/i.test(p.message)));
  });

  test(`${profile}: one proposal alone needs a reason that says no second story is supported`, () => {
    const alone = (reason) =>
      breakProposals(turns, (p) => {
        p.proposals = [{ ...p.proposals[0], recommended: true, reason }];
      });
    assert.ok(proposeProblems(alone("It reads well.")).some((p) => /second story/i.test(p.message)));
    for (const reason of ["No second story is supported by the evidence: one source only.", "Aucune seconde histoire n'est portée par les sources : une seule source."]) {
      assert.deepEqual(proposeProblems(alone(reason)), [], reason);
    }
  });

  test(`${profile}: two proposals on the same pattern are one story, refused`, () => {
    const files = breakProposals(turns, (p) => (p.proposals[1].pattern = p.proposals[0].pattern));
    assert.ok(proposeProblems(files).some((p) => /same pattern|different pattern/i.test(p.message)));
  });

  test(`${profile}: bounds on vigilance, beforeWriting and the basis`, () => {
    const many = (n) => Array.from({ length: n }, (_, i) => `point ${i}`);
    assert.ok(proposeProblems(breakProposals(turns, (p) => (p.vigilance = many(5)))).some((p) => /vigilance/.test(p.message)));
    assert.ok(proposeProblems(breakProposals(turns, (p) => (p.beforeWriting = many(6)))).some((p) => /beforeWriting/.test(p.message)));
    assert.deepEqual(proposeProblems(breakProposals(turns, (p) => ((p.vigilance = []), (p.beforeWriting = [])))), []);
    assert.ok(proposeProblems(breakProposals(turns, (p) => (p.basis = "gut feeling"))).some((p) => /basis/.test(p.message)));
    assert.ok(proposeProblems(breakProposals(turns, (p) => (p.basisReason = ""))).some((p) => /basisReason/.test(p.message)));
  });

  test(`${profile}: every proposal needs its text fields and an id from p1..p3`, () => {
    for (const field of ["title", "question", "tells", "reader", "criterion", "reason"]) {
      const files = breakProposals(turns, (p) => delete p.proposals[0][field]);
      assert.ok(proposeProblems(files).some((p) => p.message.includes(`proposals[0].${field}`)), field);
    }
    const files = breakProposals(turns, (p) => (p.proposals[0].id = "p9"));
    assert.ok(proposeProblems(files).some((p) => /id/.test(p.message)));
  });

  test(`${profile}: proposals.md carries only the choices section, without meta words`, () => {
    const withTitle = { ...turns.propose, "proposals.md": `# A title\n\n${turns.propose["proposals.md"]}` };
    assert.ok(proposeProblems(withTitle).some((p) => p.file === "proposals.md" && /only/i.test(p.message)));
    const extra = { ...turns.propose, "proposals.md": `${turns.propose["proposals.md"]}\n## Plan\n\n- x\n` };
    assert.ok(proposeProblems(extra).some((p) => p.file === "proposals.md" && /only/i.test(p.message)));
    const meta = { ...turns.propose, "proposals.md": "## Choix faits pour toi\n\n- Un choix — à cause du contrat reçu.\n" };
    assert.ok(proposeProblems(meta).some((p) => /contrat/.test(p.message)));
    const missing = { ...turns.propose, "proposals.md": "## Choices\n\n- A — because.\n" };
    assert.ok(proposeProblems(missing).some((p) => /Choix faits pour toi/.test(p.message)));
  });

  test(`${profile}: every new propose message ends with a French sentence`, () => {
    const broken = breakProposals(turns, (p) => {
      p.proposals[0].cannotClaim = "";
      p.proposals[1].pattern = "storytelling";
      p.proposals.forEach((x) => (x.recommended = false));
    });
    const problems = proposeProblems(broken);
    assert.ok(problems.length >= 3);
    for (const { message } of problems) assert.match(message, /\(.+\)$/, message);
  });
}

test("proposals.json that is not JSON reports a parse problem", () => {
  assert.match(validateProposalsJson("{ nope")[0], /not valid JSON/i);
});

test("proposals.md accepts the choices heading only as written", () => {
  assert.deepEqual(validateProposalsMd("## Choix faits pour toi\n\n- Un sujet — une raison claire.\n"), []);
});

// ---- plan turn

for (const profile of PROFILES) {
  const turns = readTurns(profile);

  for (const variant of ["delegated", "chosen"]) {
    test(`${profile}: the reference ${variant} plan validates`, () => {
      assert.deepEqual(planProblems(turns, turns[variant].outputs, variant), []);
    });
  }

  test(`${profile}: a chosen plan keeps the editor's note`, () => {
    const choice = JSON.parse(turns.chosen.choice);
    const idea = JSON.parse(turns.chosen.outputs["idea.json"]);
    assert.equal(choice.kind, "chosen");
    assert.equal(idea.chosen.note, choice.note);
    assert.equal(JSON.parse(turns.delegated.outputs["idea.json"]).chosen.kind, "delegated");
  });

  test(`${profile}: a plan of 3 or 10 steps is refused`, () => {
    const three = breakPlanIdea(turns, "chosen", (idea) => (idea.plan = idea.plan.slice(0, 3)));
    assert.ok(planProblems(turns, three).some((p) => /plan/.test(p.message) && /4 to 9/.test(p.message)));
    const ten = breakPlanIdea(turns, "chosen", (idea) => {
      idea.plan = Array.from({ length: 10 }, (_, i) => ({ ...idea.plan[1], n: i + 1 }));
    });
    assert.ok(planProblems(turns, ten).some((p) => /4 to 9/.test(p.message)));
  });

  test(`${profile}: a plan step citing a source absent from the sources is refused`, () => {
    const files = breakPlanIdea(turns, "chosen", (idea) => (idea.plan[1].sources = ["https://example.org/not-in-the-list"]));
    const problem = planProblems(turns, files).find((p) => /plan\[1\]/.test(p.message));
    assert.ok(problem, "no problem on plan[1]");
    assert.match(problem.message, /sources/);
  });

  test(`${profile}: steps are numbered from 1 in order and carry a goal`, () => {
    const gap = breakPlanIdea(turns, "chosen", (idea) => (idea.plan[2].n = 7));
    assert.ok(planProblems(turns, gap).some((p) => /plan\[2\]\.n/.test(p.message)));
    const noGoal = breakPlanIdea(turns, "chosen", (idea) => (idea.plan[0].goal = ""));
    assert.ok(planProblems(turns, noGoal).some((p) => /plan\[0\]\.goal/.test(p.message)));
  });

  test(`${profile}: a middle step with no source is refused, the first and the last may have none`, () => {
    const middle = breakPlanIdea(turns, "chosen", (idea) => (idea.plan[2].sources = []));
    assert.ok(planProblems(turns, middle).some((p) => /plan\[2\]\.sources/.test(p.message)));
    const ends = breakPlanIdea(turns, "chosen", (idea) => ((idea.plan[0].sources = []), (idea.plan[idea.plan.length - 1].sources = [])));
    assert.deepEqual(planProblems(turns, ends), []);
  });

  test(`${profile}: the plan turn requires chosen, plan and beforeWriting`, () => {
    for (const field of ["chosen", "plan", "beforeWriting"]) {
      const files = breakPlanIdea(turns, "chosen", (idea) => delete idea[field]);
      assert.ok(planProblems(turns, files).some((p) => p.file === "idea.json" && p.message.includes(field)), field);
    }
  });

  test(`${profile}: chosen must match the editor's choice and an existing proposal`, () => {
    const otherKind = breakPlanIdea(turns, "chosen", (idea) => (idea.chosen.kind = "delegated"));
    assert.ok(planProblems(turns, otherKind).some((p) => /chosen\.kind/.test(p.message)));
    const otherProposal = breakPlanIdea(turns, "chosen", (idea) => (idea.chosen.proposalId = "p2"));
    assert.ok(planProblems(turns, otherProposal).some((p) => /chosen\.proposalId/.test(p.message)));
    const lostNote = breakPlanIdea(turns, "chosen", (idea) => delete idea.chosen.note);
    assert.ok(planProblems(turns, lostNote).some((p) => /chosen\.note/.test(p.message)));
  });

  test(`${profile}: beforeWriting holds at most 5 strings`, () => {
    const files = breakPlanIdea(turns, "chosen", (idea) => (idea.beforeWriting = ["a", "b", "c", "d", "e", "f"]));
    assert.ok(planProblems(turns, files).some((p) => /beforeWriting/.test(p.message)));
  });

  test(`${profile}: idea.md of the plan turn needs its Plan section`, () => {
    const md = turns.chosen.outputs["idea.md"].replace(/^## Plan$/m, "## Misc");
    const problems = planProblems(turns, { ...turns.chosen.outputs, "idea.md": md });
    assert.ok(problems.some((p) => p.file === "idea.md" && /Plan/.test(p.message)));
  });

  test(`${profile}: without a turn the plan stays optional but is checked when present`, () => {
    assert.deepEqual(validateStep("idea", turns.chosen.outputs).problems, []);
    const { plan, chosen, beforeWriting, ...legacy } = JSON.parse(turns.chosen.outputs["idea.json"]);
    assert.deepEqual(validateIdeaJson(JSON.stringify(legacy)), []);
    const broken = JSON.stringify({ ...legacy, plan: plan.slice(0, 2) });
    assert.ok(validateIdeaJson(broken).some((p) => /4 to 9/.test(p)));
  });
}

// ---- the shapes exported as JSON Schemas stay in step with the validators

test("proposals.schema.json and the validator list the same ten patterns as the catalogue", () => {
  const catalogue = readFileSync(join(pluginDir, "skills/idea/references/narrative-patterns.md"), "utf8");
  const ids = [...catalogue.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]);
  assert.equal(ids.length, 10);
  assert.deepEqual(PATTERN_IDS, ids);
  const schema = JSON.parse(readFileSync(join(pluginDir, "skills/idea/references/proposals.schema.json"), "utf8"));
  const item = schema.properties.proposals.items;
  assert.deepEqual(item.properties.pattern.enum, ids);
  assert.equal(schema.properties.proposals.minItems, 1);
  assert.equal(schema.properties.proposals.maxItems, 3);
  assert.deepEqual(item.required.sort(), ["cannotClaim", "criterion", "id", "pattern", "question", "reader", "reason", "recommended", "tells", "title"]);
  assert.deepEqual(schema.required.sort(), ["basis", "basisReason", "beforeWriting", "proposals", "subject", "vigilance"]);
});

test("idea.schema.json carries chosen, plan (4 to 9 steps) and beforeWriting", () => {
  const schema = JSON.parse(readFileSync(join(pluginDir, "skills/idea/references/idea.schema.json"), "utf8"));
  assert.equal(schema.properties.plan.minItems, 4);
  assert.equal(schema.properties.plan.maxItems, 9);
  assert.deepEqual(schema.properties.plan.items.required.sort(), ["goal", "n", "sources", "title"]);
  assert.deepEqual(schema.properties.chosen.required.sort(), ["kind", "proposalId"]);
  assert.deepEqual(schema.properties.chosen.properties.kind.enum, ["chosen", "delegated"]);
  assert.equal(schema.properties.beforeWriting.maxItems, 5);
  assert.ok(!schema.required.includes("plan"), "plan is required by the plan turn, not by the one-shot step");
});

test("the turn fixtures never name a project the profile does not declare", () => {
  for (const profile of PROFILES) {
    const other = PROFILES.find((name) => name !== profile);
    const terms = JSON.parse(readFileSync(join(studioDir, "fixtures/profiles", other, "terms.json"), "utf8")).terms;
    const turns = readTurns(profile);
    const text = JSON.stringify(turns).toLowerCase();
    for (const term of terms) assert.ok(!text.includes(term.toLowerCase()), `${profile} mentions ${term}`);
  }
});
