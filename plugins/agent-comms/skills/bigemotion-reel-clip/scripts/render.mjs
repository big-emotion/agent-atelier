// Renders a BIG EMOTION reel clip: the excerpt in a framed window on the ink
// ground, BBH headline above, word-by-word French captions and the lemon logo
// below, plus its SRT and cover.
//
// Text is drawn in Chromium and composed by FFmpeg as transparent PNG layers,
// because the Homebrew FFmpeg build has neither libass nor drawtext. Chromium
// also gives the browser's own line breaking, which is what the two-line rule
// is measured against.
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validatePlan,
  reelDuration,
  reelPhrases,
  karaokeStates,
  captionTrack,
  toSrt,
} from "./plan.mjs";
import { WIDTH, HEIGHT, sourceRect } from "./layout.mjs";

const FPS = 30;
const assets = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const FONTS = {
  Caption: "bricolage-grotesque-v9-latin-800.ttf",
  Credit: "bricolage-grotesque-v9-latin-500.ttf",
  Display: "bbh-hegarty-v1-latin-regular.ttf",
};
// Charter palette (brand/BRAND.md §1). On a black ground the mark may be
// lemon, tangerine or white — lemon is the signature.
const LEMON = "#f2ff26";
const INK = "#000000";
const BRUTAL = "#dbdbdb";

const escape = (s) =>
  String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function styles(rect) {
  const below = rect.y + rect.h;
  return `
.ground{position:absolute;inset:0;background-color:${INK};
  background-image:radial-gradient(rgba(242,255,38,.14) 1.5px,transparent 1.6px);
  background-size:22px 22px}
.headline{position:absolute;left:60px;width:960px;top:${rect.y / 2 + 8}px;transform:translateY(-50%);
  text-align:center;font:72px/1.05 Display;color:#fff;text-transform:uppercase}
.headline em{font-style:normal;color:${LEMON}}
.window{position:absolute;left:${rect.x - 3}px;top:${rect.y - 3}px;width:${rect.w}px;height:${rect.h}px;
  border:3px solid ${LEMON}}
.credit{position:absolute;left:${rect.x}px;width:${rect.w}px;top:${below + 14}px;
  font:24px/1.3 Credit;color:${BRUTAL}}
.caption{position:absolute;left:60px;width:960px;top:${below + 172}px;transform:translateY(-50%);
  text-align:center;font:52px/1.2 Caption;color:rgba(255,255,255,.36)}
.caption b{font-weight:inherit;color:#fff}
.logo{position:absolute;left:50%;transform:translateX(-50%);top:1238px;width:115px;height:64px;
  background:${LEMON};-webkit-mask:url(/logo.png) center/contain no-repeat}`;
}

const page = (rect) => `<!doctype html><html><head><meta charset="utf-8"><style>
${Object.entries(FONTS)
  .map(([family, file]) => `@font-face{font-family:${family};src:url(/fonts/${file})}`)
  .join("\n")}
html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;background:transparent;overflow:hidden}
.layer{position:absolute;inset:0}
${styles(rect)}
</style></head><body><div class="layer" id="layer"></div></body></html>`;

function headlineHtml({ lines, accent }) {
  const html = lines
    .map((line) => {
      const text = escape(line);
      if (!accent || !line.includes(accent)) return text;
      return text.replace(escape(accent), `<em>${escape(accent)}</em>`);
    })
    .join("<br>");
  return `<div class="headline">${html}</div>`;
}

const captionHtml = (text, said) => {
  const words = text.split(/\s+/).map(escape);
  return `<div class="caption"><b>${words.slice(0, said).join(" ")}</b> ${words
    .slice(said)
    .join(" ")}</div>`;
};

function probeSize(file) {
  const run = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file],
    { encoding: "utf8" }
  );
  const [width, height] = run.stdout.trim().split(",").map(Number);
  if (!width || !height) throw new Error(`Cannot read the video size of ${file}`);
  return { width, height };
}

async function openPage(html) {
  const routes = new Map([["/logo.png", ["image/png", await readFile(join(assets, "logo.png"))]]]);
  for (const file of Object.values(FONTS))
    routes.set(`/fonts/${file}`, ["font/ttf", await readFile(join(assets, "fonts", file))]);
  const browser = await chromium.launch({ headless: true });
  const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await tab.route("http://clip.local/**", (route) => {
    const url = route.request().url();
    const hit = routes.get(new URL(url).pathname);
    if (hit) route.fulfill({ contentType: hit[0], body: hit[1] });
    else if (url === "http://clip.local/") route.fulfill({ contentType: "text/html", body: html });
    else route.abort();
  });
  await tab.goto("http://clip.local/");
  const draw = async (content, file) => {
    await tab.evaluate((h) => {
      document.getElementById("layer").innerHTML = h;
    }, content);
    await tab.evaluate(() => document.fonts.ready);
    if (file) await tab.screenshot({ path: file, omitBackground: true });
  };
  // A single word wider than the column overflows instead of wrapping, so the
  // width counts as well as the line count.
  const fitsTwoLines = () =>
    tab.evaluate(() => {
      const node = document.getElementById("layer").firstElementChild;
      const lines = Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight));
      return lines <= 2 && node.scrollWidth <= node.clientWidth + 1;
    });
  return { browser, draw, fitsTwoLines };
}

