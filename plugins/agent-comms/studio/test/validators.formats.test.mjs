import { test } from "node:test";
import assert from "node:assert/strict";
import { validateImageJson, validateNarration, validateScenes } from "../validators/formats.mjs";
import { validateCitations, validateImages } from "../validators/carousel.mjs";
import { jsonOf, readRun } from "./helpers.mjs";

const image = readRun("fjellvik", "image");
const reel = readRun("fjellvik", "reel");
const breakImage = (mutate) => {
  const doc = jsonOf(image, "image.json");
  mutate(doc);
  return JSON.stringify(doc);
};
const breakReel = (mutate) => {
  const doc = jsonOf(reel, "scenes.json");
  mutate(doc);
  return JSON.stringify(doc);
};
const imageCtx = { files: image };
const reelCtx = { files: reel };

test("the reference image.json is valid", () => {
  assert.deepEqual(validateImageJson(image["image.json"], imageCtx), []);
});

test("image.json: alt text is required, short, and does not say 'image of'", () => {
  const none = validateImageJson(breakImage((d) => (d.alt = "")), imageCtx);
  assert.ok(none.some((p) => /alt/.test(p)));
  const long = validateImageJson(breakImage((d) => (d.alt = "x".repeat(200))), imageCtx);
  assert.ok(long.some((p) => /alt.*150/.test(p)));
  const filler = validateImageJson(breakImage((d) => (d.alt = "Image of a road")), imageCtx);
  assert.ok(filler.some((p) => /alt.*describe/i.test(p)));
});

test("image.json: title of eight words at most, sentences of twenty at most, subject first", () => {
  assert.ok(validateImageJson(breakImage((d) => (d.titre = "The Ridge Line closes for water every single autumn")), imageCtx).some((p) => /titre.*8 words/.test(p)));
  assert.ok(validateImageJson(breakImage((d) => (d.texte = "According to the plan, crews rebuild.")), imageCtx).some((p) => /subject first/i.test(p)));
});

test("image.json: a text with no source is refused, a title-only image needs none", () => {
  assert.ok(validateImageJson(breakImage((d) => (d.source = "")), imageCtx).some((p) => /source/.test(p)));
  assert.deepEqual(validateImageJson(breakImage((d) => { d.source = ""; d.texte = ""; }), { files: { ...image, "citations.json": '{"citations":[]}' } }), []);
});

test("image.json: the image id must exist in images.json", () => {
  assert.ok(validateImageJson(breakImage((d) => (d.image.id = "img-9")), imageCtx).some((p) => /img-9/.test(p)));
});

test("images.json for a single image lists exactly one image", () => {
  const two = JSON.parse(image["images.json"]);
  two.images.push({ id: "img-2", commonsTitle: "File:B.jpg", reason: "x" });
  assert.ok(validateImages(JSON.stringify(two), imageCtx).some((p) => /exactly one/i.test(p)));
});

test("citations for a single image point at card 1", () => {
  assert.deepEqual(validateCitations(image["citations.json"], imageCtx), []);
  const wrong = JSON.parse(image["citations.json"]);
  wrong.citations[0].card = 2;
  assert.ok(validateCitations(JSON.stringify(wrong), imageCtx).some((p) => /card 2/.test(p)));
});

test("the reference scenes.json is valid", () => {
  assert.deepEqual(validateScenes(reel["scenes.json"], reelCtx), []);
});

test("scenes.json: 3 to 12 scenes, first is the hook, last is the closing", () => {
  assert.ok(validateScenes(breakReel((d) => (d.scenes = d.scenes.slice(0, 2))), reelCtx).some((p) => /3 to 12 scenes/.test(p)));
  assert.ok(validateScenes(breakReel((d) => (d.scenes[0].role = "body")), reelCtx).some((p) => /first scene.*hook/i.test(p)));
  assert.ok(validateScenes(breakReel((d) => (d.scenes[3].role = "body")), reelCtx).some((p) => /last scene.*closing/i.test(p)));
});

test("scenes.json: unique ids, a source on every body scene", () => {
  assert.ok(validateScenes(breakReel((d) => (d.scenes[1].id = "s1")), reelCtx).some((p) => /duplicate/i.test(p)));
  assert.ok(validateScenes(breakReel((d) => (d.scenes[1].source = "")), reelCtx).some((p) => /scenes\[1\]\.source/.test(p)));
});

test("scenes.json: voice-over rules and on-screen title length", () => {
  assert.ok(validateScenes(breakReel((d) => (d.title = "The Ridge Line is not closed for snow at all")), reelCtx).some((p) => /title.*8 words/.test(p)));
  const long = "This sentence goes on and on without any real stop until it has passed the twenty word limit that listeners can follow.";
  assert.ok(validateScenes(breakReel((d) => (d.scenes[1].voiceover = long)), reelCtx).some((p) => /voiceover.*20 words/.test(p)));
  assert.ok(validateScenes(breakReel((d) => (d.scenes[1].voiceover = "TODO check this.")), reelCtx).some((p) => /internal note/i.test(p)));
});

test("scenes.json: a shot is a Commons still from images.json or a text card", () => {
  assert.ok(validateScenes(breakReel((d) => (d.scenes[0].shot.imageId = "img-9")), reelCtx).some((p) => /img-9/.test(p)));
  assert.ok(validateScenes(breakReel((d) => (d.scenes[2].shot = { kind: "video" })), reelCtx).some((p) => /shot\.kind/.test(p)));
  assert.ok(validateScenes(breakReel((d) => (d.scenes[2].shot = { kind: "textcard", text: "" })), reelCtx).some((p) => /shot\.text/.test(p)));
});

test("scenes.json is engine-neutral: no pixel, font or colour fields are required or accepted as layout", () => {
  const withLayout = breakReel((d) => (d.scenes[0].shot.fontSize = 48));
  assert.ok(validateScenes(withLayout, reelCtx).some((p) => /engine-neutral/i.test(p)));
});

test("narration.txt must equal the scene voice-overs in order", () => {
  assert.deepEqual(validateNarration(reel["narration.txt"], reelCtx), []);
  const reordered = "Crews rebuild the culverts every October.\nThe Ridge Line is not closed for snow.\n";
  assert.ok(validateNarration(reordered, reelCtx).some((p) => /voiceover/i.test(p)));
  assert.ok(validateNarration("", reelCtx).some((p) => /empty/i.test(p)));
});

test("images.json for a reel: every image is used by a scene, and citations use scene ids", () => {
  assert.deepEqual(validateImages(reel["images.json"], reelCtx), []);
  const extra = JSON.parse(reel["images.json"]);
  extra.images.push({ id: "img-9", commonsTitle: "File:Z.jpg", reason: "x" });
  assert.ok(validateImages(JSON.stringify(extra), reelCtx).some((p) => /img-9.*no scene/i.test(p)));
  assert.deepEqual(validateCitations(reel["citations.json"], reelCtx), []);
  const missing = JSON.parse(reel["citations.json"]);
  missing.citations = missing.citations.filter((c) => c.scene !== "s3");
  assert.ok(validateCitations(JSON.stringify(missing), reelCtx).some((p) => /Scene s3/.test(p)));
  const unknown = JSON.parse(reel["citations.json"]);
  unknown.citations[0].scene = "s9";
  assert.ok(validateCitations(JSON.stringify(unknown), reelCtx).some((p) => /scene s9/.test(p)));
});
