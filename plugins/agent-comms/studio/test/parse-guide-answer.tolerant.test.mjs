import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseAnswerHeader, parseGuideAnswer } from "../parse-guide-answer.mjs";
import { STEP_DELIVERABLES, TURN_DELIVERABLES } from "../validators/index.mjs";
import { readFixtureFiles, readRun } from "./helpers.mjs";

// One real deliverable set per family, so every variant runs against content
// that the validators accept (JSON with nested braces, markdown with headings).
const FAMILIES = {
  carousel: { expected: STEP_DELIVERABLES["structure-carousel"], files: readFixtureFiles(STEP_DELIVERABLES["structure-carousel"]) },
  image: { expected: STEP_DELIVERABLES["structure-image"], files: readRun("kalinda", "image") },
  reel: { expected: STEP_DELIVERABLES["structure-reel"], files: readRun("kalinda", "reel") },
  idea: { expected: STEP_DELIVERABLES.idea, files: readFixtureFiles(STEP_DELIVERABLES.idea) },
  proposals: {
    expected: TURN_DELIVERABLES.idea.propose,
    files: readRun("kalinda", "turns/propose"),
  },
};

const HEADERS = {
  exact: (n) => `=== FILE: ${n} ===`,
  "space before colon": (n) => `=== FILE : ${n} ===`,
  lowercase: (n) => `=== file: ${n} ===`,
  "h3": (n) => `### ${n}`,
  "h2": (n) => `## ${n}`,
  "h1": (n) => `# ${n}`,
  bold: (n) => `**${n}**`,
  "bold with colon": (n) => `**${n}:**`,
  backticks: (n) => `\`${n}\``,
  "File:": (n) => `File: ${n}`,
  "Fichier :": (n) => `Fichier : ${n}`,
  "name colon": (n) => `${n}:`,
  dashes: (n) => `--- ${n} ---`,
  "bare name": (n) => n,
  "leading path": (n) => `=== FILE: outputs/${n} ===`,
  "path in h3": (n) => `### \`outputs/${n}\``,
  "upper-case name": (n) => `=== FILE: ${n.toUpperCase()} ===`,
  "smart noise": (n) => `​=== FILE: ${n} ===﻿`,
};
const ENDS = { "END FILE": "=== END FILE ===\n", FIN: "=== FIN ===\n", none: "" };

const wrap = (name, content, fence) => {
  if (!fence) return content;
  return `\`\`\`${name.endsWith(".json") ? "json" : "markdown"}\n${content}\`\`\`\n`;
};
const build = (files, header, { fence = false, end = ENDS["END FILE"], intro = "Here you go.\n\n" } = {}) =>
  intro + Object.entries(files).map(([name, content]) => `${header(name)}\n${wrap(name, content, fence)}${end}`).join("\n");

for (const [family, { expected, files }] of Object.entries(FAMILIES)) {
  for (const [variant, header] of Object.entries(HEADERS)) {
    for (const fence of [false, true]) {
      test(`${family}: header "${variant}"${fence ? " inside code fences" : ""} reads back the exact files`, () => {
        const result = parseGuideAnswer(build(files, header, { fence }), expected);
        assert.deepEqual(result.problems, []);
        assert.deepEqual(result.files, files);
        assert.deepEqual(result.assumptions, []);
      });
    }
  }
  for (const [label, end] of Object.entries(ENDS)) {
    test(`${family}: closing marker "${label}"`, () => {
      const result = parseGuideAnswer(build(files, HEADERS.exact, { end }), expected);
      assert.deepEqual(result.problems, []);
      assert.deepEqual(result.files, files);
    });
  }
}

test("an unknown name behind a loose header is plain content, not a file", () => {
  const { files } = FAMILIES.idea;
  const text = build(files, HEADERS.exact) + "\n### notes.txt\nhi\n";
  const parsed = parseGuideAnswer(text, FAMILIES.idea.expected);
  assert.deepEqual(parsed.files, files);
});

