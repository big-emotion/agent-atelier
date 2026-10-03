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

// Reads a pack directory into the shape renderGuidePrompt takes. The
// frontmatter is dropped: it routes a skill inside Claude Code and means
// nothing to a chat session.
export function loadPack(dir) {
  const referencesDir = join(dir, "references");
  return {
    name: basename(dir),
    skill: withoutFrontmatter(readFileSync(join(dir, "SKILL.md"), "utf8")).trim(),
    studio: readFileSync(join(dir, "studio.md"), "utf8"),
    references: existsSync(referencesDir)
      ? listFiles(referencesDir).map((file) => ({
          path: relative(dir, file).split("\\").join("/"),
          content: readFileSync(file, "utf8"),
        }))
      : [],
  };
}
