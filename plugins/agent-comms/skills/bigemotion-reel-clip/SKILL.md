---
name: bigemotion-reel-clip
description: Turn a video file and a one-line instruction into a finished BIG EMOTION LinkedIn clip — cut, French captions timed on the original voice with the spoken words lit up as they are said, the source in a framed window on the ink ground, BBH headline, lemon logo watermark, cover, LinkedIn post (company page + personal repost) and a verification note — then open it for review. Built for excerpts translated from English for a French-speaking audience. Use for "clip LinkedIn", "extrait sous-titré", "sous-titre cette vidéo", "traduis cet extrait", "fais un clip de ce passage pour Big Emotion", or /bigemotion-reel-clip.
---

# BIG EMOTION reel clip

The operator hands over **a video and an instruction**; this skill delivers the
whole publication folder, then opens the clip for review. Respond to the
operator in French; this file stays English.

Adapted from EthniAfrica's `ethniafrica-reel-clip` (October 2026). What differs,
by decision of 14 October 2026:

- **One surface: LinkedIn**, posted from the BIG EMOTION page and republished
  from the founder's personal account. Canvas 4:5 (1080×1350), the tallest
  ratio the feed shows uncropped.
- **Original voice, French captions** — the audience is French-speaking.
- **Word-by-word highlight**: the whole caption is on screen, words light up
  (white) as they are said, the rest stays dimmed.
- **Framed source**: the excerpt sits in a lemon-edged window on the ink
  ground with a lemon dot grid, so the viewer sees it is an excerpt.
- No boxes, no on-screen text overlays: a BBH headline above the frame carries
  the context instead.

Rendering never authorizes publication.

## Reading the instruction

| What    | Examples                                         | Default                                                     |
| ------- | ------------------------------------------------ | ----------------------------------------------------------- |
| Source  | a file path; a YouTube URL for credit            | the file given                                              |
| Passage | « arrête-toi quand il dit… », « tout »           | the speaker's whole intervention around the quoted sentence |
| Folder  | given path                                       | the operator's social production folder, as `Publie/<date>/Extraits-<Speaker>/<slug>/` (ask once if unknown) |

Say in one sentence what will be produced, then run. Ask only when the passage
cannot be located or the file cannot be read.

## Steps

`SKILL` below is this skill's folder
(`${CLAUDE_PLUGIN_ROOT}/skills/bigemotion-reel-clip`). Run `npm install` there
once if `node_modules/` is missing; it fetches `playwright-core`, which uses the
Chromium Playwright keeps in its user cache (`npx playwright-core install
chromium` if none is there). FFmpeg must be on the PATH.

1. **Transcribe** (billed, ElevenLabs Scribe):
   ```sh
   node SKILL/scripts/transcribe.mjs VIDEO WORK_DIR eng
   ```
   `WORK_DIR` is the session scratch folder; `turns.txt` gives speaker turns,
   `lines.txt` each word's start and end. A transcript of someone else's
   speech never goes into the deliverable; delete `WORK_DIR` at the end. Name
   the channel from the YouTube oEmbed
   (`https://www.youtube.com/oembed?url=…&format=json`).
2. **Cut.** Enter after the previous speaker's last word, ~0.15 s before the
   first word; leave after the last complete sentence. Drop a preamble that
   only delays the thesis (« very important question ») — the first seconds
   decide whether the feed scrolls past. Several `clips` make jump cuts.
3. **Captions**, one phrase per caption, on the source clock (`start` = first
   word, `end` = last word).
   - Two lines at most, ≤ 60 characters, ≤ 25 characters per second; the
     browser refuses a third line. Condense rather than speed the reading.
   - Drop hesitations, false starts and unintelligible words (say so in the
     verification note); keep unfinished sentences unfinished (« … »).
   - Never sharpen a claim the speaker hedged: « probably » stays « sans doute ».
   - Register: BIG EMOTION copy is tutoiement. A generic « you » becomes « on »
     or « tu »; a real plural (« you guys ») stays « vous ».
   - Keep the audience's own jargon in English (CRUD, back-end, M365).
4. **Headline and post**: invoke `attention-architect` with the thesis. The
   headline is two lines of uppercase **ASCII only** — every BBH cut has an
   ASCII-only cmap (DEC-023), so `METIER`, not `MÉTIER`; the validator refuses
   an accent. A hedged thesis becomes a question, never a BIG EMOTION assertion.
5. **Validate and render**:
   ```sh
   node SKILL/scripts/render.mjs validate PLAN.json
   node SKILL/scripts/render.mjs render PLAN.json OUT_DIR
   ```
   Writes `reel.mp4` (1080×1350, H.264/AAC), `sous-titres-fr.srt`, `cover.png`
   (when `thumbnail` is set) and a copy of `plan.json`. About 45 s of render
   per minute of clip.
6. **Look**: at least three frames (a caption mid-highlight, a two-line
   caption, the last caption) and the cover. Check credit, watermark, the
   source's own logo, no word cut at either end.
7. **`descriptions.md`** following [references/descriptions.md](references/descriptions.md).
8. **`verification.md`** following [references/verification.md](references/verification.md).
   Rights are always an open decision unless the operator reports a permission.
9. **Open the clip** (`open OUT_DIR/reel.mp4`) and report: duration, what to
   check by ear, open decisions. Never post.

## Plan format

```json
{
  "source": "/abs/path/source.mp4",
  "source_url": "https://…",
  "credit_line": "Name, verified role · source : Show (YouTube)",
  "headline": { "lines": ["LINE ONE", "LINE TWO ?"], "accent": "LINE TWO ?" },
  "clips": [[10.3, 227.6]],
  "phrases": [{ "start": 10.44, "end": 12.46, "text": "…" }],
  "thumbnail": { "frame_at": 181 }
}
```

`headline` is optional; `accent` paints the matching text lemon. Times stay on
the source clock; the engine moves them onto the clip. A gap under 0.6 s
between captions is held so the text does not blink.

**Word timing.** A translation does not line up word for word with the English
voice, so each French word lights up in proportion to the characters read
before it, across the phrase's spoken span. On a caption of two to four seconds
the drift stays under a word; keeping phrases short is what keeps it in sync.

## Why this engine

Text is drawn in Chromium (`playwright-core`, installed in this folder) and
composed by FFmpeg as transparent PNG layers, because the Homebrew FFmpeg has
neither libass nor drawtext. Fonts (Bricolage Grotesque for captions — it
carries the accents —, BBH Hegarty for the headline) and the logo live in
`assets/`, so the skill runs from any directory. The logo is recoloured lemon
by CSS mask: on a black ground the charter allows lemon, tangerine or white.

## Tests

`npm test` in this folder: plan rules, word timing, geometry, transcript
shaping and two end-to-end renders on a synthetic FFmpeg source (no network,
no third-party footage).
