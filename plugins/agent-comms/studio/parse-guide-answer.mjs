// Reads the answer a user pasted back from their own session. The contract asks
// for one block per file, opened by "=== FILE: name ===", but a chat model drifts
// (a markdown title, bold, a lowercase "file:"), and a non-technical user cannot
// repair that by hand. So the parser accepts the drifts it can recognise without
// guessing, and reports the rest with the file name.
//
// Conservative by construction:
//  - a loose header (anything but the "=== FILE: ===" family) only counts when its
//    name is a deliverable of the current step, so an ordinary markdown title is
//    never taken for a file;
//  - content sniffing only assigns an unlabeled or mis-named JSON block when
//    exactly one still-missing deliverable fits it and no other block competes;
//  - JSON is never repaired: comments and trailing commas are reported with a
//    line and column, because a silent repair could change what the client reads.

const INVISIBLE = /[​-‍⁠﻿]/g;
const STRICT_HEADER = /^=+\s*FILE\s*:\s*(.+?)\s*=*$/i;
const LOOSE_HEADER = /^\s*=+\s*FILE\b/i;
const END_MARKER = /^=+\s*(?:END|FIN)(?:\s+(?:OF\s+)?(?:FILE|FICHIER))?(?:\s*:.*?)?\s*=*$/i;
const FENCE_LINE = /^\s*```/;
const BARE_FENCE = /^\s*```\s*$/;
const WRAPPER_FENCE = /^\s*```\s*(?:markdown|md|text|txt)?\s*$/i;

// Header lines only: smart quotes, no-break spaces, zero-width characters and
// typographic dashes are flattened. Content is never passed through this.
const flattenHeaderLine = (line) =>
  line
    .replace(INVISIBLE, "")
    .replace(/ /g, " ")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/：/g, ":")
    .trim();

const DECORATION = /^[\s*_`"'[\]():]+|[\s*_`"'[\]():]+$/g;

function cleanName(raw) {
  const named = raw.replace(DECORATION, "");
  if (named === "" || !/[A-Za-z0-9]/.test(named)) return null;
  const segments = named.split(/[\\/]/).filter((segment) => segment !== "." && segment !== "");
  const base = segments[segments.length - 1] ?? "";
  const unsafe = segments.includes("..") || /^[\\/]/.test(named) || base.startsWith(".");
  if (!unsafe && !/^[\w][\w.\- ]*$/.test(base)) return null;
  return unsafe ? { name: named, unsafe: true } : { name: base, unsafe: false };
}

