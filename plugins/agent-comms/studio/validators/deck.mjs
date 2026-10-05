import { isNonEmptyString } from "./common.mjs";

// What the shared files (images.json, citations.json, sources.md) have to agree
// with: the main file of the format that is present in the run. A carousel has
// cards.json, a single image has image.json, a reel has scenes.json.
const readJson = (files, name) => {
  try {
    return typeof files?.[name] === "string" ? JSON.parse(files[name]) : null;
  } catch {
    return null;
  }
};

export function describeDeck(files) {
  const cards = readJson(files, "cards.json")?.cartes;
  if (Array.isArray(cards)) {
    return {
      format: "carousel",
      mainFile: "cards.json",
      noun: "card",
      citationKey: "card",
      units: cards.map((card) => ({ ref: card?.rang, label: `Card ${card?.rang}`, sourced: isNonEmptyString(card?.source) })),
      imageIds: cards.map((card) => card?.image?.id),
    };
  }
  const single = readJson(files, "image.json");
  if (single) {
    return {
      format: "image",
      mainFile: "image.json",
      noun: "card",
      citationKey: "card",
      units: [{ ref: 1, label: "Card 1", sourced: isNonEmptyString(single.source) }],
      imageIds: [single.image?.id],
    };
  }
  const scenes = readJson(files, "scenes.json")?.scenes;
  if (Array.isArray(scenes)) {
    return {
      format: "reel",
      mainFile: "scenes.json",
      noun: "scene",
      citationKey: "scene",
      units: scenes.map((scene) => ({ ref: scene?.id, label: `Scene ${scene?.id}`, sourced: isNonEmptyString(scene?.source) })),
      imageIds: scenes.map((scene) => (scene?.shot?.kind === "still" ? scene.shot.imageId : null)),
    };
  }
  return null;
}
