import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  CreateBookmarkInput,
  UpdateBookmarkInput,
  CreateCollectionInput,
  UpdateCollectionInput,
  CreateTagInput,
} from "@/types";

export function useCreateBookmark() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBookmarkInput) => api.bookmarks.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["collections"] }); // count changed
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
    },
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCollectionInput) => api.collections.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
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
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.collections.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] }); // might need refresh
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagInput) => api.tags.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.tags.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] }); // tags removed
    },
  });
}

// === USER ===

export function useUpdateUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<{ name: string; avatar: string }>) =>
      api.user.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user"] });
    },
  });
}
