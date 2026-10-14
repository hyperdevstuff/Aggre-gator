import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { usePublicShare } from "@/hooks/queries";
import {
  PublicCollectionView,
  PublicErrorPage,
  PublicPageSkeleton,
} from "@/components/public/public-collection-view";

const searchSchema = z.object({
  page: z.number().optional().default(1),
});

export const Route = createFileRoute("/share/$code")({
  validateSearch: searchSchema,
  component: PublicSharePage,
});

/**
 * The unlisted URL: `visibility` does not gate this route at all. Holding the
 * code is the authorisation, which is why `/u/:username/:slug` renders through
 * the same component with the same payload shape.
 */
function PublicSharePage() {
  const { code } = Route.useParams();
  const { page } = Route.useSearch();
  const { data, isLoading, isError, error } = usePublicShare(code, {
    page,
    limit: 24,
  });

  if (isLoading) return <PublicPageSkeleton label="Loading collection" />;

  if (isError) {
    const status = (error as { status?: number } | null)?.status;
    return (
      <PublicErrorPage
        title={status === 410 ? "Link Expired" : "Not Found"}
        message={
          status === 410
            ? "This shared collection is no longer available."
            : "The share link you followed doesn't exist or has been removed."
        }
      />
    );
  }

  if (!data) return <PublicErrorPage />;

  return (
    <PublicCollectionView
      collection={data.collection}
      sharedByLabel={`shared by ${data.sharedBy}`}
      bookmarks={data.bookmarks}
      nestedCollections={data.nestedCollections}
      page={page}
      buildPageHref={(p) => `/share/${code}?page=${p}`}
    />
  );
}