import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import type {
    CreateBookmarkInput,
    UpdateBookmarkInput,
    CreateCollectionInput,
    UpdateCollectionInput,
    CreateTagInput,
} from "@/types";
import { toast } from "sonner";

export function useSignOut() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: () => authClient.signOut(),
        onSuccess: () => {
            qc.clear();
            toast.success("Signed out successfully");
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to sign out");
        },
    });
}

export function useCreateBookmark() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBookmarkInput) => api.bookmarks.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("bookmark created");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "failed to create");
    },
  });
}

export function useUpdateBookmark() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookmarkInput }) =>
      api.bookmarks.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["bookmarks", id] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("bookmark updated");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "failed to update");
    },
  });
}

export function useDeleteBookmark() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.bookmarks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success("bookmark deleted");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "failed to delete");
    },
  });
}

export function useBulkDeleteBookmarks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => api.bookmarks.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success("bookmarks deleted");
    },
  });
}

export function useMoveBookmarks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      ids,
      collectionId,
    }: {
      ids: string[];
      collectionId: string | null;
    }) => api.bookmarks.move(ids, collectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("bookmarks moved");
    },
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCollectionInput) => api.collections.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("collection created");
    },
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCollectionInput }) =>
      api.collections.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["collections", id] });
      toast.success("collection updated");
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.collections.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success("collection deleted");
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagInput) => api.tags.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success("tag created");
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.tags.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success("tag deleted");
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<{ name: string; image: string }>) =>
      api.user.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user"] });
      toast.success("profile updated");
    },
  });
}
