# AGENTS.md

## Project Overview

This is a bookmark management application with:
- **Backend**: Bun + Elysia + Drizzle ORM + PostgreSQL + Better-auth
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + TanStack Query
- **Monorepo structure**: `app/` (backend) and `client/` (frontend)

---

## Build, Lint, and Test Commands

### Backend (app/)

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with hot reload (runs `bun run --watch src/index.ts`) |
| `bun test` | Run all tests with `bun test --env-file=.env.test.local` |
| `bun test src/test/bookmark.test.ts` | Run single test file |
| `bun test -t "create bookmark"` | Run tests matching a specific test name pattern |
| `drizzle-kit studio` | Open Drizzle Studio to view/modify database |
| `drizzle-kit generate` | Generate migrations from schema changes |
| `drizzle-kit migrate` | Run pending migrations against database |

**Note**: Backend uses Bun's built-in test runner. Tests use `describe`, `test`, `expect` from `bun:test`.

### Frontend (client/)

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server |
| `bun run build` | Build for production (`tsc -b && vite build`) |
| `bun run lint` | Run ESLint on entire project |
| `bun run lint src/components/sidebar/` | Lint specific directory |
| `bun run preview` | Preview production build locally |

**Important**: Always run `bun run build` before committing to verify no TypeScript errors.

---

## Git Tools

### Difftastic

Use `difftastic` for syntax-aware diffs that show actual code changes rather than line-based diffs.

```bash
# View staged changes with difftastic
git diff --staged --difftastic

# View working directory changes
git diff --difftastic

# Set as default diff tool
git config --global diff.tool difft
git config --global difftool.difftastic.cmd 'difft --color=always "$LOCAL" "$REMOTE"'
```

### Mergiraf

Use `mergiraf` for structural merge conflicts that understand code structure.

```bash
# Merge with mergiraf (for complex merges)
mergiraf merge --output merged_file.ts file1.ts file2.ts base.ts

# Resolve conflicts
mergiraf resolve --interactive conflicted_file.ts

# Configure git to use mergiraf
git config --global mergetool.mergiraf.cmd 'mergiraf merge --output $BASE $LOCAL $REMOTE $MERGED'
git config --global mergetool.mergiraf.trustExitCode true
git config --global merge.tool mergiraf
```

**Tip**: Run `difftastic` before committing to review changes clearly. Use `mergiraf` for resolving merge conflicts in code files.

---

## Code Style Guidelines

### General Principles

- Write self-documenting code with clear naming
- Keep functions small and focused on a single responsibility
- Use early returns to reduce nesting
- Avoid magic numbers - use named constants

### TypeScript Usage

- Enable `strict: true` in `tsconfig.json` - no `any` without explicit annotation
- Use explicit return types for public functions and complex logic
- Prefer interfaces over type aliases for object shapes, use types for unions/primitives
- Use `null` for "intentionally nothing" and `undefined` for "not yet provided"
- Export types alongside implementations when they're used externally

### Backend (Elysia) Conventions

**Router Definition**:
```typescript
// Use named exports for routers
export const bookmarksRouter = new Elysia({ prefix: "/bookmarks" })
  .use(requireAuth)
  .post("/", async ({ body, userId }) => { /* ... */ }, { body: t.Object({...}) })
  .get("/", async ({ query }) => { /* ... */ }, { query: t.Object({...}) })
  .use(childRouter);
```

**Error Handling**:
```typescript
// Use custom ApiError subclasses
throw new UnauthorizedError();
throw new NotFoundError("Bookmark not found");
throw new ConflictError("Bookmark already exists");
```

**Database Queries**:
- Use `drizzle-orm` with explicit column selection
- Use query builders for complex queries
- Always handle empty results explicitly (`[0]?.id` pattern)
- Use `Promise.all()` for parallel independent queries

### Frontend (React) Conventions

**Component Structure**:
```typescript
// Functional components with named exports
export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  // hooks first
  const query = useQuery(...);

  // early returns
  if (isLoading) return <Skeleton />;

  // render
  return <div>...</div>;
}
```

**React Query**:
- Create `queryOptions` functions for each entity
- Export both `queryOptions` and `useX` hooks
- Use `useSuspenseQuery` for critical data that blocks rendering
- Set appropriate `staleTime` (60s for lists, 5min for static data)

**Tailwind/CSS**:
- Use `cn()` utility from `@/lib/utils` to merge Tailwind classes
- Use `cva` (class-variance-authority) for component variants
- Follow shadcn/ui patterns for UI components

---

## Import Conventions

### Backend (app/src/)