test("a strict header with an unknown name is reported as unexpected", () => {
  const { files, expected } = FAMILIES.idea;
  const { problems } = parseGuideAnswer(build({ ...files, "notes.txt": "hi\n" }, HEADERS.exact), expected);
  assert.deepEqual(problems.map((p) => [p.file, p.code]), [["notes.txt", "unexpected"]]);
});

test("a path that climbs out of the folder is still refused, with or without a loose header", () => {
  const { files, expected } = FAMILIES.idea;
  const text = build(files, HEADERS.exact) + "\n=== FILE: ../../idea.md ===\nx\n";
  assert.ok(parseGuideAnswer(text, expected).problems.some((p) => p.code === "unsafe-name"));
});

test("a nested code fence inside a fenced markdown file is kept", () => {
  const body = "# Sources\n\n```bash\nnpm test\n```\n\nDone.\n";
  const text = "=== FILE: sources.md ===\n```markdown\n" + body + "```\n=== END FILE ===\n";
  assert.equal(parseGuideAnswer(text, ["sources.md"]).files["sources.md"], body);
});

test("an outer fence whose inside is unbalanced is not stripped", () => {
  const text = "=== FILE: sources.md ===\n```markdown\n# Sources\n```bash\nnpm test\n```\n";
  assert.equal(parseGuideAnswer(text, ["sources.md"]).files["sources.md"], "```markdown\n# Sources\n```bash\nnpm test\n```\n");
});

test("a fence closing after the block with a sign-off below is stripped and the sign-off dropped", () => {
  const text = "=== FILE: sources.md ===\n```markdown\n# Sources\n\n- a\n```\nHope this helps, tell me if you want changes!\n";
  assert.equal(parseGuideAnswer(text, ["sources.md"]).files["sources.md"], "# Sources\n\n- a\n");
});

// Content sniffing

const SNIFF = [
  ["carousel", "cards.json"],
  ["carousel", "images.json"],
  ["carousel", "citations.json"],
  ["proposals", "proposals.json"],
  ["reel", "scenes.json"],
  ["image", "image.json"],
  ["idea", "idea.json"],
];

for (const [family, name] of SNIFF) {
  const { expected, files } = FAMILIES[family];
  const others = Object.fromEntries(Object.entries(files).filter(([n]) => n !== name));

  test(`${family}: ${name} with no header is recognised by content and reported`, () => {
    const text = build(others, HEADERS.exact) + "\n```json\n" + files[name] + "```\n";
    const result = parseGuideAnswer(text, expected);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.files, files);
    assert.equal(result.assumptions.length, 1);
    assert.equal(result.assumptions[0].file, name);
    assert.equal(result.assumptions[0].kind, "recognised-by-content");
  });

  test(`${family}: ${name} under a wrong header name is recognised by content`, () => {
    const text = build(others, HEADERS.exact) + `\n=== FILE: output.json ===\n${files[name]}=== END FILE ===\n`;
    const result = parseGuideAnswer(text, expected);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.files, files);
    assert.deepEqual(result.assumptions.map((a) => [a.file, a.kind, a.from]), [[name, "recognised-by-content", "output.json"]]);
  });
}

test("a bare unfenced JSON object after prose is recognised", () => {
  const { expected, files } = FAMILIES.carousel;
  const others = Object.fromEntries(Object.entries(files).filter(([n]) => n !== "cards.json"));
  const text = build(others, HEADERS.exact) + "\nAnd the cards:\n" + files["cards.json"];
  assert.deepEqual(parseGuideAnswer(text, expected).files, files);
});

test("a bare citations array with quotes is recognised as citations.json", () => {
  const citations = JSON.parse(FAMILIES.carousel.files["citations.json"]).citations;
  const text = "```json\n" + JSON.stringify(citations, null, 2) + "\n```\n";
  const result = parseGuideAnswer(text, ["citations.json"]);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(JSON.parse(result.files["citations.json"]), citations);
});

