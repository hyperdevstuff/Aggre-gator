import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BookmarkFilter, SortOption } from "@/types";

export const bookmarksQueryOptions = (
  filters?: BookmarkFilter & {
    sort?: SortOption;
    page?: number;
    limit?: number;
  },
) =>
  queryOptions({
    queryKey: ["bookmarks", filters],
    queryFn: () => api.bookmarks.list(filters),
    staleTime: 1000 * 60,
  });

export const bookmarkQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["bookmarks", id],
    queryFn: () => api.bookmarks.get(id),
  });

export const useBookmarks = (
  filters?: Parameters<typeof bookmarksQueryOptions>[0],
) => useQuery(bookmarksQueryOptions(filters));

export const useBookmark = (id: string) => useQuery(bookmarkQueryOptions(id));

export const useSuspenseBookmarks = (
  filters?: Parameters<typeof bookmarksQueryOptions>[0],
) => useSuspenseQuery(bookmarksQueryOptions(filters));
