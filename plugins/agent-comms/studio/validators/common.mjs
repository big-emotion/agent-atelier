// Shared checks for the deliverable validators. Every validator returns an
// array of plain-language problems; an empty array means the file is accepted.
// The same functions run on an API run's outputs and on a guide-mode paste, so
// neither mode can ship something the other would refuse.

// Fixed by the studio contract: the portal looks this heading up verbatim,
// whatever the language of the project.
export const CHOICES_HEADING = "## Choix faits pour toi";

export const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

// A sentence ends at ., !, ? or an ellipsis followed by a space or the end.
// Decimal numbers and abbreviations without a following space stay whole.
export const splitSentences = (text) =>
  text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

export const isHttpUrl = (value) => {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

export const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

export function parseJson(text, label) {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { problems: [`${label} is not valid JSON: ${error.message}`] };
  }
}

// Section headings are identifiers the client looks up, not prose. The packs
// tell the model to copy them exactly; a model writing for a French profile
// translates them anyway, so each English heading also accepts its French name.
// Keys carry the hash marks, values are the plain French alternatives. The
// choices heading is absent on purpose: it is already French and stays as is.
// The portal's French labels (piece/markdown-document) draw on the same names.
export const HEADING_ALIASES = {
  "## Question": ["Question"],
  "## Angle": ["Angle"],
  "## Promise": ["Promesse"],
  "## What this piece will not say": ["Ce que cette pièce ne dira pas", "Ce que ce contenu ne dira pas"],
  "## Sources": ["Sources"],
  "## Reservations": ["Réserves", "Réservations"],
  "## Headline": ["En bref"],
  "## Acquisition": ["Acquisition"],
  "## Devices": ["Appareils"],
  "## Page verdicts": ["Verdicts par page"],
  "## Coverage": ["Couverture"],
  "## Findings": ["Constats"],
  "## Handoffs": ["Transmissions"],
  "### For content-strategist": ["Pour content-strategist"],
  "## Plan": ["Plan"],
  "## Not collected this run": ["Non collecté lors de cette exécution", "Non collecté cette fois"],
  "## Images": ["Images"],
  "## Claims": ["Affirmations"],
};

