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

const headingLine = (heading) => new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");

export const hasHeading = (markdown, heading) => headingLine(heading).test(markdown);

// Body of a section, up to the next heading of the same or a higher level.
export function sectionBody(markdown, heading) {
  const match = headingLine(heading).exec(markdown);
  if (!match) return null;
  const level = heading.match(/^#+/)[0].length;
  const rest = markdown.slice(match.index + match[0].length);
  const next = new RegExp(`^#{1,${level}}\\s`, "m").exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

export function requireHeadings(markdown, headings) {
  return headings
    .filter((heading) => !hasHeading(markdown, heading))
    .map((heading) => `Missing section "${heading}".`);
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
  if (start === -1) return [`Missing section "${CHOICES_HEADING}".`];
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
