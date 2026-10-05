// Builds the prompt an editor pastes into a research-capable assistant before
// the idea step. No AI turn runs here: the answer comes back as research.md,
// an optional input of the propose turn. Pure on purpose, like the guide-mode
// renderer. The text names no project: only what the caller passes appears.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LANGUAGES = ["fr", "en"];

const TEXT = {
  fr: {
    role: "Tu es un assistant de recherche. Ta tâche : rassembler ce qui est établi, et seulement cela, sur le sujet ci-dessous, pour qu'un éditeur puisse en faire une publication sourcée.",
    seed: "Sujet",
    dates: "Dates",
    today: "Aujourd'hui",
    publishDate: "Date de publication visée",
    modelPiece: "Pièce modèle (le ton et le format à suivre, pas un sujet à reprendre)",
    notes: "Notes de l'éditeur",
    history: "Contenus déjà publiés ou en préparation sur ce projet (ne propose pas un sujet déjà publié)",
    noDate: "sans date",
    asks: "Ce que tu rends",
    claims:
      "1. Une liste d'affirmations, du plus ancien au plus récent. Pour chacune : la date ou la période, l'affirmation, l'URL de la source, et en une phrase ce que cette source dit.",
    read: "2. Pour chaque source, dis si tu l'as lue en entier, lue en partie, ou non lue (seulement vue dans des résultats de recherche). N'affirme jamais le contenu d'une page que tu n'as pas ouverte.",
    notFound: "3. Une section « Non trouvé » : ce que tu as cherché sans le trouver. Dire qu'on n'a rien trouvé est une réponse valide ; n'invente rien pour combler un vide.",
    competing:
      "4. Les lectures concurrentes du sujet, s'il y en a : pour chacune, qui la soutient, sur quelles sources, et la fiabilité de chaque source (officielle, savante, témoignage, source secondaire) avec la raison de ton jugement.",
    hypothesis:
      "5. Toute hypothèse est écrite à part, étiquetée « hypothèse », jamais présentée comme un fait établi.",
    watch:
      "6. Les points de vigilance : dates ou anniversaires proches de la publication, affirmations sensibles, risques de licence pour les images, recoupements avec les contenus déjà publiés.",
    close: "Écris en français. Garde des phrases courtes. Termine par la liste des URL ouvertes et lues en entier.",
  },
  en: {
    role: "You are a research assistant. Your task: gather what is established, and only that, about the subject below, so that an editor can turn it into a sourced publication.",
    seed: "Subject",
    dates: "Dates",
    today: "Today",
    publishDate: "Target publication date",
    modelPiece: "Model piece (the tone and format to follow, not a subject to repeat)",
    notes: "Editor's notes",
    history: "Contents already published or in preparation on this project (do not propose a subject already published)",
    noDate: "undated",
    asks: "What you hand back",
    claims:
      "1. A list of claims, ordered oldest to newest. For each: the date or period, the claim, the source URL, and in one sentence what that source says.",
    read: "2. For every source, say whether you read it in full, read it in part, or did not read it (only saw it in search results). Never state the content of a page you did not open.",
    notFound: "3. A \"Not found\" section: what you looked for without finding it. Saying nothing was found is a valid answer; invent nothing to fill a gap.",
    competing:
      "4. The competing readings of the subject, if any: for each, who holds it, on which sources, and the reliability of each source (official, scholarly, testimony, secondary) with the reason for your judgement.",
    hypothesis: "5. Any hypothesis goes in its own part, labelled \"hypothesis\", never presented as established fact.",
    watch:
      "6. Points of vigilance: dates or anniversaries near the publication date, sensitive claims, licence risks for images, overlaps with the contents already published.",
    close: "Write in English. Keep sentences short. End with the list of URLs you opened and read in full.",
  },
};

const line = (entry, noDate) =>
  `- ${entry.title} (${[entry.format, entry.state, entry.publishedAt ?? noDate].filter(Boolean).join(", ")})${entry.summary ? `: ${entry.summary}` : ""}`;

export function renderResearchPrompt({ seed, cadrage, history = [], language = "fr" } = {}) {
  if (typeof seed !== "string" || seed.trim() === "") throw new Error("renderResearchPrompt: seed is required.");
  if (!DATE.test(cadrage?.today ?? "")) throw new Error("renderResearchPrompt: cadrage.today must be a YYYY-MM-DD date.");
  if (cadrage.publishDate !== undefined && !DATE.test(cadrage.publishDate)) {
    throw new Error("renderResearchPrompt: cadrage.publishDate must be a YYYY-MM-DD date.");
  }
  if (!LANGUAGES.includes(language)) throw new Error(`renderResearchPrompt: language must be one of ${LANGUAGES.join(", ")}.`);

  const t = TEXT[language];
  const dates = [`${t.today} : ${cadrage.today}`];
  if (cadrage.publishDate) dates.push(`${t.publishDate} : ${cadrage.publishDate}`);

  const parts = [t.role, `${t.seed}\n${seed.trim()}`, `${t.dates}\n${dates.map((d) => `- ${d}`).join("\n")}`];
  if (cadrage.modelPiece) parts.push(`${t.modelPiece}\n${line(cadrage.modelPiece, t.noDate)}`);
  if (cadrage.notes?.trim()) parts.push(`${t.notes}\n${cadrage.notes.trim()}`);
  if (history.length > 0) parts.push(`${t.history}\n${history.map((entry) => line(entry, t.noDate)).join("\n")}`);
  parts.push(`${t.asks}\n${[t.claims, t.read, t.notFound, t.competing, t.hypothesis, t.watch].join("\n")}\n\n${t.close}`);
  return parts.join("\n\n");
}