const normaliseHeadingText = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const splitHeading = (heading) => {
  const [, hashes, text] = /^(#+)\s+(.*)$/.exec(heading);
  return { level: hashes.length, text };
};

// The canonical heading first, then its French alternatives (those that differ from it), all with the hash marks.
export function acceptedHeadings(heading) {
  const hashes = "#".repeat(splitHeading(heading).level);
  const sameAsCanonical = normaliseHeadingText(splitHeading(heading).text);
  const alternatives = (HEADING_ALIASES[heading] ?? []).filter((alias) => normaliseHeadingText(alias) !== sameAsCanonical);
  return [heading, ...alternatives.map((alias) => `${hashes} ${alias}`)];
}

// Heading lines of a document with their level and line index. Case, accents and
// spacing are tolerated for the aliased headings; any other heading is compared
// verbatim (but for trailing spaces), so the choices heading cannot drift.
function locateHeading(markdown, heading) {
  const { level } = splitHeading(heading);
  const spellings = acceptedHeadings(heading);
  const exact = spellings.length === 1;
  const wanted = new Set(spellings.map((spelling) => normaliseHeadingText(splitHeading(spelling).text)));
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const found = /^(#{1,6})\s+(.*?)\s*$/.exec(lines[index]);
    if (!found || found[1].length !== level) continue;
    const matches = exact ? `${found[1]} ${found[2]}` === heading : wanted.has(normaliseHeadingText(found[2]));
    if (matches) return { lines, index, level };
  }
  return null;
}

export const hasHeading = (markdown, heading) => locateHeading(markdown, heading) !== null;

// Body of a section, up to the next heading of the same or a higher level.
export function sectionBody(markdown, heading) {
  const located = locateHeading(markdown, heading);
  if (!located) return null;
  const { lines, index, level } = located;
  const rest = lines.slice(index + 1);
  const next = rest.findIndex((line) => new RegExp(`^#{1,${level}}\\s`).test(line));
  return (next === -1 ? rest : rest.slice(0, next)).join("\n").trim();
}

// Actionable: the heading expected, every accepted spelling, and the rule that
// headings are copied from the prompt, whatever the language of the text.
export function missingSectionMessage(heading) {
  const [expected, ...alternatives] = acceptedHeadings(heading);
  const quoted = (value) => `"${value}"`;
  const alsoEn = alternatives.length > 0 ? ` (also accepted: ${alternatives.map(quoted).join(" or ")})` : "";
  const name = splitHeading(expected).text;
  const frenchName = alternatives.length > 0 ? splitHeading(alternatives[0]).text : name;
  const alsoFr =
    alternatives.length > 0
      ? `, en anglais : ${quoted(expected)} ; la version française ${quoted(alternatives[0])} est aussi acceptée`
      : `, tel quel : ${quoted(expected)}`;
  return `Missing section ${quoted(expected)}${alsoEn}. Keep the heading exactly as written in the prompt, with its hash marks; only the text under it is in the profile's language. (Il manque la section « ${frenchName} ». Garde les titres exactement comme dans le prompt${alsoFr}.)`;
}

export function requireHeadings(markdown, headings) {
  return headings.filter((heading) => !hasHeading(markdown, heading)).map(missingSectionMessage);
}

// The choices are read by the client. A model running in someone's own session
// sometimes explains itself by quoting the contract or the user's chat
// preferences; that is never a decision about the subject.
const META_WORD = /(?<![\p{L}])(contrats?|contracts?|validateurs?|validators?|préférences?|preferences?|instructions?|prompts?|tirets?)(?![\p{L}])/iu;

// One bullet per choice, each with a reason after a dash: "- <choice> — <why>".
// Only this section is scanned for meta words: the same words are legitimate
// subject vocabulary everywhere else in a deliverable.
export function validateChoicesSection(markdown) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === CHOICES_HEADING);
  if (start === -1) return [missingSectionMessage(CHOICES_HEADING)];
  const end = lines.findIndex((line, i) => i > start && /^#{1,2}\s/.test(line));
  const section = lines.slice(start + 1, end === -1 ? lines.length : end);
  const bullets = section
    .map((text, offset) => ({ text, number: start + 2 + offset }))
    .filter(({ text }) => /^\s*[-*]\s+/.test(text));
  if (bullets.length === 0) return [`"${CHOICES_HEADING}" must list at least one choice.`];

  const problems = [];
  for (const { text, number } of bullets) {
    const meta = META_WORD.exec(text);
    if (meta) {
      problems.push(
        `"${CHOICES_HEADING}", line ${number}, mentions "${meta[1]}": state only the decision and its reason about the subject, never the contract, the instructions or anyone's preferences. (Ligne ${number} : parle uniquement du sujet.)`,
      );
    }
    if (!/\s[—–-]\s+\S.{2,}/.test(text)) {
      problems.push(`A choice has no reason ("<choice> — <reason>"): ${text.trim().slice(0, 60)}`);
    }
  }
  return problems;
}

export const INTERNAL_NOTE = /\b(TODO|TBD|FIXME|to confirm|to be confirmed|à confirmer|à nommer|à compléter)\b|\*\*/i;

export const MAX_SENTENCE_WORDS = 20;
export const MAX_TITLE_WORDS = 8;
// A person or a reference leading the sentence instead of the subject.
const REFERENCE_FIRST = /^(according to|as (stated|noted|reported) by|selon|d['’]après)\b/i;

// The plain-language rules shared by every format: nothing internal printed,
// short sentences, the subject before its reference.
export function plainLanguageProblems(at, value) {
  const problems = [];
  if (INTERNAL_NOTE.test(value)) problems.push(`${at} carries an internal note or markup that would be printed.`);
  for (const sentence of splitSentences(value)) {
    if (wordCount(sentence) > MAX_SENTENCE_WORDS) {
      problems.push(`${at}: a sentence has more than ${MAX_SENTENCE_WORDS} words: "${sentence.slice(0, 50)}…"`);
    }
    if (REFERENCE_FIRST.test(sentence)) {
      problems.push(`${at}: subject first, reference after: "${sentence.slice(0, 50)}…"`);
    }
  }
  return problems;
}
