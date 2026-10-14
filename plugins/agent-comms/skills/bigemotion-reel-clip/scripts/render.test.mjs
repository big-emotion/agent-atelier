// Renders a clip end to end from a synthetic source (FFmpeg test pattern and
// tone): needs FFmpeg and the skill's Chromium, no third-party footage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderClip } from "./render.mjs";

const source = (dir, colour = "0x808080", name = "wide.mp4") => {
  const file = join(dir, name);
  spawnSync("ffmpeg", [
    "-v", "error", "-y",
    "-f", "lavfi", "-i", `color=c=${colour}:size=320x180:rate=30:duration=6`,
    "-f", "lavfi", "-i", "sine=duration=6",
    "-shortest", file,
  ]);
  return file;
};

const probe = (file) =>
  JSON.parse(
    spawnSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_type,width,height",
      "-of", "json", file,
    ], { encoding: "utf8" }).stdout
  );

const pixel = (file, t, x, y) => [
  ...spawnSync("ffmpeg", [
    "-v", "error", "-ss", String(t), "-i", file,
    "-vf", `crop=2:2:${x}:${y},format=rgb24`, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]).stdout.subarray(0, 3),
];

const writePlan = (dir, over = {}) => {
  const file = join(dir, "plan.json");
  writeFileSync(file, JSON.stringify({
    source: source(dir),
    credit_line: "Speaker · source : Show (YouTube)",
    headline: { lines: ["UN TITRE", "COURT"], accent: "COURT" },
    clips: [[1, 5]],
    phrases: [
      { start: 1.2, end: 2.8, text: "Première phrase traduite" },
      { start: 3, end: 4.8, text: "puis la seconde." },
    ],
    thumbnail: { frame_at: 2 },
    ...over,
  }));
  return file;
};

test("renders a 4:5 reel with sound, SRT and cover", async () => {
  const dir = mkdtempSync(join(tmpdir(), "be-clip-"));
  try {
    const out = join(dir, "out");
    const done = await renderClip(writePlan(dir), out);
    const info = probe(done.reel);
    const video = info.streams.find((s) => s.codec_type === "video");
    assert.deepEqual([video.width, video.height], [1080, 1350]);
    assert.ok(info.streams.some((s) => s.codec_type === "audio"));
    assert.ok(Math.abs(Number(info.format.duration) - 4) < 0.15);
    assert.match(readFileSync(join(out, "sous-titres-fr.srt"), "utf8"), /Première phrase/);
    const [cr, cg, cb] = pixel(join(out, "cover.png"), 0, 540, 600);
    assert.ok(Math.abs(cr - 128) < 20 && Math.abs(cg - 128) < 20 && Math.abs(cb - 128) < 20,
      "the cover shows the source frame");
    assert.ok(!existsSync(join(out, "_layers")), "working layers are removed");

    const [r, g, b] = pixel(done.reel, 1, 540, 600);
    assert.ok(Math.abs(r - 128) < 20 && Math.abs(g - 128) < 20 && Math.abs(b - 128) < 20,
      "the source sits in the frame");
    const ground = pixel(done.reel, 1, 6, 6);
    assert.ok(ground.every((c) => c < 40), "the ground is ink black");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a caption over two lines is refused before encoding", async () => {
  const dir = mkdtempSync(join(tmpdir(), "be-clip-"));
  try {
    const plan = writePlan(dir, {
      phrases: [{ start: 1, end: 4.9, text: "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM" }],
    });
    await assert.rejects(renderClip(plan, join(dir, "out")), /two lines/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a montage plays its clips in plan order, across sources", async () => {
  const dir = mkdtempSync(join(tmpdir(), "be-clip-"));
  try {
    const plan = writePlan(dir, {
      source: undefined,
      sources: [source(dir), source(dir, "0x2050f0", "blue.mp4")],
      clips: [[1, 3, 1], [1, 3]],
      phrases: [
        { source: 1, start: 1.2, end: 2.8, text: "d'abord la seconde" },
        { start: 1.2, end: 2.8, text: "puis la première" },
      ],
      thumbnail: { frame_at: 2, source: 1 },
    });
    const out = join(dir, "out");
    const done = await renderClip(plan, out);
    assert.ok(Math.abs(Number(probe(done.reel).format.duration) - 4) < 0.15);
    const [, , blue] = pixel(done.reel, 0.5, 540, 600);
    const [r, , b] = pixel(done.reel, 3, 540, 600);
    assert.ok(blue > 200, "the second source plays first");
    assert.ok(Math.abs(r - 128) < 20 && Math.abs(b - 128) < 20, "then the first");
    assert.ok(pixel(join(out, "cover.png"), 0, 540, 600)[2] > 200, "cover from the named source");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
