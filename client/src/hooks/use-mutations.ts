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
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Bookmark created");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create");
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
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Bookmark updated");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update");
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
      toast.success("Bookmark deleted");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
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
      toast.success("Bookmarks deleted");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    },
  });
}

export function useBulkArchiveBookmarks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => api.bookmarks.bulkArchive(ids),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success(
        result.archived === 1 ? "Bookmark archived" : `${result.archived} bookmarks archived`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to archive");
    },
  });
}

export function useBulkUnarchiveBookmarks() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => api.bookmarks.bulkUnarchive(ids),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success(
        result.unarchived === 1 ? "Bookmark restored" : `${result.unarchived} bookmarks restored`,
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to restore");
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
      toast.success("Bookmarks moved");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to move");
    },
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCollectionInput) => api.collections.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection created");
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
      toast.success("Collection updated");
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
      toast.success("Collection deleted");
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagInput) => api.tags.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag created");
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTagInput> }) =>
      api.tags.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success("Tag updated");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update tag");
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
      toast.success("Tag deleted");
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
      toast.success("Profile updated");
    },
  });
}

// === SHARE ===

export function useShareCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (collectionId: string) => api.share.create(collectionId),
    onSuccess: (_, collectionId) => {
      qc.invalidateQueries({ queryKey: ["share", collectionId] });
      toast.success("Collection is now public");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to share");
    },
  });
}

export function useUnshareCollection() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (collectionId: string) => api.share.revoke(collectionId),
    onSuccess: (_, collectionId) => {
      qc.invalidateQueries({ queryKey: ["share", collectionId] });
      toast.success("Collection is now private");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unshare");
    },
  });
}
