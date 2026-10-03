import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGuideAnswer } from "../parse-guide-answer.mjs";
import { STEP_DELIVERABLES } from "../validators/index.mjs";
import { readFixtureFiles } from "./helpers.mjs";

const expected = STEP_DELIVERABLES["structure-carousel"];
const outputs = readFixtureFiles(expected);
const answerFrom = (files, { close = true } = {}) =>
  "Here is the result.\n\n" +
  Object.entries(files)
    .map(([name, content]) => `=== FILE: ${name} ===\n${content}${close ? "=== END FILE ===\n" : ""}`)
    .join("\n");

test("a sample answer round-trips to the exact files", () => {
  const { files, problems } = parseGuideAnswer(answerFrom(outputs), expected);
  assert.deepEqual(problems, []);
  assert.deepEqual(files, outputs);
});

test("blocks without a closing line still parse, each ending at the next header", () => {
  const { files, problems } = parseGuideAnswer(answerFrom(outputs, { close: false }), expected);
  assert.deepEqual(problems, []);
  assert.deepEqual(files, outputs);
});

test("chatter around the blocks is ignored", () => {
  const text = "Sure!\n" + answerFrom(outputs) + "\nHope this helps.\n";
  assert.deepEqual(parseGuideAnswer(text, expected).files, outputs);
});

test("a block wrapped in a code fence is unwrapped", () => {
  const fenced = { ...outputs, "cards.json": "```json\n" + outputs["cards.json"] + "```\n" };
  assert.deepEqual(parseGuideAnswer(answerFrom(fenced), expected).files["cards.json"], outputs["cards.json"]);
});

test("a missing block reports the file name and that it is missing", () => {
  const partial = { ...outputs };
  delete partial["citations.json"];
  const { problems } = parseGuideAnswer(answerFrom(partial), expected);
  assert.deepEqual(problems, [
    { file: "citations.json", code: "missing", message: "citations.json: the block is missing from the answer." },
  ]);
});

test("an empty block reports the file name", () => {
  const { problems } = parseGuideAnswer(answerFrom({ ...outputs, "sources.md": "\n" }), expected);
  assert.deepEqual(
    problems.map((p) => [p.file, p.code]),
    [["sources.md", "empty"]],
  );
});

test("a malformed header is reported with the file it seems to announce", () => {
  const text = answerFrom(outputs).replace("=== FILE: images.json ===", "=== FILE images.json ==");
  const { problems, files } = parseGuideAnswer(text, expected);
  const codes = problems.map((p) => [p.file, p.code]);
  assert.ok(codes.some(([file, code]) => file === "images.json" && code === "malformed-header"), JSON.stringify(codes));
  assert.ok(!("images.json" in files));
});

test("a duplicated block is reported and the first one wins", () => {
  const text = answerFrom(outputs) + "\n=== FILE: cards.json ===\n{}\n=== END FILE ===\n";
  const { problems, files } = parseGuideAnswer(text, expected);
  assert.deepEqual(problems.map((p) => [p.file, p.code]), [["cards.json", "duplicate"]]);
  assert.equal(files["cards.json"], outputs["cards.json"]);
});

test("a file outside the contract is reported and not returned", () => {
  const { problems, files } = parseGuideAnswer(answerFrom({ ...outputs, "notes.txt": "hi\n" }), expected);
  assert.deepEqual(problems.map((p) => [p.file, p.code]), [["notes.txt", "unexpected"]]);
  assert.ok(!("notes.txt" in files));
});

test("a path-like file name is refused", () => {
  const text = answerFrom({ ...outputs, "../cards.json": "{}\n" });
  const { problems } = parseGuideAnswer(text, expected);
  assert.ok(problems.some((p) => p.file === "../cards.json" && p.code === "unsafe-name"));
});

test("an answer with no block at all reports every file as missing", () => {
  const { problems } = parseGuideAnswer("I could not do it.", expected);
  assert.deepEqual(problems.map((p) => p.code), expected.map(() => "missing"));
});
