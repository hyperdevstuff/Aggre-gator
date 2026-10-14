import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { usePublicCollection } from "@/hooks/queries";
import {
  PublicCollectionView,
  PublicErrorPage,
  PublicPageSkeleton,
} from "@/components/public/public-collection-view";

const searchSchema = z.object({
  page: z.number().optional().default(1),
});

export const Route = createFileRoute("/u/$username/$slug")({
  validateSearch: searchSchema,
  component: PublicCollectionPage,
});

/**
 * The readable URL for a published collection.
 *
 * Renders through `PublicCollectionView`, the same component `/share/:code`
 * uses — the API returns the same payload shape for both, which is what keeps
 * the two surfaces from drifting apart.
 */
function PublicCollectionPage() {
  const { username, slug } = Route.useParams();
  const { page } = Route.useSearch();
  const { data, isLoading, isError } = usePublicCollection(username, slug, {
    page,
    limit: 24,
  });

  if (isLoading) return <PublicPageSkeleton label="Loading collection" />;

  if (isError || !data) {
    return (
      <PublicErrorPage
        message={
          isError
            ? "This collection doesn't exist, or its owner stopped publishing it."
            : undefined
        }
      >
        <div className="mt-2 flex flex-col items-center gap-2">
          <Link
            to="/u/$username"
            params={{ username }}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            ← @{username}
          </Link>
          <Link to="/explore" className="text-xs text-muted-foreground hover:underline">
            Browse Explore
          </Link>
        </div>
      </PublicErrorPage>
    );
  }

  return (
    <PublicCollectionView
      collection={data.collection}
      sharedByLabel={`collected by ${data.owner.name}`}
      bookmarks={data.bookmarks}
      nestedCollections={data.nestedCollections}
      // Nested collections carry their slug, so they link to their own readable
      // URL. Skipped when a nested collection has no slug (possible while a
      // subtree is only partly published).
      nestedHref={(nested) =>
        nested.slug ? `/u/${username}/${nested.slug}` : null
      }
      page={page}
      buildPageHref={(p) => `/u/${username}/${slug}?page=${p}`}
    />
  );
}