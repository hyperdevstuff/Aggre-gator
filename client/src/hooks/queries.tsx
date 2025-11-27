import { api } from "@/lib/api-client";
import type { BookmarkFilter, SortOption } from "@/types";
import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";

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

export const collectionsQueryOptions = () =>
  queryOptions({
    queryKey: ["collections"],
    queryFn: api.collections.list,
    staleTime: 1000 * 60 * 5,
  });

export const collectionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["collections", id],
    queryFn: () => api.collections.get(id),
  });

export const useCollections = () => useQuery(collectionsQueryOptions());

export const useCollection = (id: string) =>
  useQuery(collectionQueryOptions(id));

export const tagsQueryOptions = () =>
  queryOptions({
    queryKey: ["tags"],
    queryFn: api.tags.list,
    staleTime: 1000 * 60 * 5,
  });

export const useTags = () => useQuery(tagsQueryOptions());

export const userQueryOptions = () =>
  queryOptions({
    queryKey: ["user"],
    queryFn: api.tags.list,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

export const useUser = () => useQuery(userQueryOptions());
