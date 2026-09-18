import { useRef, useState } from "react";
import { BookmarkDialog } from "@/components/bookmark-dialog";
import { TagDialog } from "@/components/tag-dialog";
import type { Bookmark, SortOption } from "@/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useBookmarks, useCollections, useTags } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useBulkArchiveBookmarks, useBulkUnarchiveBookmarks, useBulkDeleteBookmarks, useMoveBookmarks } from "@/hooks/use-mutations";
import { SearchBar } from "@/components/search-bar";
import { BookmarksGrid } from "@/components/bookmark-grid";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Pagination } from "@/components/pagination";
import { FilterBadges } from "@/components/filter-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  page: z.number().int().positive().optional().default(1),
  sort: z.enum(["created_desc", "created_asc", "title_asc", "title_desc", "url_asc"]).optional(),
});

export const Route = createFileRoute("/_protected/dashboard")({
  validateSearch: searchSchema,
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: tags } = useTags();
  const collectionName = collections?.find((collection) => collection.id === search.collectionId)?.name;
  const archivedCollectionId = collections?.find(
    (collection) => collection.isSystem && collection.name.toLowerCase() === "archived",
  )?.id;
  const viewingArchived = search.collectionId !== undefined && search.collectionId === archivedCollectionId;
  const updateFilters = (patch: Partial<typeof search>) => {
    setSelectedIds([]);
    navigate({ to: "/dashboard", search: { ...search, ...patch, page: 1 } });
  };
  const filters = [
    ...(search.collectionId ? [{ key: "collection", label: collectionName ?? "Collection", onRemove: () => updateFilters({ collectionId: undefined }) }] : []),
    ...(search.tags ?? []).map((id) => ({ key: `tag-${id}`, label: tags?.find((tag) => tag.id === id)?.name ?? "Tag", onRemove: () => updateFilters({ tags: search.tags?.filter((tagId) => tagId !== id) }) })),
    ...(search.isFavorite !== undefined ? [{ key: "favorite", label: search.isFavorite ? "Favorites" : "Not favorites", onRemove: () => updateFilters({ isFavorite: undefined }) }] : []),
    ...(search.search ? [{ key: "search", label: `Search: ${search.search}`, onRemove: () => updateFilters({ search: undefined }) }] : []),
  ];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark>();
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; color?: string | null }>();
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const tagReturnFocus = useRef<HTMLElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openCreate = () => {
    returnFocus.current = document.activeElement as HTMLElement;
    setEditingBookmark(undefined);
    setDialogOpen(true);
  };

  const openEdit = (bookmark: Bookmark) => {
    // The menu item unmounts on selection; return to its persistent trigger.
    returnFocus.current = document.querySelector<HTMLElement>(`[data-bookmark-menu="${CSS.escape(bookmark.id)}"]`);
    setEditingBookmark(bookmark);
    setDialogOpen(true);
  };

  const openEditTag = (tag: { id: string; name: string; color?: string | null }) => {
    tagReturnFocus.current = document.activeElement as HTMLElement;
    setEditingTag(tag);
    setTagDialogOpen(true);
  };

  const { data, isLoading, error, refetch } = useBookmarks({
    collectionId: search.collectionId,
    tags: search.tags,
    isFavorite: search.isFavorite,
    search: search.search,
    page: search.page,
    sort: search.sort,
    limit: 20,
  });

  const handleSearch = (query: string) => {
    setSelectedIds([]);
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
    setSelectedIds([]);
    navigate({
      to: "/dashboard",
      search: { ...search, page },
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id],
    );
  };

  const bulkArchive = useBulkArchiveBookmarks();
  const bulkUnarchive = useBulkUnarchiveBookmarks();
  const bulkDelete = useBulkDeleteBookmarks();
  const moveBookmarks = useMoveBookmarks();
  const bulkPending =
    bulkArchive.isPending || bulkUnarchive.isPending || bulkDelete.isPending || moveBookmarks.isPending;
  const clearAfterBulk = () => setSelectedIds([]);

  return (
    <div className="min-w-0 flex-1 p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar key={search.search ?? ""} defaultValue={search.search} onSearch={handleSearch} />
        <Select value={search.sort ?? "created_desc"}
          onValueChange={(value) => updateFilters({ sort: value as SortOption })}>
          <SelectTrigger aria-label="Sort bookmarks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Newest first</SelectItem>
            <SelectItem value="created_asc">Oldest first</SelectItem>
            <SelectItem value="title_asc">Title A–Z</SelectItem>
            <SelectItem value="title_desc">Title Z–A</SelectItem>
            <SelectItem value="url_asc">URL A–Z</SelectItem>
          </SelectContent>
        </Select>
        <Button className="cursor-pointer" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New
        </Button>
      </div>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/dashboard" search={{ page: 1 }} />}>All Bookmarks</BreadcrumbLink>
          </BreadcrumbItem>
          {search.collectionId && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem aria-current="page">{collectionName ?? (collectionsLoading ? "Loading collection…" : "Collection unavailable")}</BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <FilterBadges filters={filters} />
      <BookmarksGrid
        bookmarks={data?.data || []}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        onCreateFirst={openCreate}
        onEditBookmark={openEdit}
        onEditTag={openEditTag}
        archivedCollectionId={archivedCollectionId}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />
      <BulkActionBar
        count={selectedIds.length}
        pending={bulkPending}
        collections={collections ?? []}
        showUnarchive={viewingArchived}
        onArchive={() => bulkArchive.mutate(selectedIds, { onSuccess: clearAfterBulk })}
        onUnarchive={() => bulkUnarchive.mutate(selectedIds, { onSuccess: clearAfterBulk })}
        onMove={(collectionId) =>
          moveBookmarks.mutate({ ids: selectedIds, collectionId }, { onSuccess: clearAfterBulk })
        }
        onDelete={() => bulkDelete.mutate(selectedIds, { onSuccess: clearAfterBulk })}
        onClear={() => setSelectedIds([])}
      />
      <BookmarkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bookmark={editingBookmark}
        collectionId={search.collectionId}
        isFavorite={search.isFavorite}
        returnFocus={returnFocus}
      />
      {editingTag && (
        <TagDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          tag={{ id: editingTag.id, name: editingTag.name, color: editingTag.color ?? undefined }}
          returnFocus={tagReturnFocus}
        />
      )}
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
