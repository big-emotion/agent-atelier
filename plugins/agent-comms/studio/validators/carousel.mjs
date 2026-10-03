import { describeDeck } from "./deck.mjs";
import {
  plainLanguageProblems,
  CHOICES_HEADING,
  hasHeading,
  isHttpUrl,
  isNonEmptyString,
  parseJson,
  validateChoicesSection,
  wordCount,
} from "./common.mjs";

const MIN_CARDS = 4;
const MAX_CARDS = 9;
const MAX_COVER_WORDS = 8;
const MAX_QUOTE_CHARS = 300;
const PAIR_TEXT_FIELDS = ["titre", "precision", "punchline", "corps"];
const COMMONS_TITLE = /^File:.+\.(jpe?g|png|webp)$/i;

const parsedFile = (ctx, name) => {
  const text = ctx?.files?.[name];
  if (typeof text !== "string") return null;
  const parsed = parseJson(text, name);
  return parsed.value ?? null;
};

const imageIdsOf = (ctx) => {
  const images = parsedFile(ctx, "images.json")?.images;
  return Array.isArray(images) ? images.map((image) => image?.id) : null;
};

export function validateCards(text, ctx = {}) {
  const parsed = parseJson(text, "cards.json");
  if (parsed.problems) return parsed.problems;
  const deck = parsed.value;
  const problems = [];

  if (!isNonEmptyString(deck.campagne)) problems.push("campagne is required (a short slug for the piece).");
  const cards = deck.cartes;
  if (!Array.isArray(cards)) return [...problems, "cartes must be a list."];
  if (cards.length < MIN_CARDS || cards.length > MAX_CARDS) {
    problems.push(`A deck has ${MIN_CARDS} to ${MAX_CARDS} cards, this one has ${cards.length}.`);
  }
  if (cards[0]?.role !== "ouverture") problems.push('The first card must have role "ouverture" (the cover).');

  const imageIds = imageIdsOf(ctx);

  cards.forEach((card, index) => {
    const at = `cartes[${index}]`;
    if (card.rang !== index + 1) problems.push(`${at}.rang must be ${index + 1} (ranks run 1..n in order).`);
    if (!isNonEmptyString(card.role)) problems.push(`${at}.role is required.`);
    if (!isNonEmptyString(card.titre)) problems.push(`${at}.titre is required.`);

    if (index === 0 && isNonEmptyString(card.titre) && wordCount(card.titre) > MAX_COVER_WORDS) {
      problems.push(`${at}.titre: the cover title has ${MAX_COVER_WORDS} words at most.`);
    }

    for (const field of PAIR_TEXT_FIELDS) {
      const value = card[field];
      if (!isNonEmptyString(value)) continue;
      problems.push(...plainLanguageProblems(`${at}.${field}`, value));
    }

    // A claim without a source never reaches a reader. The cover asks a question
    // and the closing card invites; every other card states something.
    if (index > 0 && card.role !== "bascule" && !isNonEmptyString(card.source)) {
      problems.push(`${at}.source is required: every claim carries its source.`);
    }

    if (!isNonEmptyString(card.image?.id)) {
      problems.push(`${at}.image.id is required (an id from images.json).`);
    } else if (imageIds && !imageIds.includes(card.image.id)) {
      problems.push(`${at}.image.id "${card.image.id}" is not in images.json.`);
    }
    if (!isNonEmptyString(card.image?.identite)) {
      problems.push(`${at}.image.identite is required: one sentence on what the image shows.`);
    }

    if (card.paires != null) {
      const pairs = card.paires;
      const valid = Array.isArray(pairs) && pairs.length >= 2 && pairs.length <= 4 &&
        pairs.every((pair) => isNonEmptyString(pair?.terme) && isNonEmptyString(pair?.glose));
      if (!valid) problems.push(`${at}.paires takes two to four pairs, each with terme and glose.`);
    }
  });

  return problems;
}

