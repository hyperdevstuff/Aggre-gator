# AGENTS.md

## Project Overview

Bookmark management application with:
- **Backend**: Bun + Elysia + Drizzle ORM + PostgreSQL + Better-auth
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + TanStack Query/Router
- **Structure**: Monorepo with `app/` (backend) and `client/` (frontend)

---

## Build, Lint, and Test Commands

### Backend (app/)

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server (runs `bun run --watch src/index.ts`) |
| `bun test` | Run all tests (`bun test --env-file=.env.test.local`) |
| `bun test src/test/bookmark.test.ts` | Run single test file |
| `bun test -t "create bookmark"` | Run tests matching pattern |
| `drizzle-kit studio` | Open Drizzle Studio |
| `drizzle-kit generate` | Generate migrations |
| `drizzle-kit migrate` | Run pending migrations |

**Test runner**: Bun's built-in (`describe`, `test`, `expect` from `bun:test`)

### Frontend (client/)

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server |
| `bun run build` | Build for production (`tsc -b && vite build`) |
| `bun run lint` | Run ESLint on entire project |
| `bun run lint src/components/sidebar/` | Lint specific directory |
| `bun run preview` | Preview production build |

**Important**: Always run `bun run build` before committing to verify no TypeScript errors.

---

## Code Style Guidelines

### General
- Write self-documenting code with clear naming
- Keep functions small and focused
- Use early returns to reduce nesting
- Avoid magic numbers - use named constants

### TypeScript
- `strict: true` enabled in both backends
- Use explicit return types for public functions
- Prefer interfaces for object shapes, types for unions/primitives
- Export types alongside implementations

### Backend (Elysia)

**Router Pattern**:
```typescript
export const bookmarksRouter = new Elysia({ prefix: "/bookmarks" })
  .use(betterAuthPlugin)
  .post("/", async ({ body, user }) => { /* ... */ }, {
    body: t.Object({...}) // TypeBox validation
  })
  .get("/", async ({ query }) => { /* ... */ }, {
    query: t.Object({...})
  });
```

**Error Handling**:
```typescript
// Use custom ApiError subclasses
throw new NotFoundError("Bookmark not found");
throw new ConflictError("Already exists");
```

**Database Queries**:
- Use Drizzle ORM with explicit column selection
- Use `Promise.all()` for parallel queries
- Handle empty results: `[0]?.id` pattern

### Frontend (React)

**Component Pattern**:
```typescript
export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const mutation = useUpdateBookmark();
  if (mutation.isPending) return <Skeleton />;
  return <Card>...</Card>;
}
```

**React Query**:
- Create `queryOptions` functions for each entity
- Export both `queryOptions` and `useX` hooks
- Use `useSuspenseQuery` for critical data
- Set `staleTime`: 60s for lists, 5min for static data

**Tailwind**:
- Use `cn()` utility for class merging
- Follow shadcn/ui patterns
- Use `cva` for component variants

---

## Import Conventions

### Backend (app/src/)

```typescript
// Order: external -> internal relative
import { Elysia, t } from "elysia";
import { db } from "../db";
import { bookmarks } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../error";
import { requireAuth } from "../utils/auth";
```

### Frontend (client/src/)

```typescript
// Order: external -> alias (@/) -> relative
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
```

**Always use `@/` alias for `client/src/` imports.**

---

## Naming Conventions

| Construct | Convention | Example |
|-----------|------------|---------|
| Files | kebab-case | `bookmark-card.tsx`, `api-client.ts` |
| Components | PascalCase | `BookmarkCard`, `CollectionsSection` |
| Variables/functions | camelCase | `isLoading`, `fetchBookmarks` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PAGE_SIZE` |
| Types/Interfaces | PascalCase | `BookmarkFilter`, `SortOption` |
| DB tables | snake_case (plural) | `bookmarks`, `bookmark_tags` |
| DB columns | snake_case | `created_at`, `user_id` |
| Routers | camelCase + "Router" | `bookmarksRouter` |
| Query keys | kebab-case array | `["bookmarks", filters]` |

---

## Error Handling

### Backend
- Use custom error classes from `app/src/error.ts`
- Let Elysia's `errorPlugin` handle validation
- Log errors in dev only: `if (process.env.NODE_ENV !== "production")`
- Never expose stack traces to clients

### Frontend
- Use React Query's `error` property
- Display errors via toast (sonner)
- Implement retry logic for transient failures

---

## Database (Drizzle ORM)

- Tables: `snake_case` (plural) in PostgreSQL
- Schema: `app/src/db/schema.ts`
- Always include `createdAt` and `updatedAt` timestamps
- Use UUIDs: `text().primaryKey().default(cuid())`
- Define relationships with foreign keys and indexes
- System collections use `isSystem: true` flag

---

## Authentication

- Uses `better-auth` with Drizzle adapter
- Auth handlers: `app/src/utils/auth.ts`
- Protect routes: `betterAuthPlugin` (injects `user` and `session`)
- Sessions expire after 7 days

---

## API Patterns

### Backend Routes
- All prefixed with `/api/` at main level
- Routers use `prefix` option for grouping
- Request validation: `@sinclair/typebox`
- Responses: single object for GET-by-id, `{ data: [], pagination: {...} }` for lists

### Frontend API Client
- Centralized: `client/src/lib/api-client.ts`
- Use typed client, not direct `fetch`
- Mutations: `client/src/hooks/use-mutations.ts`

---

## Testing Guidelines

### Backend Tests
- Location: `app/src/test/`
- Use `describe` blocks, `test` for cases
- Use `beforeAll` for setup (signup, auth token)
- File naming: `{feature}.test.ts`
- Test both success and error cases

### Frontend Tests
- No test suite yet (add as needed)
- Recommended: Vitest + React Testing Library
- Place tests alongside components

---

## File Structure

```
app/src/
├── bookmarks/     # Bookmark API router
├── collections/   # Collection API router
├── db/            # Schema & connection
├── search/        # Search API router
├── tags/          # Tag API router
├── test/          # Integration tests
├── utils/         # Auth, pagination, metadata
├── error.ts       # Error classes
└── index.ts       # Main app entry

client/src/
├── components/ui/ # shadcn/ui components
├── components/sidebar/
├── hooks/         # React Query hooks
├── lib/           # API client, utils
├── routes/        # TanStack Router routes
├── types/         # Shared types
└── main.tsx       # Entry point
```
