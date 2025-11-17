import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useCreateBookmark() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBookmark) => api.bookmarks.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}