```typescript
// Order: external -> internal relative
import { Elysia, t } from "elysia";
import { db } from "../db";
import { bookmarks, bookmarkTags } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { UnauthorizedError } from "../error";
import { requireAuth } from "../utils/auth";
```

### Frontend (client/src/)

```typescript
// Order: external -> alias (@/) -> relative
import { useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/ui/sidebar";
```

**Always use `@/` alias for imports from `client/src/`.**

---

## Naming Conventions

| Construct | Convention | Example |
|-----------|------------|---------|
| Files | kebab-case | `bookmark-card.tsx`, `api-client.ts` |
| Components | PascalCase | `BookmarkCard`, `CollectionsSection` |
| Variables/functions | camelCase | `isLoading`, `fetchBookmarks` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PAGE_SIZE`, `API_BASE_URL` |
| Types/Interfaces | PascalCase | `BookmarkFilter`, `SortOption` |
| Database tables | snake_case (plural) | `bookmarks`, `bookmark_tags` |
| Columns | snake_case | `created_at`, `user_id` |
| Router variables | camelCase + "Router" suffix | `bookmarksRouter`, `tagsRouter` |
| Query keys | kebab-case array | `["bookmarks", filters]`, `["collections"]` |
| CSS classes | kebab-case | `flex items-center justify-between` |

---

## Error Handling

### Backend

- Use custom error classes extending `ApiError` (defined in `app/src/error.ts`)
- Let Elysia's `errorPlugin` handle validation errors automatically
- Log unexpected errors in development only: `if (process.env.NODE_ENV !== "production")`
- Never expose stack traces or internal error details to clients

### Frontend

- Use React Query's `error` property from returned objects
- Display user-friendly error messages via toast notifications (sonner)
- Implement retry logic for transient failures using React Query's `retry` option

---

## Database Schema (Drizzle ORM)

- Tables use `snake_case` naming in PostgreSQL
- Schema defined in `app/src/db/schema.ts`
- Always include `createdAt` and `updatedAt` timestamps on tables
- Use UUIDs for primary keys (`id: text().primaryKey().default(cuid())`)
- Define relationships using foreign keys and indexes
- System collections use `isSystem: true` flag

---

## Authentication

- Uses `better-auth` with Drizzle adapter
- Auth handlers defined in `app/src/utils/auth.ts`
- Protect routes using `requireAuth` plugin
- Sessions expire after 7 days

---

## API Patterns

### Backend Routes

- All routes prefixed with `/api/` at the main app level
- Routers use Elysia's `prefix` option for grouping
- Request validation using `@sinclair/typebox` via `elysia-typebox`
- Response patterns: single object for GET-by-id, paginated list `{ data: [], pagination: {...} }` for lists

### Frontend API Client

- Centralized in `client/src/lib/api-client.ts`
- Use typed API client, not direct `fetch` calls
- Mutations use React Query hooks from `client/src/hooks/use-mutations.ts`

---

## Testing Guidelines

### Backend Tests

- Located in `app/src/test/`
- Use `describe` blocks for grouping, `test` for individual cases
- Use `beforeAll` for setup (signup, auth token)
- Test file naming: `{feature}.test.ts`
- Always test error cases alongside success cases

### Frontend Tests

- No test suite configured yet (add as needed)
- Recommended: Vitest + React Testing Library
- Place tests alongside components: `Button.test.tsx` next to `Button.tsx`

---

## File Structure

```
app/
├── src/
│   ├── bookmarks/      # Bookmark API router & sub-routes
│   ├── collections/    # Collection API router
│   ├── db/             # Database connection & schema
│   ├── search/         # Search API router
│   ├── tags/           # Tags API router
│   ├── test/           # Test files
│   ├── utils/          # Auth, metadata utilities
│   ├── error.ts        # Error classes & plugin
│   └── index.ts        # Main app entry
├── drizzle.config.ts
└── package.json

client/
├── src/
│   ├── components/
│   │   ├── ui/         # Base UI components (shadcn)
│   │   ├── sidebar/    # Sidebar components
│   │   └── ...
│   ├── hooks/          # React Query hooks, auth hooks
│   ├── lib/            # API client, utils
│   ├── routes/         # TanStack Router routes
│   ├── types/          # Shared type definitions
│   └── main.tsx
├── vite.config.ts
└── package.json
```

---

## Environment Variables

### Backend (app/.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_URL` | Yes | Auth API base URL |
| `CLIENT_URL` | Yes | Frontend URL for CORS |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (development/production) |

### Frontend (client/.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend URL (default: http://localhost:3000) |
