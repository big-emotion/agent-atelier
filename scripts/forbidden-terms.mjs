#!/usr/bin/env node
// Fails when a run's output for one project profile carries vocabulary that
// belongs to another profile (a second tenant must never inherit the first
// one's brand, series or tagline). Each profile lists its own distinctive
// terms in <profiles-dir>/<name>/terms.json.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_PROFILES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../plugins/agent-comms/studio/fixtures/profiles",
);
const SCANNED_EXTENSIONS = /\.(md|json|txt)$/i;

// Plain case-insensitive substring: a brand term inside a longer word is still a leak.
export function findForbiddenTerms(text, terms) {
  const lines = text.split("\n").map((line) => line.toLowerCase());
  return terms.flatMap((term) => {
    const needle = term.toLowerCase();
    const index = lines.findIndex((line) => line.includes(needle));
    return index === -1 ? [] : [{ term, line: index + 1 }];
  });
}

export function loadOtherProfilesTerms(profilesDir, profile) {
  const own = join(profilesDir, profile, "terms.json");
  if (!existsSync(own)) throw new Error(`Unknown profile "${profile}" in ${profilesDir}.`);
  return readdirSync(profilesDir)
    .filter((name) => name !== profile && existsSync(join(profilesDir, name, "terms.json")))
    .flatMap((name) => JSON.parse(readFileSync(join(profilesDir, name, "terms.json"), "utf8")).terms);
}

const walk = (path) =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((entry) => walk(join(path, entry)))
    : SCANNED_EXTENSIONS.test(path) ? [path] : [];

function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const at = args.indexOf(flag);
    return at === -1 ? null : args.splice(at, 2)[1];
  };
  const profile = take("--profile");
  const profilesDir = resolve(take("--profiles-dir") ?? DEFAULT_PROFILES_DIR);
  if (!profile || args.length === 0) {
    console.error("Usage: forbidden-terms.mjs --profile <name> [--profiles-dir <dir>] <path>...");
    return 2;
  }
  let terms;
  try {
    terms = loadOtherProfilesTerms(profilesDir, profile);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  let leaks = 0;
  for (const file of args.flatMap((path) => walk(resolve(path)))) {
    for (const hit of findForbiddenTerms(readFileSync(file, "utf8"), terms)) {
      console.error(`${file}:${hit.line} contains "${hit.term}", which belongs to another profile.`);
      leaks += 1;
    }
  }
  if (leaks === 0) console.log(`OK: no term from the other profiles in the "${profile}" output.`);
  return leaks === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
