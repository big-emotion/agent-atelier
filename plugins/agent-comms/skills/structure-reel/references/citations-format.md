# `citations.json`

The evidence for each claim, in a form a machine can check without a model.

```json
{
  "citations": [
    {
      "scene": "s2",
      "claim": "Crews rebuild the culverts every October.",
      "sourceUrl": "https://example.org/ridge-line/maintenance-plan",
      "quote": "culverts are rebuilt each October"
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `scene` | The `id` of the scene that makes the claim (not `card`). |
| `claim` | The claim, as the card states it. |
| `sourceUrl` | The page you read, an http(s) URL. |
| `quote` | Words copied from that page, **300 characters at most**: the one sentence that carries the claim. |

- Every scene that has a `source` has at least one citation.
- The server fetches the page, normalises its text, and looks for the quote
  **word for word**. A paraphrase fails. A quote you did not see on the page fails,
  and blocks the approval.
- If the page cannot be fetched, the check is reported as unverified; a person then
  decides.
- Quote only what you actually read. If you cannot read the page, change the claim.
