# `images.json`

Which pictures the deck wants, and why. The agent chooses; the server verifies.

```json
{
  "images": [
    {
      "id": "img-1",
      "commonsTitle": "File:Gravel road in autumn.jpg",
      "reason": "A rider's view of the route in the closing season, for the cover."
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `id` | Unique in the file. Cards point at it with `image.id`. |
| `commonsTitle` | A Wikimedia Commons file title, `File:<name>.<ext>`, with the extension jpeg, jpg, png or webp. Not a URL. |
| `reason` | Why this image: what it shows that the card needs. |

- **Wikimedia Commons only.** The agent proposes no image from anywhere else.
- **No licence, author or credit here.** If you write one it is ignored: the server
  reads `LicenseShortName`, `Artist` and `Credit` from the Commons API itself.
- Every image is used by at least one scene as a still (`shot.imageId`); one image may serve several scenes.
- Reels use stills only: the agent proposes no video clip. A scene with no suitable still uses a text card.
- Pick an image large enough for a vertical full-frame still: the render step refuses to
  enlarge an image more than twice.
- An image that shows an identifiable person is a reservation, said in `sources.md`.
