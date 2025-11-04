import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { updateBoo } from "@/types";

export function useCreateBookmark() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBookmark) => api.bookmarks.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}
