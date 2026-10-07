# ADR-001 — A `links` table for shared previews and save counts

> Status: **accepted** · Date: 2026-10-07 · Relates to `ROADMAP.md` §3.1

## Context

`collection_items` (3.1) is settled: one bookmark can live in many collections.
That answers "can a bookmark be in two of *my* collections". It does **not**
answer "can I save a link that Alice already saved" — that is a *cross-user*
reference, and today every user has their own independent bookmark row per URL.

So the open question was whether to add a `links` table keyed by normalized URL,
so that everyone saving the same URL shares one fetched preview and one save
count.

## Decision

**Yes — add `links`, but not in phase 2. Add it in phase 5, at the moment save-
someone-else's-link is actually built, and keep it out of the `collection_items`
migration.**

The reasoning is about *when the cost is visible*, not whether it is worth paying.

## Why not now

A `links` table forces the URL-normalization problem to be solved correctly
*immediately*, because the normalized URL becomes a unique key. Getting
normalization wrong is not a cosmetic bug — it merges two genuinely different
pages into one `links` row, so two users save one URL believing they saved two.
That is data loss the user can see and cannot easily undo.

Pinterest's own engineering writeup on this ([Smarter URL Normalization at
Scale](https://medium.com/pinterest-engineering/smarter-url-normalization-at-scale-how-miqps-powers-content-deduplication-at-pinterest-4aa42e807d7d))
is worth reading before implementing, because the conclusion is humbling: they
do not use a fixed allowlist. They run an **offline pipeline that renders URLs
with and without each query parameter and hashes the visual output** to learn,
per domain and per parameter *pattern*, which parameters actually change the
page. Their stated default is deliberately conservative — **when in doubt,
keep the parameter** — because over-stripping silently merges distinct content
while under-stripping merely leaves a duplicate.

We cannot replicate MIQPS. We do not have a rendering farm. So any static
normalizer we write will be wrong sometimes, and the safe direction to be wrong
in is "keep".

There is also a simpler reason to wait: **the benefit scales with user count, and
the cost is paid by the first user.** Today, duplicate-URL fetches cost one
scrape each and the scrape is already async, rate-limited and SSRF-guarded. A
shared `links` row saves that work — and saves nothing measurable while there
are ten users instead of ten thousand. Meanwhile the migration touches 64
`collectionId` references; adding a second cross-cutting table to the same
migration doubles the blast radius of the riskiest phase in the roadmap.

## What we will do instead, in phase 2

Keep the current per-user `bookmarks_user_url_unique` constraint exactly as it
is. It is correct for the product as it stands: it means "you have already
saved this link", which is the actual duplicate-detection product behaviour
today. Do not weaken it.

## Phase 5 shape, when we get there

```
links
  id, url (original, as pasted), url_key (normalized), domain,
  title, description, cover,          -- the shared preview
  saveCount,                          -- derived or maintained counter
  createdAt, updatedAt

bookmarks.linkId → links.id           -- nullable during migration
```

Sequence:

1. Write `normalizeUrl()` as a **pure, unit-tested function** with the
   conservative posture: lowercase scheme and host, drop default ports, resolve
   `.`/`..`, strip the fragment, collapse duplicate slashes, strip a single
   trailing slash on non-root paths, sort remaining query params — and strip only
   an explicit, enumerated tracking list (`utm_*`, `gclid`, `fbclid`, `msclkid`,
   `yclid`, `mc_eid`, `igshid`, `ref`). **Everything else is kept.**
2. Do *not* make `url_key` unique yet. Index it, and use it to *detect* near
   duplicates so the API can offer "you may already have this" as a soft prompt
   rather than a hard conflict. A soft false positive costs a dismissed toast; a
   hard false positive costs a lost bookmark.
3. Only once save-someone-else's-link ships, promote `url_key` to unique and let
   a save create a `links` row.

**Do not lowercase the path or strip `www`.** Path case is load-bearing on real
sites (Oracle HCM, Salesforce Workday and others 403 on a lowercased path), and
`www` is not universally equivalent. The normalization is for the *dedup key*,
never for the URL we navigate to — always store and link the original.

## Consequences

- Phase 2 stays a single-concept migration with one cross-cutting change.
- "Saved 1.2k times" becomes possible, and lands with the feature that needs it.
- We accept that early on, two users saving near-identical URLs get two previews.
  That is the correct failure direction.
- The `saveCount` social-proof number, which phase 5 wants, arrives with the
  table that can support it.

## What would change this

If we get a browser extension or bulk import in phase 2 — a path that could
import thousands of URLs at once — the scrape cost stops being negligible and
`links` moves forward into phase 2.