export function validateImages(text, ctx = {}) {
  const parsed = parseJson(text, "images.json");
  if (parsed.problems) return parsed.problems;
  const images = parsed.value.images;
  if (!Array.isArray(images) || images.length === 0) return ["images must list at least one image."];
  const problems = [];
  const seen = new Set();

  images.forEach((image, index) => {
    const at = `images[${index}]`;
    if (!isNonEmptyString(image?.id)) problems.push(`${at}.id is required.`);
    else if (seen.has(image.id)) problems.push(`${at}.id "${image.id}" is a duplicate.`);
    else seen.add(image.id);

    if (!COMMONS_TITLE.test(image?.commonsTitle ?? "")) {
      problems.push(`${at}.commonsTitle must be a Wikimedia Commons title like "File:Name.jpg" (jpeg, png or webp).`);
    }
    if (!isNonEmptyString(image?.reason)) problems.push(`${at}.reason is required.`);
    // Any licence written here is ignored: the server reads it from Commons.
  });

  const deck = describeDeck(ctx.files);
  if (deck?.format === "image" && images.length !== 1) {
    problems.push("A single image lists exactly one image in images.json.");
  }
  if (deck) {
    const used = new Set(deck.imageIds);
    for (const id of seen) if (!used.has(id)) problems.push(`Image "${id}" is used by no ${deck.noun === "scene" ? "scene" : "card"}.`);
  }
  return problems;
}

export function validateCitations(text, ctx = {}) {
  const parsed = parseJson(text, "citations.json");
  if (parsed.problems) return parsed.problems;
  const citations = parsed.value.citations;
  if (!Array.isArray(citations)) return ["citations must be a list."];
  const problems = [];
  const deck = describeDeck(ctx.files);
  const key = deck?.citationKey ?? "card";

  citations.forEach((citation, index) => {
    const at = `citations[${index}]`;
    const ref = citation?.[key];
    if (ref === undefined || ref === null || ref === "") {
      problems.push(`${at}.${key} is required: the ${deck?.noun ?? "card"} that makes the claim.`);
    } else if (deck && !deck.units.some((unit) => unit.ref === ref)) {
      problems.push(`${at}: ${key} ${ref} does not exist in ${deck.mainFile}.`);
    }
    if (!isNonEmptyString(citation?.claim)) problems.push(`${at}.claim is required.`);
    if (!isHttpUrl(citation?.sourceUrl)) problems.push(`${at}.sourceUrl must be an http(s) URL.`);
    if (!isNonEmptyString(citation?.quote)) {
      problems.push(`${at}.quote is required: copy the words from the source.`);
    } else if (citation.quote.length > MAX_QUOTE_CHARS) {
      problems.push(`${at}.quote is longer than ${MAX_QUOTE_CHARS} characters; quote the one sentence that carries the claim.`);
    }
  });

  if (deck) {
    const cited = new Set(citations.map((citation) => citation?.[key]));
    for (const unit of deck.units) {
      if (unit.sourced && !cited.has(unit.ref)) problems.push(`${unit.label} has a source but no entry in citations.json.`);
    }
  }
  return problems;
}

export function validateSources(text, ctx = {}) {
  const problems = [];
  if (text.trim() === "") return ["sources.md is empty."];
  const images = parsedFile(ctx, "images.json")?.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (image?.commonsTitle && !text.includes(image.commonsTitle)) {
        problems.push(`sources.md must list the image ${image.commonsTitle}.`);
      }
    }
  }
  const citations = parsedFile(ctx, "citations.json")?.citations;
  if (Array.isArray(citations)) {
    for (const url of new Set(citations.map((citation) => citation?.sourceUrl).filter(Boolean))) {
      if (!text.includes(url)) problems.push(`sources.md must list the cited source ${url}.`);
    }
  }
  return problems;
}

// A network section is any "## <name>" block other than the choices section.
const networkSections = (markdown) =>
  markdown
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const [title, ...body] = chunk.split("\n");
      return { name: title.trim(), body: body.join("\n").trim() };
    })
    .filter((section) => `## ${section.name}` !== CHOICES_HEADING);

export function validateCaptions(text, ctx = {}) {
  const problems = [];
  const sections = networkSections(text);
  if (sections.length === 0) problems.push('captions.md needs at least one network section ("## <network>").');

  for (const network of ctx.networks ?? []) {
    const section = sections.find((s) => s.name.toLowerCase() === network.toLowerCase());
    if (!section || section.body === "") problems.push(`captions.md has no caption for the network ${network}.`);
  }
  for (const [network, limit] of Object.entries(ctx.captionLimits ?? {})) {
    const section = sections.find((s) => s.name.toLowerCase() === network.toLowerCase());
    if (section && section.body.length > limit) {
      problems.push(`The ${network} caption is ${section.body.length} characters, the limit is ${limit}.`);
    }
  }
  if (!hasHeading(text, CHOICES_HEADING)) return [...problems, `Missing section "${CHOICES_HEADING}".`];
  return [...problems, ...validateChoicesSection(text)];
}
