Two Elysia facts cost real time while building the request logger (`be-02`).
Both are now encoded in comments at the call sites, but they are the kind of
thing that gets rediscovered the hard way.

## 1. Plugin hooks only apply to routes registered *after* them

`.use()` order is registration order. A plugin's `onRequest`/`onAfterHandle`/
`onError` do not run for routes declared above it.

```ts
new Elysia()
  .use(requestLogger)   // ✅ covers everything below
  .use(bookmarksRouter) // ← covered

new Elysia()
  .get("/health", ...)  // ❌ registered first — no request-id
  .use(requestLogger)
  .use(bookmarksRouter)
```

Minimal repro: the same child router mounted before vs after the logger gives
`x-request-id: null` in one order and a real id in the other.

This is why `requestLogger` is now the **first** `.use()` in `src/index.ts` —
before `/health`. The same rule already governed `betterAuthPlugin` and the SPA
catch-all, which the file documented; the logger just added a third instance of
it, and silently.

## 2. `.error({ Class })` handlers take precedence over `onError`

`errorPlugin` registers per-class handlers:

```ts
new Elysia()
  .error({ UnauthorizedError, NotFoundError, ConflictError, /* ... */ })
  .onError(/* generic */)
```

When a thrown error matches a registered class, Elysia runs **that** handler and
the `onError` never fires. So a global `onError` in a different plugin — the
request logger's — is silently skipped for every 401/404/409.

Symptom that identifies it: success responses log fine, `NOT_FOUND` (handled by
a plain `{ error }` return in the generic `onError`) logs fine, and *only* the
registered `ApiError` subclasses vanish.

`errorPlugin`'s `onError` therefore attaches the id and logs explicitly in each
of its branches. If you add a new error class to `.error({...})`, add the
`attachRequestId` + `logRequest` pair to its branch too.

## Bonus: `toResponse()` discards `set.headers`

`ApiError.toResponse()` constructs a brand-new `Response`, which drops
everything Elysia accumulated in `set.headers`. `Retry-After` survives only
because it is set on the `Response` directly. `errorPlugin` now copies
`set.headers` across, so any header a plugin attached on the way to an error
response survives. Watch out for `set.headers` changing representation from a
plain object to a `Headers` instance mid-flight — `attachRequestId` handles
both.