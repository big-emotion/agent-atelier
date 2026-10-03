import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCaptions, validateCards, validateCitations, validateImages, validateSources } from "../validators/carousel.mjs";
import { allFixtureFiles, jsonFixture, readFixture } from "./helpers.mjs";

const files = allFixtureFiles();
const withCards = (mutate) => {
  const cards = jsonFixture("cards.json");
  mutate(cards);
  return JSON.stringify(cards);
};
const ctx = { files };

test("the reference cards.json is valid", () => {
  assert.deepEqual(validateCards(readFixture("cards.json"), ctx), []);
});

test("a cover title over eight words is refused", () => {
  const problems = validateCards(
    withCards((c) => (c.cartes[0].titre = "The Ridge Line is not closed for snow at all")),
    ctx,
  );
  assert.ok(problems.some((p) => /cartes\[0\]\.titre.*8 words/.test(p)), problems.join("\n"));
});

test("a sentence over twenty words is refused", () => {
  const long = "This sentence keeps going on and on without any real stop until it has passed the twenty word limit that readers can follow.";
  const problems = validateCards(withCards((c) => (c.cartes[1].corps = long)), ctx);
  assert.ok(problems.some((p) => /cartes\[1\]\.corps.*20 words/.test(p)), problems.join("\n"));
});

test("a reference leading a sentence is refused (subject first)", () => {
  const problems = validateCards(
    withCards((c) => (c.cartes[1].corps = "According to the plan, crews rebuild culverts.")),
    ctx,
  );
  assert.ok(problems.some((p) => /subject first/i.test(p)));
});

test("a body card with no source is refused, the closing card is exempt", () => {
  const problems = validateCards(withCards((c) => (c.cartes[2].source = "")), ctx);
  assert.ok(problems.some((p) => /cartes\[2\]\.source/.test(p)));
  assert.ok(!problems.some((p) => /cartes\[4\]\.source/.test(p)));
});

test("internal notes cannot be printed on a card", () => {
  const problems = validateCards(withCards((c) => (c.cartes[1].corps = "TODO confirm the date.")), ctx);
  assert.ok(problems.some((p) => /internal note/i.test(p)));
});

test("card ranks must run 1..n with no gap", () => {
  const problems = validateCards(withCards((c) => (c.cartes[2].rang = 7)), ctx);
  assert.ok(problems.some((p) => /rang/.test(p)));
});

test("a deck outside 4 to 9 cards is refused", () => {
  const problems = validateCards(withCards((c) => (c.cartes = c.cartes.slice(0, 3))), ctx);
  assert.ok(problems.some((p) => /4 to 9 cards/.test(p)));
});

test("the first card must be the cover", () => {
  const problems = validateCards(withCards((c) => (c.cartes[0].role = "contenu")), ctx);
  assert.ok(problems.some((p) => /first card/i.test(p)));
});

test("a card image must exist in images.json and carry an identity sentence", () => {
  const unknown = validateCards(withCards((c) => (c.cartes[1].image.id = "img-9")), ctx);
  assert.ok(unknown.some((p) => /img-9/.test(p)));
  const noIdentity = validateCards(withCards((c) => delete c.cartes[1].image.identite), ctx);
  assert.ok(noIdentity.some((p) => /identite/.test(p)));
});

test("a pair block takes two to four terms with a gloss each", () => {
  const problems = validateCards(
    withCards((c) => (c.cartes[1].paires = [{ terme: "A", glose: "x" }])),
    ctx,
  );
  assert.ok(problems.some((p) => /paires/.test(p)));
});

test("a licence written on the card image is ignored, not trusted", () => {
  const problems = validateCards(
    withCards((c) => (c.cartes[1].image.licence = "CC0")),
    ctx,
  );
  assert.deepEqual(problems, []);
});

test("images.json: reference is valid", () => {
  assert.deepEqual(validateImages(readFixture("images.json"), ctx), []);
});

test("images.json: only Commons file titles are accepted", () => {
  const bad = JSON.stringify({ images: [{ id: "img-1", commonsTitle: "https://example.com/a.jpg", reason: "x" }] });
  assert.ok(validateImages(bad, ctx).some((p) => /Commons/.test(p)));
  const png = JSON.stringify({ images: [{ id: "img-1", commonsTitle: "File:Doc.pdf", reason: "x" }] });
  assert.ok(validateImages(png, ctx).some((p) => /jpeg|png|webp/i.test(p)));
});

