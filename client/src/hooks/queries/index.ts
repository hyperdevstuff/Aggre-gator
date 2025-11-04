import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { BookmarkFilter, SortOption } from "@/types";

export function useBookmarks(
  filters?: BookmarkFilter & {
    sort?: SortOption;
    page?: number;
    limit?: number;
  },
) {
  return useQuery({
    queryKey: ["bookmarks", filters],
    queryFn: () => api.bookmarks.list(filters),
    staleTime: 1000 * 60, // 1min
  });
}

export function useBookmark(id: string | undefined) {
  return useQuery({
    queryKey: ["bookmarks", id],
    queryFn: () => api.bookmarks.get(id!),
    enabled: !!id,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: api.collections.list,
    staleTime: 1000 * 60 * 5, // 5min - changes less frequently
  });
}

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: ["collections", id],
    queryFn: () => api.collections.get(id!),
    enabled: !!id,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: api.tags.list,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: api.user.me,
    staleTime: 1000 * 60 * 10, // 10min
    retry: false, // don't retry if not authenticated
  });
}
