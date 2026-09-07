---
name: audience-audit
description: Measures what a site's audience actually does and writes the dated report the downstream comms skills consume. Crosses privacy-analytics data with the repository's own URL inventory to give every visited page one verdict — Keep, Improve, Merge, Create — and to surface dead ends, cannibalised pages, unattributed channels and the mobile-desktop gap. Read-only on source; writes exactly one Markdown file. Use for "que dit le trafic", "quelles pages marchent", "audit de contenu", "rapport d'audience", "content audit", or /audience-audit.
metadata:
  author: Big Emotion
  version: "1.0.0"
  argument-hint: "[--period=30d|custom] [--from=YYYY-MM-DD --to=YYYY-MM-DD]"
---

# Audience Audit

Measures the audience, classifies the pages, writes one dated report. It is the
**producer** of the comms pipeline:

```
/audience-audit  →  <reports>/audit-YYYY-MM-DD.md  →  /content-strategist
```

The handoff is a file, not a conversation. The consumer runs in a session that
never saw this one, so anything it needs must survive in the report.

This skill **never** modifies source, never publishes, never posts, never
schedules. It reads analytics, reads the repository, writes one Markdown file.

## The project profile

Four things are project-specific. Ask for any that is not already recorded in
the project's own documentation, and write them into the report's header so the
next run is comparable.

| Input | Example shape |
| --- | --- |
| Analytics endpoint and site id | a self-hosted Plausible instance and the domain it tracks |
| Content inventory command | the shell command that counts what the project publishes |
| Route source | the sitemap route's source, or the router directory |
| Report destination | the directory holding the dated series |

**Read the sitemap route's source rather than running a full build.** The build
is slow and this audit does not need its output.

## Step 1 — Read the analytics over its API, not its dashboard

A self-hosted Plausible instance answers its internal stats API without
authentication and without a browser. Use it: scriptable, exact, and immune to
the dashboard's rendering quirks.

```bash
BASE=https://<instance>/api/stats/<site-id>

curl -s "$BASE/top-stats?period=30d"
curl -s "$BASE/pages?period=30d&detailed=true&limit=200"
curl -s "$BASE/entry-pages?period=30d&detailed=true&limit=100"
curl -s "$BASE/exit-pages?period=30d&detailed=true&limit=100"
curl -s "$BASE/sources?period=30d&detailed=true"
curl -s "$BASE/screen-sizes?period=30d&detailed=true"
curl -s "$BASE/countries?period=30d"
```

**`detailed=true` is what makes the audit possible.** Without it the breakdown
endpoints return only visitors and percentage; with it every row carries bounce
rate, time on page, scroll depth and pageviews — and bounce crossed with scroll
depth is the entire diagnosis in Step 3. A run that forgets the flag produces a
page list with no verdict behind it.

**`limit` defaults low.** Pass it explicitly or the long tail is silently
truncated and coverage in Step 2 is overstated.

**Long periods can return zero while `30d` returns data** on a self-hosted
instance. When a longer window comes back empty, retry as
`period=custom&from=YYYY-MM-DD&to=YYYY-MM-DD` before concluding anything.

If the API is closed off, the dashboard is the fallback — but its root often
renders only the headline tiles as text, with the breakdown tables living on the
detail routes. Reading the root alone returns headings and no data: a silent
empty read that looks like a quiet month.

### The measurement is a floor, not a total

Consent-gated analytics load only after the visitor accepts the banner. Every
number counts **consented sessions**; real traffic is higher by an unknown
factor. **Say so in the report, every time.** Never present the figure as the
audience — present it as the measured, consented sample.

Two consequences the consumer depends on:

- **Absolute counts are weak evidence at low volume.** At tens of visitors, one
  person's afternoon moves a page several ranks. Rank and ratio survive;
  precision does not.
- **A zero is not proof of absence.** A channel with no attributed visit may be
  sending unconsented traffic, or traffic whose referrer is stripped.

## Step 2 — Inventory the site's own URLs

The audit's whole value is the join between **what was visited** and **what
exists**. Analytics only knows the first half.

Count what the project publishes, by type, using its own inventory command.
Record the count per type. When a large published corpus meets a few dozen
visited URLs, that ratio is the central fact of the report — and the reason
"which page underperforms" is the wrong first question.

## Step 3 — Classify

Every visited URL gets exactly one verdict. This is a ROT-style content audit
(Redundant, Outdated, Trivial), adapted to a site whose pages may be records
rather than articles.

| Verdict | Trigger |
| --- | --- |
| **Keep** | Holds attention and leads somewhere — decent time on page, scroll depth above ~60 %, bounce below the site average |
| **Improve** | Attracts visits but ends the session — high bounce with non-trivial time on page is a page that *worked* and then offered no next step |
| **Merge** | Competes with another URL for the same intent — a directory and a record both answering one query is cannibalisation, not coverage |
| **Create** | Demand lands on a hub with nothing behind it, or an entry page reveals an intent the site does not serve |

Four patterns to name explicitly, because each has a different fix and they are
easily confused:

1. **Dead end** — high bounce *and* high time on page *and* high scroll depth.
   The visitor read the whole thing and left. Not a quality problem; a missing
   next step. Usually the most valuable finding the audit produces.
2. **Bounce-through** — high bounce, low time, low scroll. Wrong expectation set
   upstream, usually by the link that brought them.
3. **Cannibalisation** — two URLs, one intent.
4. **Channel with no attribution** — a channel being actively published to that
   appears nowhere in sources. **Check for missing campaign parameters before
   concluding the channel does not work**: without them, social referrers are
   filed under Direct and the content-to-traffic link is simply unmeasured.

## Step 4 — Compare against the previous report

Read the most recent existing report. **Report movement, not just level**: a page
that fell out of the top ten matters more than one sitting at rank nine in both.
With no previous report, say so and record this run as the baseline.

## Step 5 — Write the report

Write `<reports>/audit-YYYY-MM-DD.md`, dated by the run date. **Never overwrite a
previous report** — the series is the point.

```markdown
# Audience audit — YYYY-MM-DD

Period measured: … (consented sessions only; a floor, not the audience)
Profile: analytics endpoint, site id, inventory command, report directory

## Headline
| Metric | This period | Previous | Δ |

## Acquisition
Per source: visitors, bounce, duration. Name every published channel carrying
zero attributed traffic, and whether campaign tagging would explain it.

## Devices
Mobile vs desktop, each with its own bounce and duration. Flag any gap wider
than the site average — on a mobile-first project a mobile session that
underperforms desktop is a contract violation, not a curiosity.

## Page verdicts
| URL | Visitors | Bounce | Time | Scroll | Verdict | Why |

## Coverage
Published vs visited, per content type.

## Findings
Numbered, each one sentence, each tied to a number above.

## Handoffs
### For /content-strategist
```

The handoff section is mandatory and must be actionable on its own. A finding no
downstream skill can act on belongs in Findings, not in a handoff.

## Boundaries

This skill measures and classifies. It does not fix, and it does not decide what
to publish. Visual and brand questions, navigation redesign, and writing content
all belong elsewhere.
