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