test("images.json: duplicate ids and unused images are refused", () => {
  const dup = JSON.stringify({
    images: [
      { id: "img-1", commonsTitle: "File:A.jpg", reason: "x" },
      { id: "img-1", commonsTitle: "File:B.jpg", reason: "y" },
    ],
  });
  assert.ok(validateImages(dup, ctx).some((p) => /duplicate/i.test(p)));
  const unused = JSON.parse(readFixture("images.json"));
  unused.images.push({ id: "img-9", commonsTitle: "File:Z.jpg", reason: "never used" });
  assert.ok(validateImages(JSON.stringify(unused), ctx).some((p) => /img-9.*no card/i.test(p)));
});

test("images.json: a licence field is tolerated because the server ignores it", () => {
  const images = JSON.parse(readFixture("images.json"));
  images.images[0].licence = "CC0";
  assert.deepEqual(validateImages(JSON.stringify(images), ctx), []);
});

test("citations.json: reference is valid", () => {
  assert.deepEqual(validateCitations(readFixture("citations.json"), ctx), []);
});

test("citations.json: a sourced card without a citation is refused", () => {
  const citations = JSON.parse(readFixture("citations.json"));
  citations.citations = citations.citations.filter((c) => c.card !== 3);
  assert.ok(validateCitations(JSON.stringify(citations), ctx).some((p) => /Card 3/.test(p)));
});

test("citations.json: unknown card, bad url and empty quote are refused", () => {
  const citations = JSON.parse(readFixture("citations.json"));
  citations.citations[0].card = 42;
  citations.citations[1].sourceUrl = "the plan";
  citations.citations[2].quote = "";
  const problems = validateCitations(JSON.stringify(citations), ctx);
  assert.ok(problems.some((p) => /card 42/.test(p)));
  assert.ok(problems.some((p) => /citations\[1\]\.sourceUrl/.test(p)));
  assert.ok(problems.some((p) => /citations\[2\]\.quote/.test(p)));
});

test("citations.json: a quote too long to match word for word is refused", () => {
  const citations = JSON.parse(readFixture("citations.json"));
  citations.citations[0].quote = "word ".repeat(80);
  assert.ok(validateCitations(JSON.stringify(citations), ctx).some((p) => /quote.*300/.test(p)));
});

test("sources.md: reference is valid", () => {
  assert.deepEqual(validateSources(readFixture("sources.md"), ctx), []);
});

test("sources.md must list every Commons title and cited url", () => {
  const md = readFixture("sources.md")
    .replace("File:Workers repairing a track.png", "an image")
    .replace("https://example.org/ridge-line/maintenance-plan", "the plan");
  const problems = validateSources(md, ctx);
  assert.ok(problems.some((p) => p.includes("File:Workers repairing a track.png")));
  assert.ok(problems.some((p) => p.includes("https://example.org/ridge-line/maintenance-plan")));
});

test("captions.md: reference is valid and a network section is required", () => {
  assert.deepEqual(validateCaptions(readFixture("captions.md"), ctx), []);
  const none = "# Captions\n\n## Choix faits pour toi\n\n- x — because\n";
  assert.ok(validateCaptions(none, ctx).some((p) => /network section/i.test(p)));
});

test("captions.md: a profile network with no section is named", () => {
  const problems = validateCaptions(readFixture("captions.md"), { ...ctx, networks: ["Instagram", "TikTok"] });
  assert.ok(problems.some((p) => p.includes("TikTok")));
});

test("captions.md: a network character limit is enforced", () => {
  const problems = validateCaptions(readFixture("captions.md"), { ...ctx, captionLimits: { LinkedIn: 20 } });
  assert.ok(problems.some((p) => /LinkedIn.*20/.test(p)));
});

test("captions.md needs the choices section", () => {
  const md = readFixture("captions.md").replace("## Choix faits pour toi", "## Notes");
  assert.ok(validateCaptions(md, ctx).some((p) => p.includes("Choix faits pour toi")));
});

test("captions.md refuses meta-commentary in its choices", () => {
  const md = readFixture("captions.md").replace("the profile asks for sourced captions", "the instructions say so");
  assert.ok(validateCaptions(md, ctx).some((p) => /instructions/.test(p) && /Choix faits pour toi/.test(p)));
});
