#!/usr/bin/env node
// Enforces the marketplace invariants the release skill relies on: every
// plugin under plugins/ is listed in marketplace.json, names match their
// directories, sources point at those directories, and every version moves
// in lockstep with package.json (single CHANGELOG, single release cadence).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const readJson = (relPath) => JSON.parse(readFileSync(join(root, relPath), "utf8"));

const pkg = readJson("package.json");
const marketplace = readJson(".claude-plugin/marketplace.json");

const pluginDirs = readdirSync(join(root, "plugins")).filter((dir) =>
  existsSync(join(root, "plugins", dir, ".claude-plugin", "plugin.json")),
);

const listed = new Map(marketplace.plugins.map((entry) => [entry.name, entry]));

for (const dir of pluginDirs) {
  const manifest = readJson(join("plugins", dir, ".claude-plugin", "plugin.json"));
  if (manifest.name !== dir) {
    errors.push(`plugins/${dir}: plugin.json name "${manifest.name}" != directory name`);
  }
  if (manifest.version !== pkg.version) {
    errors.push(`plugins/${dir}: version ${manifest.version} != package.json ${pkg.version}`);
  }
  const entry = listed.get(dir);
  if (!entry) {
    errors.push(`plugins/${dir}: missing from marketplace.json`);
    continue;
  }
  if (entry.source !== `./plugins/${dir}`) {
    errors.push(`marketplace entry ${dir}: source "${entry.source}" != "./plugins/${dir}"`);
  }
  if (entry.version !== pkg.version) {
    errors.push(`marketplace entry ${dir}: version ${entry.version} != package.json ${pkg.version}`);
  }
  listed.delete(dir);
}

for (const orphan of listed.keys()) {
  errors.push(`marketplace lists "${orphan}" but plugins/${orphan}/ has no plugin.json`);
}

if (errors.length > 0) {
  console.error("Manifest drift:");
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log(`OK — ${pluginDirs.length} plugins, marketplace and versions in lockstep.`);
