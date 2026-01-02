import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useBookmarks, useCollections } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { BookmarksGrid } from "@/components/bookmark-grid";
import { Pagination } from "@/components/pagination";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

  const { data: collections } = useCollections();
  const currentCollection = collections?.find(
    (c) => c.id === search.collectionId,
  );

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
      label: `collection: ${currentCollection?.name || search.collectionId}`,
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
      <div className="flex items-center justify-between gap-4">
        <SearchBar
          defaultValue={search.search}
          onSearch={handleSearch}
          className="flex-1 max-w-2xl"
        />
        <Button className="cursor-pointer shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          new
        </Button>
      </div>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">all</BreadcrumbLink>
          </BreadcrumbItem>
          {currentCollection && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{currentCollection.name}</BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

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
