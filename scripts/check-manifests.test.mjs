import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKER = join(dirname(fileURLToPath(import.meta.url)), "check-manifests.mjs");

function makeRepo({ version = "1.0.0", plugins = {}, marketplace }) {
  const root = mkdtempSync(join(tmpdir(), "check-manifests-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ version }));
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  const entries =
    marketplace ??
    Object.keys(plugins).map((name) => ({ name, source: `./plugins/${name}`, version }));
  writeFileSync(
    join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name: "m", plugins: entries }),
  );
  mkdirSync(join(root, "plugins"), { recursive: true });
  for (const [name, overrides] of Object.entries(plugins)) {
    const dir = join(root, "plugins", name, ".claude-plugin");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plugin.json"), JSON.stringify({ name, version, ...overrides }));
  }
  return root;
}

function runChecker(root) {
  try {
    const stdout = execFileSync(process.execPath, [CHECKER, root], { encoding: "utf8" });
    return { code: 0, output: stdout };
  } catch (err) {
    return { code: err.status, output: `${err.stdout}${err.stderr}` };
  }
}

test("passes when plugins, marketplace, and versions agree", () => {
  const root = makeRepo({ plugins: { alpha: {}, beta: {} } });
  const { code, output } = runChecker(root);
  assert.equal(code, 0);
  assert.match(output, /2 plugins/);
});

test("fails on version drift between a plugin and package.json", () => {
  const root = makeRepo({ plugins: { alpha: { version: "9.9.9" } } });
  const { code, output } = runChecker(root);
  assert.equal(code, 1);
  assert.match(output, /alpha: version 9\.9\.9/);
});

test("fails when a plugin directory is missing from the marketplace", () => {
  const root = makeRepo({
    plugins: { alpha: {}, beta: {} },
    marketplace: [{ name: "alpha", source: "./plugins/alpha", version: "1.0.0" }],
  });
  const { code, output } = runChecker(root);
  assert.equal(code, 1);
  assert.match(output, /beta: missing from marketplace/);
});

test("fails when the marketplace lists a plugin that has no directory", () => {
  const root = makeRepo({
    plugins: { alpha: {} },
    marketplace: [
      { name: "alpha", source: "./plugins/alpha", version: "1.0.0" },
      { name: "ghost", source: "./plugins/ghost", version: "1.0.0" },
    ],
  });
  const { code, output } = runChecker(root);
  assert.equal(code, 1);
  assert.match(output, /"ghost"/);
});

test("fails when a plugin.json name does not match its directory", () => {
  const root = makeRepo({ plugins: { alpha: { name: "omega" } } });
  const { code, output } = runChecker(root);
  assert.equal(code, 1);
  assert.match(output, /"omega" != directory name/);
});

test("fails when a marketplace source does not point at the plugin directory", () => {
  const root = makeRepo({
    plugins: { alpha: {} },
    marketplace: [{ name: "alpha", source: "./", version: "1.0.0" }],
  });
  const { code, output } = runChecker(root);
  assert.equal(code, 1);
  assert.match(output, /source "\.\/"/);
});
