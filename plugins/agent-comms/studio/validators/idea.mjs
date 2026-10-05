import { MAX_BEFORE_WRITING, PROPOSAL_IDS, bilingual } from "./proposals.mjs";
import {
  isHttpUrl,
  isNonEmptyString,
  parseJson,
  requireHeadings,
  sectionBody,
  splitSentences,
  validateChoicesSection,
} from "./common.mjs";

const BASES = ["dated-evidence", "exploratory"];
const FORMATS = ["carousel", "reel", "image"];

export const PLAN_STEPS = { min: 4, max: 9 };
const CHOICE_KINDS = ["chosen", "delegated"];

const tryParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// The plan is the skeleton of the piece, one step per future card or block.
// A step in the middle carries a source, as every card after the cover does;
// the opening and the closing step may only frame or invite.
function planProblems(idea) {
  const problems = [];
  const { plan } = idea;
  if (!Array.isArray(plan) || plan.length < PLAN_STEPS.min || plan.length > PLAN_STEPS.max) {
    return [
      bilingual(
        `plan must hold ${PLAN_STEPS.min} to ${PLAN_STEPS.max} steps, one per future card or block.`,
        `Le plan compte de ${PLAN_STEPS.min} à ${PLAN_STEPS.max} étapes, une par carte ou bloc à venir.`,
      ),
    ];
  }
  const known = new Set(Array.isArray(idea.sources) ? idea.sources.map((source) => source?.url) : []);
  plan.forEach((step, index) => {
    const at = `plan[${index}]`;
    if (step?.n !== index + 1) {
      problems.push(bilingual(`${at}.n must be ${index + 1}: steps are numbered from 1, in order.`, `Les étapes sont numérotées de 1, dans l'ordre.`));
    }
    if (!isNonEmptyString(step?.title)) problems.push(bilingual(`${at}.title is required.`, `L'étape ${index + 1} n'a pas de titre.`));
    if (!isNonEmptyString(step?.goal)) problems.push(bilingual(`${at}.goal is required.`, `L'étape ${index + 1} n'a pas d'objectif.`));
    if (!Array.isArray(step?.sources) || !step.sources.every(isHttpUrl)) {
      problems.push(bilingual(`${at}.sources must be a list of http(s) URLs.`, `Les sources de l'étape ${index + 1} sont des liens http(s).`));
      return;
    }
    const framing = index === 0 || index === plan.length - 1;
    if (step.sources.length === 0 && !framing) {
      problems.push(
        bilingual(
          `${at}.sources is empty: a step between the opening and the closing needs the source that carries it.`,
          `L'étape ${index + 1} n'a aucune source : une étape du milieu s'appuie sur une source.`,
        ),
      );
    }
    for (const url of step.sources.filter((candidate) => !known.has(candidate))) {
      problems.push(
        bilingual(
          `${at}.sources cites ${url}, which is not in the sources list of this report.`,
          `L'étape ${index + 1} cite une source absente de la liste des sources.`,
        ),
      );
    }
  });
  return problems;
}

function chosenProblems(idea, inputs) {
  const chosen = idea.chosen;
  if (!chosen || typeof chosen !== "object") {
    return [bilingual("chosen is required: the proposal the editor chose, or the one taken on their behalf.", "Indique la piste retenue.")];
  }
  const problems = [];
  if (!PROPOSAL_IDS.includes(chosen.proposalId)) {
    problems.push(bilingual(`chosen.proposalId must be one of: ${PROPOSAL_IDS.join(", ")}.`, "La piste retenue est p1, p2 ou p3."));
  }
  if (!CHOICE_KINDS.includes(chosen.kind)) {
    problems.push(bilingual(`chosen.kind must be one of: ${CHOICE_KINDS.join(", ")}.`, "Le type de choix est « chosen » ou « delegated »."));
  }
  if (chosen.note !== undefined && !isNonEmptyString(chosen.note)) {
    problems.push(bilingual("chosen.note must be a non-empty string when present.", "La note, si elle existe, n'est pas vide."));
  }

  const choice = inputs?.["choice.json"] ? tryParse(inputs["choice.json"]) : null;
  const proposals = inputs?.["proposals.json"] ? tryParse(inputs["proposals.json"]) : null;
  if (choice) {
    if (choice.proposalId !== chosen.proposalId) {
      problems.push(bilingual(`chosen.proposalId is ${chosen.proposalId} but the editor's choice is ${choice.proposalId}.`, "La piste retenue doit être celle du choix de l'éditeur."));
    }
    if (choice.kind !== chosen.kind) {
      problems.push(bilingual(`chosen.kind is ${chosen.kind} but the editor's choice is ${choice.kind}.`, "Le type de choix doit être celui du choix de l'éditeur."));
    }
    if ((choice.note ?? undefined) !== (chosen.note ?? undefined)) {
      problems.push(bilingual("chosen.note must repeat the editor's note word for word, and be absent when there is none.", "Recopie la note de l'éditeur telle quelle."));
    }
  }
  if (proposals && Array.isArray(proposals.proposals) && !proposals.proposals.some((p) => p?.id === chosen.proposalId)) {
    problems.push(bilingual(`chosen.proposalId ${chosen.proposalId} is not among the proposals shown.`, "Cette piste ne fait pas partie de celles proposées."));
  }
  return problems;
}

