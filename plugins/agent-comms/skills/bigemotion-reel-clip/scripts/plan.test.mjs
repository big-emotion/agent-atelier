import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePlan,
  reelDuration,
  reelPhrases,
  karaokeStates,
  captionTrack,
  toSrt,
} from "./plan.mjs";

const plan = (over = {}) => ({
  source: "/abs/source.mp4",
  credit_line: "Satya Nadella · source : BG2 Pod (YouTube)",
  headline: { lines: ["EXCEL", "REINVENTE"], accent: "REINVENTE" },
  clips: [[10, 20]],
  phrases: [
    { start: 10.5, end: 13, text: "Excel est le meilleur" },
    { start: 13.2, end: 16, text: "outil de raisonnement." },
  ],
  ...over,
});

test("a complete plan is valid", () => {
  assert.deepEqual(validatePlan(plan()), []);
});

test("an excerpt always names its speaker and source", () => {
  assert.match(validatePlan(plan({ credit_line: " " })).join(), /credit_line/);
});

test("a caption outside every clip is refused", () => {
  const errors = validatePlan(
    plan({ phrases: [{ start: 25, end: 27, text: "hors coupe" }] })
  );
  assert.match(errors.join(), /outside every clip/);
});

test("overlapping captions are refused", () => {
  const errors = validatePlan(
    plan({
      phrases: [
        { start: 10.5, end: 13, text: "un" },
        { start: 12, end: 14, text: "deux" },
      ],
    })
  );
  assert.match(errors.join(), /overlaps/);
});

test("a caption read faster than 25 characters per second is refused", () => {
  const errors = validatePlan(
    plan({
      phrases: [
        { start: 10, end: 11, text: "une phrase bien trop longue pour une seconde" },
      ],
    })
  );
  assert.match(errors.join(), /characters per second/);
});

// DEC-023: the BBH cuts carry an ASCII-only cmap, an accent falls back to
// another face mid-word.
test("an accented headline is refused", () => {
  const errors = validatePlan(
    plan({ headline: { lines: ["EXCEL RÉINVENTÉ"] } })
  );
  assert.match(errors.join(), /ASCII/);
});

test("the headline is optional", () => {
  assert.deepEqual(validatePlan(plan({ headline: undefined })), []);
});

test("jump cuts add up to the reel duration", () => {
  assert.equal(reelDuration(plan({ clips: [[0, 4], [10, 12.5]] })), 6.5);
});

test("phrases move onto the reel clock and short gaps are held", () => {
  const [first, second] = reelPhrases(plan());
  assert.equal(first.start, 0.5);
  assert.equal(first.end, 3.2, "a 0.2 s gap is held by the first caption");
  assert.equal(first.spokenEnd, 3, "word timing still ends on the voice");
  assert.equal(second.start, 3.2);
});

// The French words do not line up one-to-one with the English voice, so each
// word lights up in proportion to the text already read.
test("words light up in reading order across the spoken span", () => {
  const states = karaokeStates([
    { start: 0, end: 2, spokenEnd: 2, text: "Excel est mort" },
  ]);
  assert.deepEqual(
    states.map((s) => s.said),
    [1, 2, 3]
  );
  assert.equal(states[0].start, 0);
  assert.ok(states[1].start > 0.6 && states[1].start < 0.9);
  assert.equal(states.at(-1).end, 2);
  states.slice(1).forEach((s, i) => assert.equal(s.start, states[i].end));
});

test("a held caption stays fully lit until the next one", () => {
  const states = karaokeStates([
    { start: 0, end: 2.5, spokenEnd: 2, text: "deux mots" },
  ]);
  assert.equal(states.at(-1).said, 2);
  assert.equal(states.at(-1).end, 2.5);
});

test("the caption track fills the silences with an empty picture", () => {
  const track = captionTrack([{ start: 1, end: 2 }], 3);
  assert.deepEqual(track, [
    { index: null, seconds: 1 },
    { index: 0, seconds: 1 },
    { index: null, seconds: 1 },
  ]);
});

test("the SRT carries one cue per caption", () => {
  const srt = toSrt([{ start: 0.5, end: 61.25, text: "Bonjour" }]);
  assert.equal(srt, "1\n00:00:00,500 --> 00:01:01,250\nBonjour\n");
});

// A montage cuts several sources, in whatever order the argument needs: a
// clip's third element names its source, a phrase's `source` field does too.
const montage = (over = {}) =>
  plan({
    source: undefined,
    sources: ["/abs/a.mp4", "/abs/b.mp4"],
    clips: [
      [100, 104],
      [0, 3, 1],
      [20, 22],
    ],
    phrases: [
      { start: 100.5, end: 103, text: "le constat" },
      { source: 1, start: 0.5, end: 2.5, text: "l'exemple" },
      { start: 20.2, end: 21.8, text: "le retour" },
    ],
    ...over,
  });

test("a montage may reorder clips across several sources", () => {
  assert.deepEqual(validatePlan(montage()), []);
  assert.equal(reelDuration(montage()), 9);
  const moved = reelPhrases(montage());
  assert.deepEqual(
    moved.map((p) => p.start),
    [0.5, 4.5, 7.2]
  );
});

test("a phrase is only matched against the clips of its own source", () => {
  const errors = validatePlan(
    montage({ phrases: [{ start: 1, end: 2, text: "source A, pas B" }] })
  );
  assert.match(errors.join(), /outside every clip/);
});

test("two clips of the same source may not overlap", () => {
  const errors = validatePlan(montage({ clips: [[100, 104], [103, 106]] }));
  assert.match(errors.join(), /overlaps clip 1/);
});

test("a clip naming an unknown source is refused", () => {
  const errors = validatePlan(montage({ clips: [[0, 3, 2]] }));
  assert.match(errors.join(), /source 2/);
});
