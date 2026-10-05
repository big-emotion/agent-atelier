import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const studioDir = join(dirname(fileURLToPath(import.meta.url)), "..");
export const pluginDir = join(studioDir, "..");
export const fixtureRun = join(studioDir, "fixtures", "runs", "fjellvik", "outputs");

export const readFixture = (name) => readFileSync(join(fixtureRun, name), "utf8");

export function readFixtureFiles(names) {
  return Object.fromEntries(names.map((name) => [name, readFixture(name)]));
}

export const allFixtureFiles = () =>
  readFixtureFiles(readdirSync(fixtureRun));

// Deep-cloned parsed fixture, so a test can break one field without touching the others.
export const jsonFixture = (name) => JSON.parse(readFixture(name));

// A format run lives beside the carousel run: runs/<profile>/<format>/outputs.
export const runOutputs = (profile, format) =>
  join(studioDir, "fixtures", "runs", profile, format, "outputs");

export function readRun(profile, format) {
  const dir = runOutputs(profile, format);
  return Object.fromEntries(readdirSync(dir).map((name) => [name, readFileSync(join(dir, name), "utf8")]));
}

export const jsonOf = (files, name) => JSON.parse(files[name]);

// The interactive idea step: runs/<profile>/turns holds the editor's inputs, the
// propose turn's outputs, and two plan turns (one delegated, one chosen with a note).
const readDir = (dir) => Object.fromEntries(readdirSync(dir).map((name) => [name, readFileSync(join(dir, name), "utf8")]));

export function readTurns(profile) {
  const base = join(studioDir, "fixtures", "runs", profile, "turns");
  const plan = (variant) => ({
    choice: readFileSync(join(base, `plan-${variant}`, "inputs", "choice.json"), "utf8"),
    outputs: readDir(join(base, `plan-${variant}`, "outputs")),
  });
  return {
    inputs: readDir(join(base, "inputs")),
    propose: readDir(join(base, "propose", "outputs")),
    delegated: plan("delegated"),
    chosen: plan("chosen"),
  };
}

export const planContext = (turns, variant) => ({
  turn: "plan",
  inputs: { "proposals.json": turns.propose["proposals.json"], "choice.json": turns[variant].choice },
});
