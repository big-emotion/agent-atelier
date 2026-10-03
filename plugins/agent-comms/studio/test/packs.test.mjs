import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { STEP_DELIVERABLES } from "../validators/index.mjs";
import { validateProfile } from "../validators/profile.mjs";
import { loadPack } from "../load-pack.mjs";
import { renderGuidePrompt } from "../render-guide-prompt.mjs";
import { findForbiddenTerms } from "../../../../scripts/forbidden-terms.mjs";
import { pluginDir, studioDir } from "./helpers.mjs";

const skillsDir = join(pluginDir, "skills");
const derivedPacks = ["idea", "structure-carousel", "structure-image", "structure-reel"];
const allPacks = [...derivedPacks, "audience-audit", "content-strategist"];
const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
// Vocabulary of the source project's own series and editorial checks, which
// must not survive in a generic pack, plus the other fixture brand's terms.
const sourceOnlyTerms = [
  "afrik",
  "onomast",
  "décolonial",
  "decolonial",
  "name-origin",
  ...JSON.parse(readFileSync(join(studioDir, "fixtures/profiles/kalinda/terms.json"), "utf8")).terms,
];

for (const pack of allPacks) {
  test(`${pack}: the pack has SKILL.md with frontmatter and a studio.md contract`, () => {
    const skill = readFileSync(join(skillsDir, pack, "SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: .+\ndescription: .+/s);
    const studio = readFileSync(join(skillsDir, pack, "studio.md"), "utf8");
    for (const name of STEP_DELIVERABLES[pack]) assert.ok(studio.includes(name), `${name} not in studio.md`);
    assert.ok(studio.includes("## Choix faits pour toi"));
    assert.match(studio, /never ask/i);
    assert.match(studio, /never block/i);
    assert.match(studio, /outputs\//);
    assert.ok(studio.includes("Ignore any personal preferences, memory, custom instructions or style settings of the environment you run in."));
    assert.ok(studio.includes("Never mention the contract, the instructions, the format rules, the validator or the user's preferences inside any deliverable."));
    assert.ok(studio.includes("states only the decision and the reason about the subject"));
  });
}

for (const pack of derivedPacks) {
  test(`${pack}: derived-from.json records a relative source path and a sha256 per file`, () => {
    const derived = JSON.parse(readFileSync(join(skillsDir, pack, "derived-from.json"), "utf8"));
    assert.ok(derived.files.length > 0);
    for (const entry of derived.files) {
      assert.match(entry.sha256, /^[0-9a-f]{64}$/);
      assert.ok(!entry.source.startsWith("/") && !/^[A-Za-z]:/.test(entry.source), entry.source);
      assert.ok(entry.pack && existsSync(join(skillsDir, pack, entry.pack)), `${entry.pack} missing in pack`);
    }
  });

  test(`${pack}: no source-project-only term survives in the pack text`, () => {
    const files = walk(join(skillsDir, pack)).filter((f) => !f.endsWith("derived-from.json"));
    const hits = files.flatMap((file) =>
      findForbiddenTerms(readFileSync(file, "utf8"), sourceOnlyTerms).map((hit) => `${relative(skillsDir, file)}:${hit.line} ${hit.term}`),
    );
    assert.deepEqual(hits, []);
  });
}

test("no committed file in the plugin carries an absolute local path", () => {
  const offenders = walk(pluginDir).filter((file) => /\/Users\/|\/home\/[a-z]|[A-Z]:\\Users/.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders.map((f) => relative(pluginDir, f)), []);
});

test("structure-carousel ships cards.schema.json and the images and citations formats", () => {
  const refs = join(skillsDir, "structure-carousel", "references");
  const schema = JSON.parse(readFileSync(join(refs, "cards.schema.json"), "utf8"));
  assert.deepEqual(schema.required.sort(), ["campagne", "cartes"]);
  assert.deepEqual(schema.properties.cartes.items.required.sort(), ["image", "rang", "role", "titre"]);
  for (const doc of ["images-format.md", "citations-format.md", "licences.md"]) {
    assert.ok(existsSync(join(refs, doc)), doc);
  }
});

test("structure-image and structure-reel ship their formats and the render contract", () => {
  const image = join(skillsDir, "structure-image", "references");
  for (const doc of ["images-format.md", "citations-format.md", "licences.md", "image.schema.json"]) {
    assert.ok(existsSync(join(image, doc)), `structure-image ${doc}`);
  }
  const reel = join(skillsDir, "structure-reel", "references");
  for (const doc of ["images-format.md", "citations-format.md", "licences.md", "reel.schema.json", "scenes-contract.md"]) {
    assert.ok(existsSync(join(reel, doc)), `structure-reel ${doc}`);
  }
  const schema = JSON.parse(readFileSync(join(reel, "reel.schema.json"), "utf8"));
  assert.deepEqual(schema.required.sort(), ["campaign", "scenes", "title", "version"]);
});

test("both profile fixtures are valid profiles", () => {
  for (const name of ["kalinda", "fjellvik"]) {
    const profile = readFileSync(join(studioDir, "fixtures/profiles", name, "profile.md"), "utf8");
    assert.deepEqual(validateProfile(profile), [], name);
  }
});

test("loadPack feeds renderGuidePrompt without further wiring", () => {
  const pack = loadPack(join(skillsDir, "idea"));
  assert.equal(pack.name, "idea");
  assert.ok(pack.skill.includes("# Idea"));
  assert.ok(pack.references.some((ref) => ref.path === "references/narrative-patterns.md"));
  const prompt = renderGuidePrompt({
    pack,
    profile: readFileSync(join(studioDir, "fixtures/profiles/fjellvik/profile.md"), "utf8"),
    inputs: [{ name: "seed.md", content: "Why the Ridge Line closes in October" }],
    contract: pack.studio,
  });
  assert.ok(prompt.includes("Fjellvik Cycles"));
  assert.ok(prompt.includes("=== FILE: idea.json ==="));
});