test("sniffing never overwrites a file found by header", () => {
  const { expected, files } = FAMILIES.carousel;
  const other = JSON.stringify({ cartes: [{ rang: 9 }] });
  const text = build(files, HEADERS.exact) + "\n```json\n" + other + "\n```\n";
  const result = parseGuideAnswer(text, expected);
  assert.deepEqual(result.files, files);
  assert.deepEqual(result.assumptions, []);
});

test("two JSON blocks that both fit the same file are not guessed", () => {
  const text = '```json\n{"cartes":[{"rang":1}]}\n```\n```json\n{"cartes":[{"rang":2}]}\n```\n';
  const result = parseGuideAnswer(text, ["cards.json"]);
  assert.deepEqual(result.files, {});
  assert.deepEqual(result.problems.map((p) => p.code), ["missing"]);
});

test("a JSON block that fits no expected file is not assigned", () => {
  const result = parseGuideAnswer('```json\n{"hello":"world"}\n```\n', ["cards.json", "images.json"]);
  assert.deepEqual(result.files, {});
  assert.deepEqual(result.assumptions, []);
});

test("a block that fits two missing files is ambiguous and not assigned", () => {
  const both = JSON.stringify({ cartes: [{}], images: [{}] });
  const result = parseGuideAnswer("```json\n" + both + "\n```\n", ["cards.json", "images.json"]);
  assert.deepEqual(result.files, {});
});

test("markdown is never sniffed", () => {
  const result = parseGuideAnswer("# Sources\n\n- a\n", ["sources.md"]);
  assert.deepEqual(result.files, {});
  assert.deepEqual(result.problems.map((p) => p.code), ["missing"]);
});

// Trailing prose
test("prose after the last JSON file is cut at the closing brace", () => {
  const { expected, files } = FAMILIES.image;
  const names = Object.keys(files);
  const last = names[names.length - 1];
  const ordered = { ...Object.fromEntries(names.filter((n) => n !== last).map((n) => [n, files[n]])), [last]: files[last] };
  const jsonLast = names.find((n) => n === "citations.json");
  const reordered = Object.fromEntries([...Object.entries(ordered).filter(([n]) => n !== jsonLast), [jsonLast, files[jsonLast]]]);
  const text = build(reordered, HEADERS.exact, { end: "" }) + "\nJ'espère que ça convient, dis-moi si tu veux un autre ton.\n";
  const result = parseGuideAnswer(text, expected);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.files, files);
});

test("braces inside strings do not end the JSON early", () => {
  const body = '{"campagne":"a } b","cartes":[{"titre":"{x}"}]}\n';
  const result = parseGuideAnswer(`### cards.json\n${body}Thanks!\n`, ["cards.json"]);
  assert.equal(result.files["cards.json"], body);
});

test("a horizontal rule and explanatory paragraph after the last markdown file are dropped", () => {
  const text = "### sources.md\n# Sources\n\n- a\n\n---\n\nJ'espère que ça convient ! Dis-moi si tu veux ajuster.\n";
  assert.equal(parseGuideAnswer(text, ["sources.md"]).files["sources.md"], "# Sources\n\n- a\n");
});

test("a sign-off line after the last markdown file is dropped", () => {
  const text = "### sources.md\n# Sources\n\n- a\n\nI hope this helps!\nLet me know if you want changes.\n";
  assert.equal(parseGuideAnswer(text, ["sources.md"]).files["sources.md"], "# Sources\n\n- a\n");
});

test("when unsure the markdown tail is kept", () => {
  const text = "### sources.md\n# Sources\n\n- a\n\n---\n\nThe second source is paywalled.\n";
  assert.equal(parseGuideAnswer(text, ["sources.md"]).files["sources.md"], "# Sources\n\n- a\n\n---\n\nThe second source is paywalled.\n");
});

test("a closed markdown block is never trimmed", () => {
  const body = "# Sources\n\n- a\n\nI hope this is accurate.\n";
  const text = `=== FILE: sources.md ===\n${body}=== END FILE ===\n`;
  assert.equal(parseGuideAnswer(text, ["sources.md"]).files["sources.md"], body);
});

