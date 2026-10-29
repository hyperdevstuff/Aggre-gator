# Wave 4 — Monetization (Dodo Payments) — Plan

Status: **planned, not started.** Owner: backend (`agg-be`).
Billing provider: **Dodo Payments** (Merchant of Record). Env vars: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT` (`test_mode`/`live_mode`).

## Goals

Gate publishing/sharing behind plan limits at the API layer (never UI-only), add a
`subscriptions` table mirroring Dodo state, expose checkout + customer-portal
creation, and ingest all 9 Dodo subscription webhook events with signature
verification, idempotency, and replay safety.

## Plan ladder (from SPEC §5)

| Plan | Limits |
|---|---|
| `free` | Unlimited bookmarks and private collections, **5 published collections** (public/unlisted), no analytics/password/expiry/multi-collection pages/branding. |
| `pro` | Unlimited published collections + analytics + passwords/expiry + multi-collection pages + branding. $5/month. |

Team tier is intentionally omitted: shared workspaces, roles and audit log do not
exist in the codebase. Selling them would get the merchant account suspended.
The free limit (5 published collections) and Pro price (\$5/mo) are defined in
`client/src/lib/legal.ts` (frontend, `feat/legal-pages`) and must stay in sync.

Free limits enforced server-side in `POST /collections/:id/share` and on publish
(visibility → `public`/`unlisted`).

## Issues

### be-19 — Plan enforcement at the API layer
- Add `PLANS` config (`app/src/config/plans.ts`) with per-plan limits:
  `activeShareLinks`, `bookmarksPerPublicCollection`, `analytics`, `passwords`,
  `expiry`, `multiCollectionPages`, `branding`.
- `requirePlan(user, feature)` guard in `app/src/utils/auth.ts`, mirroring
  `requireVerifiedPublisher`. Throws `PlanRequiredError` (402) with the
  required plan + current plan.
- Enforce on visibility writes (`public`/`unlisted`): a free user may have at
  most 5 non-private (published) collections. Count the user's collections with
  `visibility <> 'private'`; reject with 402 if at/over the limit.
- Enforce in `POST /collections/:id/share`: free tier allows sharing of already-
  published collections only (no new share-link creation beyond the 5 published
  slots). Pro: unlimited.
- `user.plan` default stays `free`; only webhooks mutate it.

### be-20 — `subscriptions` table
Migration `0018_subscriptions.sql` + schema:
```
subscriptions:
  id (pk)
  userId (FK user, cascade)
  dodoSubscriptionId (unique)
  dodoCustomerId
  plan (free|pro|team)
  status (active|on_hold|cancelled|failed|expired|pending)
  currentPeriodStart, currentPeriodEnd
  cancelAtPeriodEnd (bool)
  createdAt, updatedAt
```
Indexes on `userId`, `dodoSubscriptionId` (unique), `status`.

### be-21 — Checkout + customer portal (contract published early)
- `POST /billing/checkout` — body `{ plan: "pro" | "team", successUrl?, cancelUrl? }`.
  Server creates a Dodo checkout session with the plan's product id, customer
  email from the session, `return_url = successUrl`. Returns `{ checkoutUrl }`.
  Client redirects to `checkoutUrl`. **Never grant access on redirect.**
- `POST /billing/portal` — creates a Dodo customer-portal session for the
  authenticated user (requires an existing `dodoCustomerId`); returns
  `{ portalUrl }`.
- `GET /billing/status` — returns `{ plan, status, currentPeriodEnd,
  cancelAtPeriodEnd }` from the local `subscriptions` row (or free defaults).

Contract for `agg-fe` (`fe-06`): `{ checkoutUrl }`, `{ portalUrl }`,
`{ plan, status, currentPeriodEnd, cancelAtPeriodEnd }`.

### be-22 — Webhook handler
- Route: `POST /webhooks/dodo` (public, no session; verified by signature).
- Raw body must be preserved (use `express.raw`-equivalent in Elysia) for
  `client.webhooks.unwrap(rawBody, { headers })`.
- Idempotency: store `webhook-id` in a `webhook_events` table (or reuse the
  jobs queue's dedup); skip if already processed. Replay-safe.
- Event handling (all 9 subscription events):
  - `subscription.active` → upsert subscription row, set `user.plan = plan`,
    grant access.
  - `subscription.on_hold` → mark status `on_hold`, **do not revoke access
    immediately** (recoverable via `updatePaymentMethod`); optionally schedule
    a grace-period job.
  - `subscription.failed` → **terminal: never grant access**, mark status
    `failed`, downgrade `user.plan = free`.
  - `subscription.cancelled` → mark cancelled, plan stays until period end;
    downgrade at `currentPeriodEnd` (scheduled job or lazy check).
  - `subscription.renewed` → extend `currentPeriodEnd`.
  - `subscription.plan_changed` → update plan + period.
  - `subscription.updated` → sync fields.
  - `payment.succeeded` → (one-time purchases only) grant one-time access.
  - `payment.failed` → log, no access change.
- Webhook signature verification via `client.webhooks.unwrap()`; reject 401 on
  failure. Verify timestamp freshness (handled by unwrap).

## New dependencies / env

- `dodopayments` npm package.
- Env: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`,
  `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` default in dev/test).
- Product ids per plan configured via env (`DODO_PRODUCT_PRO`, `DODO_PRODUCT_TEAM`)
  or a small config map.

## Migration numbering

Next migration after 0017: `0018_subscriptions.sql`, `0019_webhook_events.sql`.

## Test strategy

- Unit: PLANS config, requirePlan throws on insufficient plan.
- Integration: checkout creates a session (mock Dodo client in tests), webhook
  signature verification rejects bad sig, idempotent replay returns 200 without
  re-processing, `subscription.failed` never grants access, `on_hold` keeps
  access, `active` grants.

## Open questions

1. Product IDs: create the Pro product in the Dodo dashboard (test mode) first,
   then put its id in `DODO_PRODUCT_PRO`. Prefer dashboard + env (no seed
   coupling).
2. Grace period length for `on_hold` before downgrade: 7 days? (Defaulting to 7.)
3. Pro price is \$5/mo (from `client/src/lib/legal.ts`). Confirm the Dodo
   product is priced identically.
4. Free tier limit is 5 published collections (from `client/src/lib/legal.ts`).
   Confirm enforcement matches: count collections with `visibility <> 'private'`.