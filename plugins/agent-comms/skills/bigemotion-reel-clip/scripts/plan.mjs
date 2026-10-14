// The plan of a reel clip: where the excerpt sits in the source, the French
// captions timed on the speaker's voice, and the headline above the frame.
// Times stay on the source clock, so the operator can check them against the
// original video; they move to the reel clock only here.

// Two lines of the 52 px caption face fit about 30 characters each in the
// 960 px column. The browser measures the real fit at render time; this bound
// refuses the obvious overflows before anything is drawn.
export const MAX_CHARACTERS = 60;
// Above this rate a viewer reads the caption instead of watching the speaker.
export const MAX_READING_RATE = 25;
// A gap shorter than this between two captions is filled by holding the first
// one: a blink of empty screen reads as a glitch, not as a pause.
const BRIDGE_SECONDS = 0.6;

const characters = (text) =>
  [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(text)]
    .length;

// A clip is [start, end] or [start, end, sourceIndex]; a phrase names its
// source with `source`. Both default to the first source.
const clipSource = (clip) => clip[2] ?? 0;
const itemSource = (item) => item.source ?? 0;

const inClip = (clips, item) =>
  clips.some(
    (clip) =>
      clipSource(clip) === itemSource(item) &&
      item.start >= clip[0] &&
      item.end <= clip[1]
  );

// `source` for a single video, `sources` for a montage.
export const planSources = (plan) =>
  Array.isArray(plan.sources) ? plan.sources : [plan.source];

export function validatePlan(plan) {
  const errors = [];
  const sources = planSources(plan);
  if (!sources.length || sources.some((s) => typeof s !== "string" || !s))
    errors.push("source: path of the source video is required");
  if (typeof plan.credit_line !== "string" || !plan.credit_line.trim())
    errors.push("credit_line: an excerpt always names its speaker and source");
  const clips = Array.isArray(plan.clips) ? plan.clips : [];
  if (!clips.length)
    errors.push("clips: at least one [start, end] is required");
  // Clips play in plan order, so a montage may go back in a source; only an
  // overlap is refused, since it would make a phrase's place ambiguous.
  clips.forEach((clip, i) => {
    const [start, end] = clip;
    if (!(end > start)) errors.push(`clip ${i + 1}: end must follow start`);
    if (!(clipSource(clip) in sources))
      errors.push(`clip ${i + 1}: no source ${clipSource(clip)}`);
    clips.slice(0, i).forEach((other, k) => {
      if (clipSource(other) === clipSource(clip) && start < other[1] && end > other[0])
        errors.push(`clip ${i + 1}: overlaps clip ${k + 1}`);
    });
  });
  const phrases = Array.isArray(plan.phrases) ? plan.phrases : [];
  if (!phrases.length) errors.push("phrases: at least one caption is required");
  phrases.forEach((p, i) => {
    const label = `phrase ${i + 1}`;
    const text = typeof p.text === "string" ? p.text.trim() : "";
    if (!text) errors.push(`${label}: caption text is required`);
    if (!(p.end > p.start)) errors.push(`${label}: end must follow start`);
    if (!inClip(clips, p)) errors.push(`${label}: outside every clip`);
    // Compared on the reel clock: in a montage, source times are not ordered.
    const previous = phrases[i - 1];
    if (i > 0 && inClip(clips, p) && inClip(clips, previous) &&
        reelTime(clips, p, p.start) < reelTime(clips, previous, previous.end))
      errors.push(`${label}: overlaps phrase ${i}`);
    const count = characters(text);
    if (count > MAX_CHARACTERS)
      errors.push(`${label}: ${count} characters, at most ${MAX_CHARACTERS}`);
    const rate = count / (p.end - p.start);
    if (p.end > p.start && rate > MAX_READING_RATE)
      errors.push(
        `${label}: ${rate.toFixed(1)} characters per second, at most ${MAX_READING_RATE}`
      );
  });
  // DEC-023: every BBH cut ships an ASCII-only cmap, so an accent in the
  // display face silently falls back to another font mid-word.
  if (plan.headline) {
    const lines = plan.headline.lines;
    if (!Array.isArray(lines) || !lines.length || lines.length > 2)
      errors.push("headline: one or two lines");
    else if (lines.some((l) => /[^\x20-\x7e]/.test(l)))
      errors.push("headline: ASCII only, the BBH display face has no accents");
  }
  return errors;
}

export const reelDuration = (plan) =>
  round(plan.clips.reduce((sum, [a, b]) => sum + (b - a), 0));

const round = (t) => Math.round(t * 1000) / 1000;

function toReelTime(clips, t, source = 0) {
  let offset = 0;
  for (const clip of clips) {
    const [a, b] = clip;
    if (clipSource(clip) === source && t >= a && t <= b)
      return round(offset + t - a);
    offset += b - a;
  }
  throw new Error(`time ${t} of source ${source} is outside every clip`);
}

const reelTime = (clips, item, t) => toReelTime(clips, t, itemSource(item));

// `spokenEnd` keeps the voice's end for word timing; `end` may be held over a
// short silence.
export function reelPhrases(plan) {
  const moved = plan.phrases.map((p) => {
    const start = toReelTime(plan.clips, p.start, itemSource(p));
    const end = toReelTime(plan.clips, p.end, itemSource(p));
    return { start, end, spokenEnd: end, text: p.text.trim() };
  });
  for (let i = 0; i < moved.length - 1; i++) {
    const next = moved[i + 1].start;
    if (next - moved[i].end <= BRIDGE_SECONDS) moved[i].end = next;
  }
  return moved;
}

// One state per word: `said` words are lit, the rest dimmed. A translation
// does not line up word for word with the source voice, so each word lights
// up in proportion to the characters read before it — on a two-second
// caption the drift from the voice stays under a word.
export function karaokeStates(phrases) {
  const states = [];
  phrases.forEach((p, phrase) => {
    const words = p.text.split(/\s+/);
    const total = words.join("").length;
    const span = p.spokenEnd - p.start;
    let read = 0;
    words.forEach((word, k) => {
      const start = round(p.start + (span * read) / total);
      read += word.length;
      if (k > 0) states.at(-1).end = start;
      states.push({ phrase, said: k + 1, start, end: p.end });
    });
  });
  return states;
}

// The caption layer is one image sequence spanning the reel: each state's
// picture for its duration, an empty picture in between. `index` points into
// the items, null for an empty stretch.
export function captionTrack(items, duration) {
  const track = [];
  let cursor = 0;
  items.forEach((p, index) => {
    if (p.start > cursor)
      track.push({ index: null, seconds: round(p.start - cursor) });
    track.push({ index, seconds: round(p.end - p.start) });
    cursor = p.end;
  });
  if (duration > cursor)
    track.push({ index: null, seconds: round(duration - cursor) });
  return track;
}

const srtTime = (t) => {
  const ms = Math.round(t * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

export const toSrt = (phrases) =>
  phrases
    .map(
      (p, i) =>
        `${i + 1}\n${srtTime(p.start)} --> ${srtTime(p.end)}\n${p.text}\n`
    )
    .join("\n");
