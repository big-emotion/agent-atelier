import { test } from "node:test";
import assert from "node:assert/strict";
import { speakerTurns, timedLines } from "./transcribe.mjs";

const word = (text, start, end, speaker = "speaker_0") => ({
  type: "word",
  text,
  start,
  end,
  speaker_id: speaker,
});

const words = [
  word("Hello,", 1.0, 1.3),
  { type: "spacing", text: " ", start: 1.3, end: 1.4 },
  word("everyone.", 1.4, 1.9),
  word("Yes.", 2.0, 2.2, "speaker_1"),
  word("So", 2.4, 2.5),
  word("then.", 2.6, 2.9),
  word("Later", 6.0, 6.4),
];

test("a turn ends when the speaker changes or after a long silence", () => {
  assert.deepEqual(
    speakerTurns(words).map((t) => [t.speaker, t.start, t.end, t.text]),
    [
      ["speaker_0", 1.0, 1.9, "Hello, everyone."],
      ["speaker_1", 2.0, 2.2, "Yes."],
      ["speaker_0", 2.4, 2.9, "So then."],
      ["speaker_0", 6.0, 6.4, "Later"],
    ]
  );
});

test("timed lines break at punctuation and carry each word's start", () => {
  assert.deepEqual(timedLines(words), [
    "Hello,@1.00 |1.30 0",
    "everyone.@1.40 |1.90 0",
    "Yes.@2.00 |2.20 1",
    "So@2.40 then.@2.60 |2.90 0",
    "Later@6.00 |6.40 0",
  ]);
});
