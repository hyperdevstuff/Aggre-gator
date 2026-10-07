# Aggregator — Product Spec

> Status: living document. Last updated 2026-10-07.
> Companion: `docs/ROADMAP.md` (phased plan) and `docs/TASKS.md` (build tracker).

## 1. Thesis

Storing links is cheap. Sharing **one** link is cheap. What is expensive is **a good,
maintained, organized collection of links** — a reading list, a research set, a course syllabus,
a vendor shortlist, a design-inspiration board.

That is the product: **collect once, share the whole thing**. We sell convenience in
exchange for money — the collection owner pays so that every viewer gets a polished,
always-up-to-date public page without signing up for anything.

## 2. Domain model (the rules)

- **Bookmark** — one saved URL. Auto metadata (title/description/cover), optional note,
  favorite flag, lives in exactly one collection.
- **Collection** — a folder of bookmarks. May have a **parent** (sub-collections are already
  supported in the schema via `parentId`). **Nesting is capped at 3 levels** (top-level →
  sub-collection → sub-sub-collection, i.e. 3 folders deep). The cap is a product decision, not a
  technical one: it keeps the sidebar tree and the public share page readable. Enforce it in the API
  on collection create/update (reject a `parentId` that already sits at the deepest level) and hide
  the "new sub-collection" affordance in the UI at that depth.
- **Visibility** — every collection is `private`, `unlisted`, or `public`, and that
  state lives on the collection itself. `private` is the default and never leaves the
  owner's dashboard. `unlisted` is reachable only by its link (a random code — the
  existing `shared_collections` row) and is excluded from Explore. `public` appears
  in Explore, on the owner's profile, and at a readable URL
  (`/u/:username/:slug`). Being *published* and being *accessible by link* are
  different decisions, which is why they are two fields rather than one.
- **Tag** — applies to **bookmarks only**. Decision: tags do **not** attach to collections.
  Rationale: tags are a retrieval tool ("find every react link"), collections are a curation
  tool ("this set, in this order, published together"). Giving tags to collections would
  duplicate nesting under a different name and complicate the share contract below. Tags on the
  **shared page** are derived from the bookmarks inside it.
- **Share link** — the row in `shared_collections` that makes a collection reachable
  at `GET /share/:code`. It owns the random code and the active/revoked state, and later
  the paywall attributes (expiry, password, view count, plan). It does **not** own
  visibility — that is the collection's job, per the Visibility bullet above. A revoked
  link answers `410`; the collection may still be `public` at its readable URL.
- **Profile** — a user has a unique `username` and appears at `/u/:username`. Their
  public collections are listed there. This is the surface that makes Explore a place
  people return to, rather than a feed they pass through once.

## 3. Shareable collections (the money-maker)

Sharing is the feature the paywall guards. Current free behavior: any collection can be
published to a public link with its nested sub-collections and paginated bookmarks.
Free behavior after the visibility change: a `public` collection is reachable by slug and
listed publicly with no paywall at all; `unlisted` links and any paid attribute below
are what the tiers charge for.

Planned paid behavior, in build order:

1. **Share limits (free tier)** — N active public links (e.g. 1), cap on public bookmarks per
   collection. Enforced server-side in `POST /collections/:id/share`.
2. **Share analytics** — view counts, referrers, top bookmarks per shared link. This is the
   feature that converts: once owners see traffic, they pay to keep it.
3. **Private/shared-with-link variants** — password-protected shares, expiring links,
   revoke/reissue. Paid tiers get passwords + longer expiry + custom slugs.
4. **Multi-collection sharing ("pages")** — one public link that embeds several collections
   (the bookmark-grid + collection-pills UI already hints at this). This is the flagship paid
   feature: free = one collection per link, paid = bundle many.
5. **Custom branding** — title, logo, theme, custom domain per shared page. Highest tier.

## 4. Feature inventory (built vs. billable)

| Area | Already built | Billable / next |
|------|---------------|-----------------|
| Save | Auto metadata scrape (SSRF-guarded), duplicate detection, bulk import API | Save others' links, browser extension quick-save, mobile share-target, RSS/OPML import, email-to-save |
| Organize | Collections + sub-collections, tags, favorites, archive, bulk move/archive/delete | A bookmark in many collections, manual ordering within a collection, saved filters, full-text search over page content, duplicate finder |
| Share | Public links, nested collections, pagination, revoke | Visibility tiers, readable `/u/:name/:slug` URLs, limits + analytics + passwords + expiry + custom slugs + multi-collection pages + branding |
| Discover | A basic public directory, newest-first | Explore v2: image mosaics, masonry, categories, ranking by saves/views, full-text search |
| Social | — | Public profiles, follow a curator, fork/copy a shared collection, view counts |
| Team | — | Shared workspaces with roles; this is the seat-based plan |

## 5. Monetization ladder

1. **Free** — generous personal use: unlimited bookmarks, N collections, 1 active share link.
2. **Pro (per-user)** — unlimited share links + analytics + passwords/expiry + multi-collection
   pages + branding. Monthly, priced like a note-taking app.
3. **Team** — shared workspaces, roles, shared billing, audit log. Per-seat.
4. **One-off** — lifetime share-link packs or paid "featured collections" marketplace cut.

Billing primitives the backend already has or needs: `user.plan`, per-share `view_count`,
share `expires_at`/`password_hash`/custom slug, workspace membership. Gate at the API layer,
never only in the UI.
