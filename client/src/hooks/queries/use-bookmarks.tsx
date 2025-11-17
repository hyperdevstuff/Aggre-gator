import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useBookmarks() {
  return useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => api.bookmarks.list(),
  });
}

export function useBookmark(id: string) {
  return useQuery({
    queryKey: ["bookmarks", id],
    queryFn: () => api.bookmarks.get(id),
    enabled: !!id,
  });
}