function ffmpeg(args) {
  const run = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`FFmpeg failed: ${run.stderr}`);
}

// The concat demuxer needs the last picture listed twice to honour its
// duration.
async function writeTrack(file, stretches) {
  const list = stretches
    .map((s) => `file '${s.picture}'\nduration ${s.seconds.toFixed(3)}`)
    .concat(`file '${stretches.at(-1).picture}'`)
    .join("\n");
  await writeFile(file, list + "\n");
}

const still = (file) => ["-loop", "1", "-framerate", String(FPS), "-i", file];

export async function renderClip(planFile, outDir) {
  const plan = JSON.parse(await readFile(planFile, "utf8"));
  const errors = validatePlan(plan);
  if (errors.length) throw new Error(`Invalid plan:\n- ${errors.join("\n- ")}`);
  const source = resolve(plan.source);
  const { width, height } = probeSize(source);
  const rect = sourceRect(width, height);
  const phrases = reelPhrases(plan);
  const states = karaokeStates(phrases);
  const duration = reelDuration(plan);
  const layers = join(outDir, "_layers");
  await mkdir(layers, { recursive: true });

  const { browser, draw, fitsTwoLines } = await openPage(page(rect));
  try {
    if (plan.headline) {
      await draw(headlineHtml(plan.headline));
      if (!(await fitsTwoLines())) throw new Error("Headline over two lines");
    }
    const tooLong = [];
    for (const [i, p] of phrases.entries()) {
      await draw(captionHtml(p.text, 0));
      if (!(await fitsTwoLines())) tooLong.push(`phrase ${i + 1}: «${p.text}»`);
    }
    if (tooLong.length) throw new Error(`Captions over two lines:\n- ${tooLong.join("\n- ")}`);

    await draw(`<div class="ground"></div>`, join(layers, "ground.png"));
    await draw(
      `${plan.headline ? headlineHtml(plan.headline) : ""}<div class="window"></div>` +
        `<div class="credit">${escape(plan.credit_line)}</div><div class="logo"></div>`,
      join(layers, "frame.png")
    );
    await draw("", join(layers, "empty.png"));
    for (const [i, s] of states.entries())
      await draw(captionHtml(phrases[s.phrase].text, s.said), join(layers, `caption-${i}.png`));
  } finally {
    await browser.close();
  }

  await writeTrack(
    join(layers, "captions.txt"),
    captionTrack(states, duration).map((s) => ({
      seconds: s.seconds,
      picture: s.index === null ? "empty.png" : `caption-${s.index}.png`,
    }))
  );

  const cuts = plan.clips
    .map(
      ([a, b], i) =>
        `[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS,fps=${FPS}[v${i}];` +
        `[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS[a${i}];`
    )
    .join("");
  const joined = plan.clips.map((_, i) => `[v${i}][a${i}]`).join("");
  const framed = (video) =>
    `${video}scale=${rect.w}:${rect.h}[fg];[1:v][fg]overlay=${rect.x}:${rect.y}:shortest=1[placed];` +
    `[placed][2:v]overlay=0:0`;
  const graph =
    cuts +
    `${joined}concat=n=${plan.clips.length}:v=1:a=1[cut][aout];` +
    framed("[cut]") +
    `[signed];[3:v]fps=${FPS},format=rgba[cap];` +
    `[signed][cap]overlay=0:0:eof_action=pass,format=yuv420p[vout]`;
  const reel = join(outDir, "reel.mp4");
  ffmpeg([
    "-i", source,
    ...still(join(layers, "ground.png")),
    ...still(join(layers, "frame.png")),
    "-f", "concat", "-safe", "0", "-i", join(layers, "captions.txt"),
    "-filter_complex", graph,
    "-map", "[vout]", "-map", "[aout]",
    "-t", String(duration),
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    reel,
  ]);

  // The cover is the reel's own frame without captions: LinkedIn shows it
  // before autoplay, so the headline must carry it alone.
  if (plan.thumbnail)
    ffmpeg([
      "-ss", String(plan.thumbnail.frame_at), "-i", source,
      ...still(join(layers, "ground.png")),
      ...still(join(layers, "frame.png")),
      "-filter_complex", framed("[0:v]setpts=PTS-STARTPTS,"),
      "-frames:v", "1",
      join(outDir, "cover.png"),
    ]);

  await writeFile(join(outDir, "sous-titres-fr.srt"), toSrt(phrases));
  if (resolve(planFile) !== resolve(join(outDir, "plan.json")))
    await copyFile(planFile, join(outDir, "plan.json"));
  // Kept after a failed render for inspection; a delivered folder holds only
  // the publishable files.
  await rm(layers, { recursive: true, force: true });
  return { reel, duration, captions: phrases.length };
}

const [command, planFile, outDir] = process.argv.slice(2);
if (command === "validate") {
  const errors = validatePlan(JSON.parse(await readFile(planFile, "utf8")));
  console.log(errors.length ? errors.join("\n") : "Plan valid.");
  process.exitCode = errors.length ? 1 : 0;
} else if (command === "render") {
  const done = await renderClip(planFile, outDir);
  console.log(`Rendered ${done.reel}: ${done.duration} s, ${done.captions} captions.`);
} else if (command) {
  console.error("Usage: render.mjs validate|render PLAN.json [OUT_DIR]");
  process.exitCode = 2;
}
