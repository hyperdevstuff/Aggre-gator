import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useBookmarks } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { FilterBadges } from "@/components/filter-badges";
import { BookmarksGrid } from "@/components/bookmark-grid";
import { Pagination } from "@/components/pagination";

const searchSchema = z.object({
  collectionId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().optional().default(1),
});

export const Route = createFileRoute("/_protected/dashboard")({
  validateSearch: searchSchema,
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const { data, isLoading, error, refetch } = useBookmarks({
    collectionId: search.collectionId,
    tags: search.tags,
    isFavorite: search.isFavorite,
    search: search.search,
    page: search.page,
    limit: 20,
  });

  const handleSearch = (query: string) => {
    navigate({
      to: "/dashboard",
      search: {
        ...search,
        search: query || undefined,
        page: 1,
      },
    });
  };

  const handlePageChange = (page: number) => {
    navigate({
      to: "/dashboard",
      search: { ...search, page },
    });
  };

  const removeFilter = (key: keyof typeof search) => {
    navigate({
      to: "/dashboard",
      search: { ...search, [key]: undefined, page: 1 },
    });
  };
  const activeFilters = [
    search.isFavorite && {
      key: "isFavorite",
      label: "favorites",
      onRemove: () => removeFilter("isFavorite"),
    },
    search.collectionId && {
      key: "collectionId",
      label: `collection: ${search.collectionId}`,
      onRemove: () => removeFilter("collectionId"),
    },
    search.search && {
      key: "search",
      label: `search: "${search.search}"`,
      onRemove: () => removeFilter("search"),
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    onRemove: () => void;
  }>;

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">bookmarks</h1>
          <p className="text-muted-foreground">
            {data?.pagination.total || 0} total
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Bookmark
        </Button>
      </div>

      <SearchBar defaultValue={search.search} onSearch={handleSearch} />
      <FilterBadges filters={activeFilters} />
      <BookmarksGrid
        bookmarks={data?.data || []}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
      />
      {data && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
