import type { CSSProperties } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Globe } from "lucide-react";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { CollectionMosaic } from "@/components/public/collection-mosaic";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicProfile } from "@/hooks/queries";
import type { PublicCollection } from "@/types";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  page: z.number().int().positive().optional().default(1),
});

export const Route = createFileRoute("/u/$username/")({
  validateSearch: searchSchema,
  component: PublicProfilePage,
});

/** Public profile. No session required, no private fields in the payload. */
function PublicProfilePage() {
  const { username } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading, isError } = usePublicProfile(username, {
    page,
    limit: 24,
  });

  if (isLoading) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 pt-16 pb-24">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="mt-4 h-4 w-80" />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Globe className="size-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">Profile not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Nobody here goes by @{username}. It may have been changed.
        </p>
        <Link
          to="/explore"
          className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
        >
          Browse Explore instead
        </Link>
      </div>
    );
  }

  const { profile, collections } = data;
  const initials =
    profile.name
      ?.split(" ")
      .map((part: string) => part[0])
      .join("")
      .toUpperCase() || profile.username[0]?.toUpperCase();

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 pt-16 pb-24">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Explore
        </Link>

        <header className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar size="xl">
            <AvatarImage src={profile.avatar ?? ""} alt="" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              @{profile.username}
            </p>
            {profile.bio && (
              <p className="mt-3 max-w-prose text-pretty text-sm text-muted-foreground">
                {profile.bio}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {profile.stats.publicCollections} published collection
              {profile.stats.publicCollections === 1 ? "" : "s"} ·{" "}
              {profile.stats.publicBookmarks} bookmark
              {profile.stats.publicBookmarks === 1 ? "" : "s"}
            </p>
          </div>
        </header>

        {collections.data.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
            <Globe className="size-6 text-muted-foreground/50" />
            <p className="text-sm font-medium">Nothing published yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              @{profile.username} hasn&apos;t published a collection yet.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-14 columns-1 gap-5 sm:columns-2 lg:columns-3">
              {collections.data.map((collection) => (
                <ProfileCollectionCard
                  key={collection.id}
                  collection={collection}
                  username={profile.username}
                />
              ))}
            </div>

            {collections.pagination && (
              <div className="mt-12">
                <Pagination
                  currentPage={collections.pagination.page}
                  totalPages={collections.pagination.totalPages}
                  onPageChange={(next) =>
                    navigate({
                      to: "/u/$username",
                      params: { username },
                      search: { page: next },
                    })
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

function ProfileCollectionCard({
  collection,
  username,
}: {
  collection: PublicCollection;
  username: string;
}) {
  // A collection always has a slug once published — the API refuses to publish
  // without one — so link straight to the readable URL.
  const to = collection.slug
    ? `/u/${username}/${collection.slug}`
    : `/share/${collection.id}`;

  return (
    <Link
      to={to}
      className={cn(
        "group mb-5 flex break-inside-avoid flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-colors",
        "hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      <CollectionMosaic covers={collection.covers} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              collection.color
                ? "bg-(--tint-bg) text-(--tint-fg)"
                : "bg-primary/10 text-primary",
            )}
            style={
              {
                "--tint-bg": collection.color ? `${collection.color}20` : undefined,
                "--tint-fg": collection.color || undefined,
              } as CSSProperties
            }
          >
            <span className="text-base">
              {collection.icon ?? "📁"}
            </span>
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium group-hover:text-primary">
              {collection.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {collection.bookmarkCount} bookmark
              {collection.bookmarkCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {collection.description && (
          <p className="mt-3 line-clamp-3 text-pretty text-sm text-muted-foreground">
            {collection.description}
          </p>
        )}
      </div>
    </Link>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-6 py-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Logo className="size-3.5" />
          </div>
          <span className="font-geist">Aggregator</span>
        </Link>
      </div>
    </header>
  );
}