# Licences, and why the agent never writes one

The server computes the deck's licence from Wikimedia Commons metadata. This page
tells the agent what it will be judged against, so it picks images that pass.

| Rank | Licences | Effect |
| --- | --- | --- |
| 1 | Public domain, CC0 | none |
| 2 | CC BY (any version) | credit required |
| 3 | CC BY-SA (any version) | credit required, and the deck becomes CC BY-SA |

- **Refused:** CC BY-ND (cropping and overlaid text make a derivative), CC BY-NC
  (commercial use), all rights reserved, and anything the mapping table does not
  recognise.
- **The deck takes the highest rank among its images.** This is a conservative
  policy, not a legal finding.
- Prefer rank 1, then rank 2. Each rank-3 image makes the whole deck share-alike.
- A work whose Commons page is not clear about its licence is unknown, hence refused.