// Returns { name, strict, unsafe } for a line that reads as a file header in one
// of the accepted forms, otherwise null. Whether the name is a deliverable of the
// current step is the caller's business.
export function normaliseAnswerHeader(line) {
  const flat = flattenHeaderLine(line);
  if (flat === "" || END_MARKER.test(flat) || flat.startsWith("```")) return null;
  const strict = STRICT_HEADER.exec(flat);
  if (strict) {
    const cleaned = cleanName(strict[1]);
    return cleaned && { ...cleaned, strict: true };
  }
  let inner = null;
  let match;
  if ((match = /^#{1,6}\s+(.+?)\s*#*$/.exec(flat))) inner = match[1];
  else if ((match = /^-{2,}\s*(.+?)\s*-{2,}$/.exec(flat)) || (match = /^-+\s+(.+?)\s+-+$/.exec(flat))) inner = match[1];
  else if ((match = /^(?:file|fichier)\s*:\s*(.+)$/i.exec(flat))) inner = match[1];
  else if (!/\s/.test(flat.replace(DECORATION, ""))) inner = flat;
  if (inner === null) return null;
  const cleaned = cleanName(inner);
  return cleaned && { ...cleaned, strict: false };
}

const isJsonName = (name) => name.toLowerCase().endsWith(".json");

const trimBlankEnds = (lines) => {
  const kept = [...lines];
  while (kept.length && kept[0].trim() === "") kept.shift();
  while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
  return kept;
};

const fenceCount = (lines) => lines.filter((line) => FENCE_LINE.test(line)).length;

// Sign-off wording a chat model appends after the last file. Matching is
// deliberately narrow: an unsure tail stays in the file and the validator speaks.
const SIGN_OFF =
  /j['’]esp[èe]re|hope (?:this|that|it)|let me know|tell me if|feel free|n['’]h[ée]site|dis-moi|dites-moi|voil[àa]\b|si tu veux|si vous voulez|would you like|want me to|tu veux que|je peux (?:aussi|ajuster|adapter)|happy to|bonne (?:chance|continuation)|good luck/i;
const isSignOffLine = (line) => SIGN_OFF.test(line);
const HORIZONTAL_RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

function dropSignOff(lines) {
  const kept = trimBlankEnds(lines);
  const ruleAt = kept.map((line, i) => (HORIZONTAL_RULE.test(line) ? i : -1)).filter((i) => i > 0 && kept[i - 1].trim() === "").pop();
  if (ruleAt !== undefined) {
    const tail = kept.slice(ruleAt + 1).filter((line) => line.trim() !== "");
    const explanatory = tail.length > 0 && tail.length <= 4 && !tail.some((line) => /^\s*#/.test(line)) && tail.some(isSignOffLine);
    if (explanatory) return trimBlankEnds(kept.slice(0, ruleAt));
  }
  let end = kept.length;
  while (end > 0) {
    let start = end;
    while (start > 0 && kept[start - 1].trim() !== "") start -= 1;
    const paragraph = kept.slice(start, end);
    if (start === 0 || !paragraph.every(isSignOffLine)) break;
    end = start;
    while (end > 0 && kept[end - 1].trim() === "") end -= 1;
  }
  return end === kept.length ? kept : kept.slice(0, end);
}

// Text and markdown content: trim blank ends, unwrap one outer fence. Nested
// fences are kept: the outer fence is only removed when what is inside is balanced.
function prepareText(lines, { trailing }) {
  let kept = trimBlankEnds(lines);
  if (kept.length && kept[0].charCodeAt(0) === 0xfeff) kept[0] = kept[0].slice(1);
  if (kept.length >= 2 && WRAPPER_FENCE.test(kept[0])) {
    let close = -1;
    for (let i = kept.length - 1; i > 0; i -= 1) {
      if (BARE_FENCE.test(kept[i])) {
        close = i;
        break;
      }
    }
    if (close > 0 && fenceCount(kept.slice(1, close)) % 2 === 0) {
      const tail = kept.slice(close + 1).filter((line) => line.trim() !== "");
      if (tail.length === 0 || tail.every(isSignOffLine)) kept = kept.slice(1, close);
    }
  } else if (kept.length >= 2 && /^\s*```/.test(kept[0]) && BARE_FENCE.test(kept[kept.length - 1]) && fenceCount(kept.slice(1, -1)) % 2 === 0) {
    kept = kept.slice(1, -1);
  }
  if (trailing) kept = dropSignOff(kept);
  kept = trimBlankEnds(kept);
  return kept.length ? `${kept.join("\n")}\n` : "";
}

// Reads the first JSON value of `text` (which starts at an opening brace or
// bracket) by matching braces outside strings, then really parsing it.
function extractJsonValue(text, from = 0) {
  const open = text[from];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        if (char !== close) return null;
        const raw = text.slice(from, i + 1);
        try {
          return { value: JSON.parse(raw), raw, end: i + 1 };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const locate = (text, position) => {
  const before = text.slice(0, Math.min(position, text.length));
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
};

// Finds where strict JSON first goes wrong. JSON.parse's own message carries a
// position only on some Node versions, and a person needs a line and a column.
function firstJsonFault(text) {
  let i = 0;
  let afterComma = false;
  const skip = () => {
    while (i < text.length && /\s/.test(text[i])) i += 1;
  };
  const fault = (reason) => ({ at: i, reason });
  const value = () => {
    skip();
    const char = text[i];
    if (char === undefined) return fault("unexpected end of text");
    if (char === "/") return fault("comments are not allowed in JSON");
    if (char === "{" || char === "[") return container(char);
    if (char === '"') return string();
    const literal = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (!literal) return fault(`unexpected "${char}"`);
    i += literal[0].length;
    return null;
  };
  const string = () => {
    i += 1;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\n") return fault("a string cannot contain a line break");
      i += text[i] === "\\" ? 2 : 1;
    }
    if (i >= text.length) return fault("unterminated string");
    i += 1;
    return null;
  };
  const container = (open) => {
    const close = open === "{" ? "}" : "]";
    i += 1;
    skip();
    if (text[i] === close) {
      i += 1;
      return null;
    }
    for (;;) {
      skip();
      if (open === "{") {
        if (text[i] === "/") return fault("comments are not allowed in JSON");
        if (text[i] === close && afterComma) return fault("trailing comma");
        if (text[i] !== '"') return fault(text[i] === undefined ? "unexpected end of text" : `expected a property name, found "${text[i]}"`);
        const key = string();
        if (key) return key;
        skip();
        if (text[i] !== ":") return fault('expected ":"');
        i += 1;
      } else if (text[i] === close && afterComma) return fault("trailing comma");
      afterComma = false;
      const inner = value();
      if (inner) return inner;
      skip();
      if (text[i] === close) {
        i += 1;
        return null;
      }
      if (text[i] === "/") return fault("comments are not allowed in JSON");
      if (text[i] !== ",") return fault(text[i] === undefined ? "unexpected end of text" : `expected "," or "${close}", found "${text[i]}"`);
      i += 1;
      afterComma = true;
    }
  };
  const found = value();
  if (found) return found;
  skip();
  return i < text.length ? fault(`unexpected "${text[i]}" after the end of the JSON`) : null;
}

function describeJsonError(text) {
  const fault = firstJsonFault(text) ?? { at: text.length, reason: "invalid JSON" };
  const { line, column } = locate(text, fault.at);
  return `is not valid JSON (line ${line}, column ${column}): ${fault.reason}.`;
}

// JSON content: a leading BOM and an opening fence line are dropped, then the
// first complete value is kept and whatever follows it (a closing fence, a
// sentence) is handed back as `rest`. Content that is valid as a whole is left
// exactly as written.
function prepareJson(lines) {
  let kept = trimBlankEnds(lines);
  if (kept.length && FENCE_LINE.test(kept[0])) kept = trimBlankEnds(kept.slice(1));
  if (kept.length && kept[0].charCodeAt(0) === 0xfeff) kept[0] = kept[0].slice(1);
  const text = kept.join("\n").trim();
  if (text === "") return { content: "", rest: "" };
  try {
    JSON.parse(text);
    return { content: `${kept.join("\n")}\n`, value: JSON.parse(text), rest: "" };
  } catch {
    // fall through to the cut
  }
  if (text[0] === "{" || text[0] === "[") {
    const found = extractJsonValue(text);
    if (found) return { content: `${found.raw}\n`, value: found.value, rest: text.slice(found.end) };
  }
  return { error: describeJsonError(text) };
}

// A line that opens an unlabeled JSON value, outside any header.
function findJsonValues(text) {
  const values = [];
  let offset = 0;
  const lines = text.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const indent = line.length - line.trimStart().length;
    const first = line.trimStart()[0];
    if (first === "{" || first === "[") {
      const from = offset + indent;
      const found = extractJsonValue(text, from);
      if (found) {
        values.push(found);
        while (offset + lines[index].length + 1 <= found.end && index < lines.length - 1) {
          offset += lines[index].length + 1;
          index += 1;
        }
        offset += lines[index].length + 1;
        index += 1;
        continue;
      }
    }
    offset += line.length + 1;
    index += 1;
  }
  return values;
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hasList = (value, key) => isObject(value) && Array.isArray(value[key]) && value[key].length > 0;
const isCitation = (item) => isObject(item) && typeof item.quote === "string" && ("claim" in item || "sourceUrl" in item);

// Structural fingerprints, one per JSON deliverable. They answer "could this be
// that file", never "is it valid": the real validators run afterwards.
const SIGNATURES = {
  "cards.json": (value) => hasList(value, "cartes"),
  "proposals.json": (value) => hasList(value, "proposals"),
  "scenes.json": (value) => hasList(value, "scenes"),
  "images.json": (value) => hasList(value, "images") || (Array.isArray(value) && value.length > 0 && value.every((item) => isObject(item) && "commonsTitle" in item)),
  "citations.json": (value) =>
    (hasList(value, "citations") && value.citations.every(isCitation)) || (Array.isArray(value) && value.length > 0 && value.every(isCitation)),
  "idea.json": (value) => isObject(value) && typeof value.question === "string" && typeof value.angle === "string" && !("proposals" in value),
  "image.json": (value) => isObject(value) && typeof value.alt === "string" && typeof value.texte === "string",
  "ideas.json": (value) => hasList(value, "ideas"),
};

const problem = (file, code, message) => ({ file, code, message: `${file}: ${message}` });

function readBlocks(text, expectedByLower) {
  const blocks = [];
  const orphans = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const flat = flattenHeaderLine(line);
    if (END_MARKER.test(flat)) {
      if (current) current.closed = true;
      current = null;
      continue;
    }
    const header = normaliseAnswerHeader(line);
    if (header && (header.strict || (!header.unsafe && expectedByLower.has(header.name.toLowerCase())))) {
      if (current) current.closed = true;
      current = { name: header.name, unsafe: header.unsafe, strict: header.strict, lines: [], malformed: false, closed: false };
      blocks.push(current);
    } else if (LOOSE_HEADER.test(flat)) {
      if (current) current.closed = true;
      const guessed = /FILE:?\s+([^\s=]+)/i.exec(flat)?.[1] ?? "(unnamed)";
      current = { name: guessed, lines: [], malformed: true, closed: false };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      orphans.push(line);
    }
  }
  return { blocks, orphans: orphans.join("\n") };
}

export function parseGuideAnswer(text, expectedFiles) {
  const files = {};
  const problems = [];
  const assumptions = [];
  const reported = new Set();
  const expectedByLower = new Map(expectedFiles.map((name) => [name.toLowerCase(), name]));
  const report = (file, code, message) => {
    const entry = problem(file, code, message);
    problems.push(entry);
    reported.add(file);
    return entry;
  };

  const { blocks, orphans } = readBlocks(text, expectedByLower);
  const pool = [orphans];
  const misnamed = [];

  blocks.forEach((block, index) => {
    const { name } = block;
    const canonical = block.unsafe ? undefined : expectedByLower.get(name.toLowerCase());
    if (block.malformed) {
      report(name, "malformed-header", `the header must read exactly "=== FILE: ${name} ===".`);
    } else if (block.unsafe) {
      report(name, "unsafe-name", "is not a valid file name.");
    } else if (!canonical) {
      const entry = report(name, "unexpected", "is not a file of this step.");
      const prepared = isJsonName(name) ? prepareJson(block.lines) : null;
      if (prepared?.value !== undefined) misnamed.push({ name, entry, value: prepared.value, content: prepared.content });
    } else if (canonical in files) {
      report(canonical, "duplicate", "appears more than once; the first block was kept.");
    } else if (isJsonName(canonical)) {
      const prepared = prepareJson(block.lines);
      if (prepared.error) report(canonical, "invalid-json", prepared.error);
      else if (prepared.content === "") report(canonical, "empty", "the block is empty.");
      else {
        files[canonical] = prepared.content;
        pool.push(prepared.rest);
      }
    } else {
      const content = prepareText(block.lines, { trailing: index === blocks.length - 1 && !block.closed });
      if (content === "") report(canonical, "empty", "the block is empty.");
      else files[canonical] = content;
    }
  });

  // Content sniffing: only for JSON deliverables that no header produced.
  const missingJson = expectedFiles.filter((name) => SIGNATURES[name] && !(name in files) && !reported.has(name));
  if (missingJson.length) {
    const candidates = [
      ...misnamed.map((item) => ({ ...item, from: item.name })),
      ...findJsonValues(pool.join("\n")).map((found) => ({ name: null, entry: null, value: found.value, content: `${found.raw}\n`, from: null })),
    ];
    const fits = candidates.map((candidate) => missingJson.filter((name) => SIGNATURES[name](candidate.value)));
    candidates.forEach((candidate, i) => {
      if (fits[i].length !== 1) return;
      const target = fits[i][0];
      const competitors = fits.filter((names) => names.includes(target)).length;
      if (competitors !== 1) return;
      files[target] = candidate.content;
      assumptions.push({
        file: target,
        kind: "recognised-by-content",
        from: candidate.from,
        message: candidate.from ? `${target} was recognised by its content (the block was labelled "${candidate.from}").` : `${target} was recognised by its content (the block had no header).`,
      });
      if (candidate.entry) problems.splice(problems.indexOf(candidate.entry), 1);
    });
  }

  for (const name of expectedFiles) {
    if (!(name in files) && !reported.has(name)) {
      problems.push(problem(name, "missing", "the block is missing from the answer."));
    }
  }
  return { files, problems, assumptions };
}
