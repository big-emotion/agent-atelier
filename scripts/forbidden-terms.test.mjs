import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findForbiddenTerms, loadOtherProfilesTerms } from "./forbidden-terms.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "forbidden-terms.mjs");
const profilesDir = join(here, "../plugins/agent-comms/studio/fixtures/profiles");
const fjellvikOutputs = join(here, "../plugins/agent-comms/studio/fixtures/runs/fjellvik/outputs");

test("terms match case-insensitively and report their line", () => {
  const hits = findForbiddenTerms("first line\nSee Kalinda here\n", ["kalinda"]);
  assert.deepEqual(hits, [{ term: "kalinda", line: 2 }]);
});

test("no term, no hit", () => {
  assert.deepEqual(findForbiddenTerms("a clean text", ["kalinda"]), []);
});

test("regex metacharacters in a term are literal", () => {
  assert.deepEqual(findForbiddenTerms("a (b) c", ["(b)"]), [{ term: "(b)", line: 1 }]);
  assert.deepEqual(findForbiddenTerms("abc", ["a.c"]), []);
});

test("the other profile's terms are loaded, never the profile's own", () => {
  const terms = loadOtherProfilesTerms(profilesDir, "fjellvik");
  assert.ok(terms.includes("kalinda"));
  assert.ok(!terms.includes("fjellvik"));
});

test("the reference fjellvik outputs carry no Kalinda term", () => {
  const result = spawnSync("node", [cli, "--profile", "fjellvik", fjellvikOutputs], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("every run fixture of each profile is clean against the other profile", () => {
  for (const profile of ["fjellvik", "kalinda"]) {
    const dir = join(here, "../plugins/agent-comms/studio/fixtures/runs", profile);
    const result = spawnSync("node", [cli, "--profile", profile, dir], { encoding: "utf8" });
    assert.equal(result.status, 0, `${profile}: ${result.stderr}`);
  }
});

test("the CLI fails and names file and line when a foreign term appears", () => {
  const dir = mkdtempSync(join(tmpdir(), "forbidden-terms-"));
  try {
    writeFileSync(join(dir, "captions.md"), "Ride on.\nBrought to you by Kalinda\n");
    const result = spawnSync("node", [cli, "--profile", "fjellvik", dir], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /captions\.md:2.*kalinda/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the check works in both directions: a fjellvik term leaking into a kalinda output fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "forbidden-terms-"));
  try {
    writeFileSync(join(dir, "idea.md"), "Racines en partage\nRide the Ridge Line\n");
    const result = spawnSync("node", [cli, "--profile", "kalinda", dir], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /idea\.md:2.*ridge line/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the CLI refuses an unknown profile instead of passing silently", () => {
  const result = spawnSync("node", [cli, "--profile", "nobody", fjellvikOutputs], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown profile/i);
});