// `ctx.turn === "plan"` makes the plan, the chosen proposal and beforeWriting
// mandatory. Without a turn (the one-shot step) they stay optional, but a plan
// that is present is held to the same rules. `ctx.inputs` may carry the
// proposals.json and choice.json the turn read, to cross-check the choice.
export function validateIdeaJson(text, ctx = {}) {
  const parsed = parseJson(text, "idea.json");
  if (parsed.problems) return parsed.problems;
  const idea = parsed.value;
  const problems = [];

  for (const field of ["question", "angle", "promise", "audience"]) {
    if (!isNonEmptyString(idea[field])) problems.push(`${field} is required.`);
  }
  if (isNonEmptyString(idea.promise) && splitSentences(idea.promise).length !== 1) {
    problems.push("promise must be exactly one sentence.");
  }

  // A hook the sources cannot pay off is bait: the payoff names where it is paid.
  if (!isNonEmptyString(idea.hook?.text)) problems.push("hook.text is required.");
  if (!isNonEmptyString(idea.hook?.payoff)) {
    problems.push("hook.payoff is required: say where the sources pay the hook off, or drop the hook.");
  }

  if (!Array.isArray(idea.wontSay) || idea.wontSay.length === 0 || !idea.wontSay.every(isNonEmptyString)) {
    problems.push("wontSay must list at least one thing the piece will not claim.");
  }

  if (!Array.isArray(idea.sources) || idea.sources.length === 0) {
    problems.push("sources must list at least one source.");
  } else {
    idea.sources.forEach((source, index) => {
      if (!isNonEmptyString(source?.title)) problems.push(`sources[${index}].title is required.`);
      if (!isHttpUrl(source?.url)) problems.push(`sources[${index}].url must be an http(s) URL.`);
      if (!isNonEmptyString(source?.supports)) problems.push(`sources[${index}].supports is required.`);
    });
  }

  if (!Array.isArray(idea.reservations) || !idea.reservations.every(isNonEmptyString)) {
    problems.push("reservations must be a list of strings (empty only if nothing can fail the piece).");
  }

  if (!Array.isArray(idea.formats) || idea.formats.length === 0 || !idea.formats.every((f) => FORMATS.includes(f))) {
    problems.push(`formats must be a non-empty list drawn from: ${FORMATS.join(", ")}.`);
  }
  if (!Array.isArray(idea.networks) || idea.networks.length === 0 || !idea.networks.every(isNonEmptyString)) {
    problems.push("networks must list at least one network from the profile.");
  }

  if (!BASES.includes(idea.basis)) {
    problems.push(`basis must be one of: ${BASES.join(", ")}.`);
  } else if (!isNonEmptyString(idea.basisReason)) {
    problems.push("basisReason is required.");
  } else if (idea.basis === "dated-evidence" && !/\d{4}-\d{2}-\d{2}/.test(idea.basisReason)) {
    problems.push("basisReason must cite the date (YYYY-MM-DD) of the audience report for dated-evidence.");
  }

  const planTurn = ctx.turn === "plan";
  if (planTurn || idea.chosen !== undefined) problems.push(...chosenProblems(idea, ctx.inputs));
  if (planTurn || idea.plan !== undefined) problems.push(...planProblems(idea));
  if (planTurn || idea.beforeWriting !== undefined) {
    if (!Array.isArray(idea.beforeWriting) || idea.beforeWriting.length > MAX_BEFORE_WRITING || !idea.beforeWriting.every(isNonEmptyString)) {
      problems.push(
        bilingual(
          `beforeWriting must be a list of at most ${MAX_BEFORE_WRITING} strings (empty when nothing is left to verify).`,
          `Au plus ${MAX_BEFORE_WRITING} points à vérifier avant d'écrire ; une liste vide est permise.`,
        ),
      );
    }
  }

  return problems;
}

const IDEA_SECTIONS = [
  "## Question",
  "## Angle",
  "## Promise",
  "## What this piece will not say",
  "## Sources",
  "## Reservations",
];

export function validateIdeaMd(text, ctx = {}) {
  const problems = requireHeadings(text, ctx.turn === "plan" ? [...IDEA_SECTIONS, "## Plan"] : IDEA_SECTIONS);
  if (!/^# \S/m.test(text)) problems.push('Missing the working title ("# <title>") at the top. (Il manque le titre de travail, sur la première ligne : "# <titre>".)');
  const promise = sectionBody(text, "## Promise");
  if (promise && splitSentences(promise).length !== 1) problems.push('The "Promise" section must be exactly one sentence.');
  return [...problems, ...validateChoicesSection(text)];
}
