# `client/` — web app

React + Vite + TanStack Router/Query + Tailwind + shadcn/ui (Base UI port).
Dev server on **port 5180** (pinned via `VITE_PORT` in `.env.local`). Full setup
and the command table live in the top-level [`README.md`](../README.md).

## Layout

| Path | What |
|---|---|
| `src/routes/` | File-based routes — `__root`, `_protected` (dashboard), `share.$code`, `explore`, auth pages, `landing-prototype` |
| `src/components/ui/` | shadcn components on the Base UI port |
| `src/components/` | Product components — bookmark grid/card/dialog, sidebar, share dialog, landing sections, hairline host |
| `src/lib/hairline/host.ts` | Loads `public/<name>.js` figures and mounts them in React |
| `src/lib/api-client.ts` | Typed fetch wrapper — every API call goes through here |
| `src/hooks/` | React Query options (`queries.tsx`) and mutations (`use-mutations.ts`) |
| `src/types/index.ts` | Shared API response types. `PublicBookmark` is deliberately narrower than `Bookmark` |
| `src/index.css` | Tokens: the "wet slate" theme (`[data-wet-slate]`), `--hairline-*` palette, `meta-sm` |
| `public/` | Served at the root. Fonts, `logo.svg`, the hairline kernel and figures, plus bench files (`*.html`, `shoot.mjs`) that are tools, not app code |

## Conventions

- Base UI uses the **`render` prop**, not Radix's `asChild`.
- Keep dialog state in an inner component that mounts on open — the
  `react-hooks/set-state-in-effect` rule rejects resetting it from an effect.
- No inline styles for anything a token can express; ESLint enforces this.
- Icon-only buttons need `aria-label`.

Design system and landing-page rules: [`docs/DESIGN.md`](../docs/DESIGN.md).