# `scenes.json`: the contract between the script and any render engine

`scenes.json` says **what is said and what is shown, scene by scene**. It never
says how: no pixels, fonts, colours, animation parameters or timings. Any engine
that can show a still or a text card behind a voice-over and a caption can consume
it. This is deliberate: the engine owns the look, the plan owns the content.

```json
{
  "version": 1,
  "campaign": "ridge-line-closure-reel",
  "title": "The Ridge Line is not closed for snow",
  "aspect": "9:16",
  "scenes": [
    {
      "id": "s1",
      "role": "hook",
      "voiceover": "The Ridge Line is not closed for snow.",
      "captionText": "Not closed for snow",
      "source": "",
      "shot": { "kind": "still", "imageId": "img-1", "identite": "A gravel track in autumn light" }
    },
    {
      "id": "s3",
      "role": "body",
      "voiceover": "The route reopens when they finish.",
      "captionText": "Reopens when the work ends",
      "source": "Ridge Line maintenance plan, section 3",
      "shot": { "kind": "textcard", "text": "Reopens when the work ends" }
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `version` | `1`. |
| `campaign` | A short slug. |
| `title` | Eight words or fewer. |
| `aspect` | `"9:16"`. |
| `scenes[].id` | Unique; lowercase letters, digits, dashes. Citations refer to it. |
| `scenes[].role` | `hook` (first), `body`, `closing` (last). |
| `scenes[].voiceover` | The words spoken in this scene. The concatenation of all of them is `narration.txt`. |
| `scenes[].captionText` | The words shown as a caption for this scene. |
| `scenes[].source` | Short source shown or credited; required on every `body` scene. |
| `scenes[].shot` | A still (`kind`, `imageId`, `identite`) or a text card (`kind`, `text`). Nothing else is allowed in a shot. |

## What a consumer does

1. Resolves each `imageId` through `images.json` to a Commons file whose licence the
   server has already read, and credits it.
2. Voices `narration.txt` (or each `voiceover`) and aligns the words to get timings.
3. Lays out the stills, text cards and captions in its own brand kit.

## What it never contains

Durations, coordinates, font sizes, colours, transitions, music, or a video clip.
The validator rejects layout fields in a shot ("engine-neutral").
