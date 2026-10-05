import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const listFiles = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? listFiles(path) : [path];
    });

const withoutFrontmatter = (markdown) => markdown.replace(/^---\n[\s\S]*?\n---\n/, "");

// A studio.md may hold the contract of several runs, one level-2 section each:
// "## One-shot run", "## Turn propose", "## Turn plan". The run asked for keeps
// its section; the others are dropped so the model reads one contract only.
const RUN_SECTION = /^## (One-shot run|Turn (propose|plan))\s*$/;

function studioFor(studio, turn) {
  const wanted = turn ? `Turn ${turn}` : "One-shot run";
  const kept = [];
  let keeping = true;
  for (const line of studio.split("\n")) {
    const heading = RUN_SECTION.exec(line);
    if (heading) keeping = heading[1] === wanted;
    else if (/^## /.test(line)) keeping = true;
    if (keeping) kept.push(line);
  }
  return kept.join("\n");
}

// Reads a pack directory into the shape renderGuidePrompt takes. The
// frontmatter is dropped: it routes a skill inside Claude Code and means
// nothing to a chat session.
export function loadPack(dir, { turn } = {}) {
  const referencesDir = join(dir, "references");
  return {
    name: basename(dir),
    skill: withoutFrontmatter(readFileSync(join(dir, "SKILL.md"), "utf8")).trim(),
    studio: studioFor(readFileSync(join(dir, "studio.md"), "utf8"), turn),
    references: existsSync(referencesDir)
      ? listFiles(referencesDir).map((file) => ({
          path: relative(dir, file).split("\\").join("/"),
          content: readFileSync(file, "utf8"),
        }))
      : [],
  };
}