// Normalisation and malformed JSON
test("a leading BOM is removed from JSON content and nothing else is touched", () => {
  const body = '{"cartes": [{"titre": "“smart” quotes stay"}]}';
  const result = parseGuideAnswer(`=== FILE: cards.json ===\n﻿${body}\n`, ["cards.json"]);
  assert.equal(result.files["cards.json"], `${body}\n`);
});

test("JSON comments and trailing commas are reported with line and column, not repaired", () => {
  const comment = parseGuideAnswer('=== FILE: cards.json ===\n{\n  // note\n  "cartes": []\n}\n', ["cards.json"]);
  assert.equal(comment.problems[0].code, "invalid-json");
  assert.match(comment.problems[0].message, /^cards\.json: .*line 2, column 3/);
  assert.deepEqual(comment.files, {});
  const trailing = parseGuideAnswer('=== FILE: cards.json ===\n{\n  "cartes": [1,]\n}\n', ["cards.json"]);
  assert.equal(trailing.problems[0].code, "invalid-json");
  assert.match(trailing.problems[0].message, /line 2, column 16/);
});

test("a truncated JSON file is reported as invalid, not missing", () => {
  const result = parseGuideAnswer('### cards.json\n{"cartes": [\n', ["cards.json"]);
  assert.deepEqual(result.problems.map((p) => [p.file, p.code]), [["cards.json", "invalid-json"]]);
});

test("the result keeps the original shape plus assumptions", () => {
  const result = parseGuideAnswer("nothing", ["cards.json"]);
  assert.deepEqual(Object.keys(result).sort(), ["assumptions", "files", "problems"]);
});

test("a header with a missing colon is still reported as malformed", () => {
  const result = parseGuideAnswer("=== FILE cards.json ==\n{}\n", ["cards.json"]);
  assert.ok(result.problems.some((p) => p.code === "malformed-header" && p.file === "cards.json"));
});

// normaliseAnswerHeader
test("normaliseAnswerHeader extracts the name from every accepted form", () => {
  const cases = [
    ["=== FILE: cards.json ===", "cards.json", true],
    ["=== FILE : cards.json ===", "cards.json", true],
    ["=== file: cards.json ===", "cards.json", true],
    ["=== FILE: outputs/cards.json ===", "cards.json", true],
    ["=== FILE: ./outputs\\cards.json ===", "cards.json", true],
    ["### cards.json", "cards.json", false],
    ["## cards.json ##", "cards.json", false],
    ["**cards.json**", "cards.json", false],
    ["`cards.json`", "cards.json", false],
    ["File: cards.json", "cards.json", false],
    ["Fichier : `cards.json`", "cards.json", false],
    ["cards.json:", "cards.json", false],
    ["--- cards.json ---", "cards.json", false],
    ["— cards.json —", "cards.json", false],
    ["​﻿=== FILE: “cards.json” ===", "cards.json", true],
    ["=== FILE：cards.json ===", "cards.json", true],
    ["  cards.json  ", "cards.json", false],
  ];
  for (const [line, name, strict] of cases) {
    const header = normaliseAnswerHeader(line);
    assert.equal(header?.name, name, line);
    assert.equal(header?.strict, strict, line);
  }
});

test("normaliseAnswerHeader flags unsafe names and ignores ordinary lines", () => {
  assert.equal(normaliseAnswerHeader("=== FILE: ../cards.json ===").unsafe, true);
  assert.equal(normaliseAnswerHeader("=== FILE: .env ===").unsafe, true);
  assert.equal(normaliseAnswerHeader("=== FILE: /etc/cards.json ===").unsafe, true);
  for (const line of ["", "   ", "Here is the result.", '{"a": 1}', "- item", "=== END FILE ===", "---", "```json"]) {
    assert.equal(normaliseAnswerHeader(line), null, line);
  }
});
