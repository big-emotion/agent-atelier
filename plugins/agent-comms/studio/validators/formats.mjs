import { describeDeck } from "./deck.mjs";
import {
  MAX_TITLE_WORDS,
  isNonEmptyString,
  parseJson,
  plainLanguageProblems,
  wordCount,
} from "./common.mjs";

const MAX_ALT_CHARS = 150;
const MAX_TEXTCARD_WORDS = 12;
const MIN_SCENES = 3;
const MAX_SCENES = 12;
const SHOT_KEYS = ["kind", "imageId", "identite", "text"];
const ALT_FILLER = /^(an? )?(image|picture|photo|photograph)( of| showing)\b/i;

const imageIdsIn = (ctx) => {
  const images = parseJsonSilently(ctx?.files?.["images.json"])?.images;
  return Array.isArray(images) ? images.map((image) => image?.id) : null;
};

function parseJsonSilently(text) {
  try {
    return typeof text === "string" ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- single image

export function validateImageJson(text, ctx = {}) {
  const parsed = parseJson(text, "image.json");
  if (parsed.problems) return parsed.problems;
  const doc = parsed.value;
  const problems = [];

  if (!isNonEmptyString(doc.campagne)) problems.push("campagne is required (a short slug for the piece).");
  if (!isNonEmptyString(doc.titre)) problems.push("titre is required.");
  else if (wordCount(doc.titre) > MAX_TITLE_WORDS) problems.push(`titre: the title has ${MAX_TITLE_WORDS} words at most.`);

  if (isNonEmptyString(doc.texte)) {
    problems.push(...plainLanguageProblems("texte", doc.texte));
    // Text states something, so it carries its source; a title-only image does not.
    if (!isNonEmptyString(doc.source)) problems.push("source is required when texte is present: every claim carries its source.");
  }

  // Alt text describes what the picture shows, for someone who cannot see it.
  if (!isNonEmptyString(doc.alt)) problems.push("alt is required: describe what the image shows.");
  else if (doc.alt.length > MAX_ALT_CHARS) problems.push(`alt is longer than ${MAX_ALT_CHARS} characters.`);
  else if (ALT_FILLER.test(doc.alt.trim())) problems.push("alt must describe the scene directly, without 'image of' or 'photo of'.");

  const ids = imageIdsIn(ctx);
  if (!isNonEmptyString(doc.image?.id)) problems.push("image.id is required (an id from images.json).");
  else if (ids && !ids.includes(doc.image.id)) problems.push(`image.id "${doc.image.id}" is not in images.json.`);
  if (!isNonEmptyString(doc.image?.identite)) problems.push("image.identite is required: one sentence on what the image shows.");
  return problems;
}

// ------------------------------------------------------------------------ reel

export function validateScenes(text, ctx = {}) {
  const parsed = parseJson(text, "scenes.json");
  if (parsed.problems) return parsed.problems;
  const doc = parsed.value;
  const problems = [];

  if (doc.version !== 1) problems.push("version must be 1.");
  if (!isNonEmptyString(doc.campaign)) problems.push("campaign is required (a short slug for the piece).");
  if (!isNonEmptyString(doc.title)) problems.push("title is required.");
  else if (wordCount(doc.title) > MAX_TITLE_WORDS) problems.push(`title: the title has ${MAX_TITLE_WORDS} words at most.`);
  if (doc.aspect !== "9:16") problems.push('aspect must be "9:16".');

  const scenes = doc.scenes;
  if (!Array.isArray(scenes)) return [...problems, "scenes must be a list."];
  if (scenes.length < MIN_SCENES || scenes.length > MAX_SCENES) {
    problems.push(`A reel has ${MIN_SCENES} to ${MAX_SCENES} scenes, this one has ${scenes.length}.`);
  }
  if (scenes[0]?.role !== "hook") problems.push('The first scene must have role "hook".');
  if (scenes.length > 0 && scenes[scenes.length - 1]?.role !== "closing") problems.push('The last scene must have role "closing".');

  const ids = imageIdsIn(ctx);
  const seen = new Set();

  scenes.forEach((scene, index) => {
    const at = `scenes[${index}]`;
    if (!/^[a-z0-9-]+$/.test(scene?.id ?? "")) problems.push(`${at}.id must be lowercase letters, digits and dashes.`);
    else if (seen.has(scene.id)) problems.push(`${at}.id "${scene.id}" is a duplicate.`);
    else seen.add(scene.id);

    if (!isNonEmptyString(scene?.voiceover)) problems.push(`${at}.voiceover is required.`);
    else problems.push(...plainLanguageProblems(`${at}.voiceover`, scene.voiceover));
    if (!isNonEmptyString(scene?.captionText)) problems.push(`${at}.captionText is required.`);
    else problems.push(...plainLanguageProblems(`${at}.captionText`, scene.captionText));

    // The hook asks and the closing invites; every other scene states something.
    if (scene?.role === "body" && !isNonEmptyString(scene.source)) {
      problems.push(`${at}.source is required: every claim carries its source.`);
    }
    if (!["hook", "body", "closing"].includes(scene?.role)) problems.push(`${at}.role must be hook, body or closing.`);

    const shot = scene?.shot;
    if (shot?.kind === "still") {
      if (!isNonEmptyString(shot.imageId)) problems.push(`${at}.shot.imageId is required for a still.`);
      else if (ids && !ids.includes(shot.imageId)) problems.push(`${at}.shot.imageId "${shot.imageId}" is not in images.json.`);
      if (!isNonEmptyString(shot.identite)) problems.push(`${at}.shot.identite is required: one sentence on what the still shows.`);
    } else if (shot?.kind === "textcard") {
      if (!isNonEmptyString(shot.text)) problems.push(`${at}.shot.text is required for a text card.`);
      else if (wordCount(shot.text) > MAX_TEXTCARD_WORDS) problems.push(`${at}.shot.text has more than ${MAX_TEXTCARD_WORDS} words.`);
    } else {
      problems.push(`${at}.shot.kind must be "still" or "textcard".`);
    }
    // The render engine owns layout: the contract says what is shown, never how.
    for (const key of Object.keys(shot ?? {})) {
      if (!SHOT_KEYS.includes(key)) problems.push(`${at}.shot.${key} is not part of the contract (engine-neutral: no layout, font or colour fields).`);
    }
  });
  return problems;
}

const squash = (value) => value.replace(/\s+/g, " ").trim();

export function validateNarration(text, ctx = {}) {
  if (text.trim() === "") return ["narration.txt is empty."];
  const scenes = describeDeck(ctx.files) && parseJsonSilently(ctx.files?.["scenes.json"])?.scenes;
  if (!Array.isArray(scenes)) return [];
  const expected = squash(scenes.map((scene) => scene?.voiceover ?? "").join(" "));
  return squash(text) === expected
    ? []
    : ["narration.txt must contain the voiceover of every scene, in order, and nothing else."];
}
