// Reads the answer a user pasted back from their own session: one block per
// file, each opened by "=== FILE: name ===" and optionally closed by
// "=== END FILE ===". Returns the files it could read and a problem per file it
// could not, each naming the file, so the portal can say exactly what to fix.

const HEADER = /^=== FILE: (.+?) ===\s*$/;
const LOOSE_HEADER = /^\s*=+\s*FILE\b/i;
const END = /^=== END FILE ===\s*$/;

const normalise = (lines) => {
  let kept = [...lines];
  while (kept.length && kept[0].trim() === "") kept.shift();
  while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
  // Chat models often fence a block even when told not to.
  if (kept.length >= 2 && /^```/.test(kept[0]) && /^```\s*$/.test(kept[kept.length - 1])) {
    kept = kept.slice(1, -1);
  }
  return kept.length ? `${kept.join("\n")}\n` : "";
};

const problem = (file, code, message) => ({ file, code, message: `${file}: ${message}` });

function readBlocks(text) {
  const blocks = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const header = HEADER.exec(line);
    if (header) {
      current = { name: header[1], lines: [], malformed: false };
      blocks.push(current);
    } else if (LOOSE_HEADER.test(line)) {
      const guessed = /FILE:?\s+([^\s=]+)/i.exec(line)?.[1] ?? "(unnamed)";
      current = { name: guessed, lines: [], malformed: true };
      blocks.push(current);
    } else if (END.test(line)) {
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  return blocks;
}

export function parseGuideAnswer(text, expectedFiles) {
  const files = {};
  const problems = [];
  const reported = new Set();
  const report = (file, code, message) => {
    problems.push(problem(file, code, message));
    reported.add(file);
  };

  for (const block of readBlocks(text)) {
    const { name } = block;
    if (block.malformed) {
      report(name, "malformed-header", `the header must read exactly "=== FILE: ${name} ===".`);
    } else if (/[\\/]/.test(name) || name.startsWith(".")) {
      report(name, "unsafe-name", "is not a valid file name.");
    } else if (!expectedFiles.includes(name)) {
      report(name, "unexpected", "is not a file of this step.");
    } else if (name in files) {
      report(name, "duplicate", "appears more than once; the first block was kept.");
    } else {
      const content = normalise(block.lines);
      if (content === "") report(name, "empty", "the block is empty.");
      else files[name] = content;
    }
  }

  for (const name of expectedFiles) {
    if (!(name in files) && !reported.has(name)) {
      problems.push(problem(name, "missing", "the block is missing from the answer."));
    }
  }
  return { files, problems };
}
