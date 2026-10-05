import { CHOICES_HEADING, isNonEmptyString, parseJson, validateChoicesSection } from "./common.mjs";

// The ten patterns of skills/idea/references/narrative-patterns.md. A test keeps
// this list and the catalogue table identical.
export const PATTERN_IDS = [
  "origin-explained",
  "competing-explanations",
  "chronological-trajectory",
  "perspectives",
  "circulation",
  "turning-point",
  "key-actor",
  "clarifying-comparison",
  "anecdote-entry",
  "received-claim-examined",
];

export const PROPOSAL_IDS = ["p1", "p2", "p3"];
export const MAX_PROPOSALS = 3;
export const MAX_VIGILANCE = 4;
export const MAX_BEFORE_WRITING = 5;
const BASES = ["exploratory", "measured"];

// Every message ends with the same advice in French: the editor reads these.
export const bilingual = (english, french) => `${english} (${french})`;

// A success criterion says what the reader can restate, bounded by the evidence.
// An audience figure is a different promise that nothing here has tested.
const AUDIENCE_METRIC =
  /(?<![\p{L}])(views?|likes?|engagement|reach|impressions?|followers?|click-through|clicks?|retention|watch time|vues?|j['’]aime|abonnés?|clics?|portée|rétention|taux de)(?![\p{L}])/iu;

// A single proposal is legitimate only when the reason says why there is no other.
const NO_SECOND_STORY =
  /no (second|other|alternative) (story|stories|storyline|narrative|angle)|only one (story|storyline|narrative)|aucune? (seconde|deuxième|autre) (histoire|trame|piste)|une seule (histoire|trame|piste)|pas de (seconde|deuxième|autre) (histoire|trame|piste)/iu;

const isStringList = (value, max) => Array.isArray(value) && value.length <= max && value.every(isNonEmptyString);

function proposalProblems(proposal, index) {
  const at = `proposals[${index}]`;
  const problems = [];
  if (!PROPOSAL_IDS.includes(proposal?.id)) {
    problems.push(bilingual(`${at}.id must be one of: ${PROPOSAL_IDS.join(", ")}.`, `L'identifiant doit être p1, p2 ou p3.`));
  }
  for (const field of ["title", "question", "tells", "reader", "reason"]) {
    if (!isNonEmptyString(proposal?.[field])) {
      problems.push(bilingual(`${at}.${field} is required.`, `Le champ « ${field} » de la piste ${index + 1} est vide.`));
    }
  }
  if (!PATTERN_IDS.includes(proposal?.pattern)) {
    problems.push(
      bilingual(
        `${at}.pattern must be one of the ten patterns: ${PATTERN_IDS.join(", ")}.`,
        `Le motif de la piste ${index + 1} doit être l'un des dix motifs du catalogue, écrit tel quel.`,
      ),
    );
  }
  if (!isNonEmptyString(proposal?.cannotClaim)) {
    problems.push(
      bilingual(
        `${at}.cannotClaim is required: say what the evidence does not allow to claim.`,
        `Dis ce que les sources ne permettent pas d'affirmer pour la piste ${index + 1}.`,
      ),
    );
  }
  if (!isNonEmptyString(proposal?.criterion)) {
    problems.push(bilingual(`${at}.criterion is required.`, `Le critère de réussite de la piste ${index + 1} est vide.`));
  } else {
    const metric = AUDIENCE_METRIC.exec(proposal.criterion);
    if (metric) {
      problems.push(
        bilingual(
          `${at}.criterion mentions an audience measure ("${metric[1]}"): a criterion says what the reader can restate, bounded by the evidence.`,
          `Un critère de réussite dit ce que le lecteur saura redire, pas un chiffre d'audience.`,
        ),
      );
    }
  }
  if (typeof proposal?.recommended !== "boolean") {
    problems.push(bilingual(`${at}.recommended must be true or false.`, `« recommended » doit valoir true ou false.`));
  }
  return problems;
}

export function validateProposalsJson(text) {
  const parsed = parseJson(text, "proposals.json");
  if (parsed.problems) return parsed.problems;
  const file = parsed.value;
  const problems = [];

  if (!isNonEmptyString(file.subject)) {
    problems.push(bilingual("subject is required.", "Le sujet est vide : écris-le en une phrase."));
  }

  const proposals = file.proposals;
  if (!Array.isArray(proposals) || proposals.length < 1 || proposals.length > MAX_PROPOSALS) {
    problems.push(
      bilingual(
        `proposals must hold 1 to ${MAX_PROPOSALS} items (at most ${MAX_PROPOSALS}, even if more patterns are viable).`,
        `Montre une à trois pistes, jamais plus de trois, même si d'autres motifs tiennent.`,
      ),
    );
  } else {
    proposals.forEach((proposal, index) => problems.push(...proposalProblems(proposal, index)));

    const ids = proposals.map((p) => p?.id);
    if (new Set(ids).size !== ids.length) {
      problems.push(bilingual("proposals carry the same id twice.", "Deux pistes portent le même identifiant."));
    }
    const patterns = proposals.map((p) => p?.pattern);
    if (new Set(patterns).size !== patterns.length) {
      problems.push(
        bilingual(
          "two proposals use the same pattern: that is one story twice, give each a different pattern.",
          "Deux pistes utilisent le même motif : c'est la même histoire, change l'une des deux.",
        ),
      );
    }
    if (proposals.filter((p) => p?.recommended === true).length !== 1) {
      problems.push(
        bilingual(
          "exactly one proposal must have recommended: true.",
          "Une seule piste doit être recommandée, ni zéro ni deux.",
        ),
      );
    }
    if (proposals.length === 1 && !NO_SECOND_STORY.test(proposals[0]?.reason ?? "")) {
      problems.push(
        bilingual(
          'a single proposal is allowed only if its reason says no second story is supported by the evidence (for example "No second story is supported by the evidence: ...").',
          "Une seule piste est admise si la raison dit qu'aucune seconde histoire n'est portée par les sources.",
        ),
      );
    }
  }

  if (!isStringList(file.vigilance, MAX_VIGILANCE)) {
    problems.push(
      bilingual(
        `vigilance must be a list of at most ${MAX_VIGILANCE} short strings (empty when nothing needs watching).`,
        `Au plus ${MAX_VIGILANCE} points de vigilance, courts ; une liste vide est permise.`,
      ),
    );
  }
  if (!isStringList(file.beforeWriting, MAX_BEFORE_WRITING)) {
    problems.push(
      bilingual(
        `beforeWriting must be a list of at most ${MAX_BEFORE_WRITING} strings: what is still to verify or find before writing.`,
        `Au plus ${MAX_BEFORE_WRITING} points à vérifier ou à trouver avant d'écrire.`,
      ),
    );
  }

  if (!BASES.includes(file.basis)) {
    problems.push(bilingual(`basis must be one of: ${BASES.join(", ")}.`, "« basis » doit être exploratory ou measured."));
  } else if (!isNonEmptyString(file.basisReason)) {
    problems.push(bilingual("basisReason is required.", "Dis pourquoi la base est exploratoire ou mesurée."));
  } else if (file.basis === "measured" && !/\d{4}-\d{2}-\d{2}/.test(file.basisReason)) {
    problems.push(
      bilingual(
        "basisReason must cite the date (YYYY-MM-DD) of the measure for a measured basis.",
        "Une base mesurée cite la date (AAAA-MM-JJ) de la mesure.",
      ),
    );
  }
  return problems;
}

// proposals.md is read by the editor next to the proposals: it holds the one
// choices section and nothing else, so a stray title or section is a leak of
// the writing process rather than a decision about the subject.
export function validateProposalsMd(text) {
  const problems = validateChoicesSection(text);
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === CHOICES_HEADING);
  if (start > 0 && lines.slice(0, start).some((line) => line.trim() !== "")) {
    problems.push(
      bilingual(
        `proposals.md holds only the "${CHOICES_HEADING}" section: nothing may come before it.`,
        `Ce fichier ne contient que la section « Choix faits pour toi », rien avant.`,
      ),
    );
  }
  const otherSection = lines.findIndex((line, index) => index > start && start !== -1 && /^#{1,2}\s/.test(line));
  if (otherSection !== -1) {
    problems.push(
      bilingual(
        `proposals.md holds only the "${CHOICES_HEADING}" section: remove the heading on line ${otherSection + 1}.`,
        `Ligne ${otherSection + 1} : retire ce titre, il ne reste que la section « Choix faits pour toi ».`,
      ),
    );
  }
  return problems;
}
