// Word-timed, speaker-separated transcription of a source video, to find the
// in and out points and to time each caption on the voice.
//
//   node transcribe.mjs VIDEO WORK_DIR [LANGUAGE]
//
// Writes WORK_DIR/words.json (the API answer), WORK_DIR/turns.txt (one line per
// speaker turn) and WORK_DIR/lines.txt (words with their start, broken at
// punctuation). WORK_DIR must be a scratch folder: a transcript of someone
// else's speech never goes into the repository or the deliverable.
//
// The ElevenLabs MCP tool returns plain text only and reads files from the
// desktop folder only, hence a direct API call. The key comes from
// ELEVENLABS_API_KEY, or from the `elevenlabs` MCP server entry of the
// user-level Claude Code config. Each call is billed.
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// A pause this long inside one speaker's speech starts a new turn: in an
// interview it is where an excerpt can begin or end cleanly.
const TURN_GAP_SECONDS = 1.5;

const spoken = (words) => words.filter((w) => w.type === "word");

export function speakerTurns(words) {
  const turns = [];
  for (const w of spoken(words)) {
    const last = turns.at(-1);
    if (
      last &&
      last.speaker === w.speaker_id &&
      w.start - last.end < TURN_GAP_SECONDS
    ) {
      last.end = w.end;
      last.text += ` ${w.text}`;
    } else
      turns.push({
        speaker: w.speaker_id,
        start: w.start,
        end: w.end,
        text: w.text,
      });
  }
  return turns;
}

// `word@start … |end speaker`: what an adapter needs to set each caption's
// start on a first word and its end on a last word.
export function timedLines(words) {
  const lines = [];
  let line = [];
  const flush = (w) => {
    const speaker = String(w.speaker_id ?? "")
      .split("_")
      .at(-1);
    lines.push(`${line.join(" ")} |${w.end.toFixed(2)} ${speaker}`);
    line = [];
  };
  const list = spoken(words);
  list.forEach((w, i) => {
    line.push(`${w.text}@${w.start.toFixed(2)}`);
    const next = list[i + 1];
    if (/[.?!,…-]$/.test(w.text) || !next || next.speaker_id !== w.speaker_id)
      flush(w);
  });
  return lines;
}

async function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const config = JSON.parse(
    await readFile(join(homedir(), ".claude.json"), "utf8").catch(() => "{}")
  );
  const find = (node) => {
    if (!node || typeof node !== "object") return null;
    if (node.elevenlabs?.env?.ELEVENLABS_API_KEY)
      return node.elevenlabs.env.ELEVENLABS_API_KEY;
    for (const value of Object.values(node)) {
      const hit = find(value);
      if (hit) return hit;
    }
    return null;
  };
  const key = find(config);
  if (!key)
    throw new Error(
      "No ElevenLabs key: set ELEVENLABS_API_KEY or configure the elevenlabs MCP server"
    );
  return key;
}

export async function transcribe(video, workDir, language) {
  await mkdir(workDir, { recursive: true });
  const audio = join(workDir, "audio.mp3");
  const run = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-i",
      resolve(video),
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "48k",
      audio,
    ],
    { encoding: "utf8" }
  );
  if (run.status !== 0) throw new Error(`FFmpeg failed: ${run.stderr}`);
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("diarize", "true");
  form.append("timestamps_granularity", "word");
  if (language) form.append("language_code", language);
  form.append("file", new Blob([await readFile(audio)]), "audio.mp3");
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": await apiKey() },
    body: form,
  });
  const answer = await response.json();
  if (!response.ok)
    throw new Error(`ElevenLabs ${response.status}: ${JSON.stringify(answer)}`);
  const words = answer.words || [];
  await writeFile(join(workDir, "words.json"), JSON.stringify(answer));
  await writeFile(
    join(workDir, "turns.txt"),
    speakerTurns(words)
      .map(
        (t) =>
          `${t.start.toFixed(2)}-${t.end.toFixed(2)} ${t.speaker}: ${t.text}`
      )
      .join("\n") + "\n"
  );
  await writeFile(
    join(workDir, "lines.txt"),
    timedLines(words).join("\n") + "\n"
  );
  return { words: spoken(words).length, language: answer.language_code };
}

const [video, workDir, language] = process.argv.slice(2);
if (video && workDir) {
  const done = await transcribe(video, workDir, language);
  console.log(
    `Transcribed ${done.words} words (${done.language}) into ${workDir}: turns.txt, lines.txt, words.json.`
  );
}
