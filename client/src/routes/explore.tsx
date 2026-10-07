import type { CSSProperties } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Globe, FolderIcon } from "lucide-react";
import { z } from "zod";
import { SiteNavbar } from "@/components/landing/site-navbar";
import { Pagination } from "@/components/pagination";
import { SearchBar } from "@/components/search-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplore } from "@/hooks/queries";
import type { ExploreShare } from "@/types";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
});

export const Route = createFileRoute("/explore")({
  validateSearch: searchSchema,
  component: ExplorePage,
});

function ExplorePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useExplore({
    q: search.q,
    page: search.page,
    limit: 24,
  });

  const update = (patch: Partial<typeof search>) =>
    navigate({ to: "/explore", search: { ...search, ...patch, page: 1 } });

  const shares = data?.data ?? [];

  return (
    <div className="min-h-svh bg-background">
      <SiteNavbar />

      <main className="mx-auto max-w-6xl px-6 pt-36 pb-24 sm:pt-40">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Explore
          </h1>
          <p className="mt-3 text-pretty text-muted-foreground">
            Collections that people have published. Open any of them — no
            account, no sign-up.
          </p>
        </header>

        <div className="mt-8 max-w-md">
          <SearchBar
            key={search.q ?? ""}
            defaultValue={search.q}
            onSearch={(query) => update({ q: query || undefined })}
            placeholder="Search collections…"
            label="Search collections"
            showShortcut={false}
          />
        </div>

        {isLoading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center"
          >
            <Globe className="size-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load collections right now.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : shares.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
            <Globe className="size-6 text-muted-foreground/50" />
            <p className="text-sm font-medium">Nothing published yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {search.q
                ? `No collections match “${search.q}”.`
                : "No one has published a collection yet. Yours could be the first."}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shares.map((share) => (
                <ExploreCard key={share.code} share={share} />
              ))}
            </div>

            {data?.pagination && (
              <div className="mt-12">
                <Pagination
                  currentPage={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  onPageChange={(page) =>
                    navigate({ to: "/explore", search: { ...search, page } })
                  }
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ExploreCard({ share }: { share: ExploreShare }) {
  return (
    <Link
      to="/share/$code"
      params={{ code: share.code }}
      className={cn(
        "group flex flex-col rounded-xl border border-border/70 bg-card p-5 transition-colors",
        "hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            share.color
              ? "bg-(--tint-bg) text-(--tint-fg)"
              : "bg-primary/10 text-primary",
          )}
          style={
            {
              "--tint-bg": share.color ? `${share.color}20` : undefined,
              "--tint-fg": share.color || undefined,
            } as CSSProperties
          }
        >
          {share.icon ? (
            <span className="text-base">{share.icon}</span>
          ) : (
            <FolderIcon className="size-4" />
          )}
        </span>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium group-hover:text-primary">
            {share.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            shared by {share.sharedBy}
          </p>
        </div>
      </div>

      {share.description && (
        <p className="mt-3 line-clamp-3 text-sm text-pretty text-muted-foreground">
          {share.description}
        </p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {share.bookmarkCount} bookmark{share.bookmarkCount === 1 ? "" : "s"}
      </p>
    </Link>
  );
}
