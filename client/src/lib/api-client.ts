import type {
  Bookmark,
  CreateBookmarkInput,
  UpdateBookmarkInput,
  Collection,
  CreateCollectionInput,
  UpdateCollectionInput,
  Tag,
  CreateTagInput,
  User,
  BookmarkFilter,
  SortOption,
  PaginatedResponse,
} from "@/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, error.message, error.errors);
  }

  return res.json();
}

export const bookmarksApi = {
  list: (
    params?: BookmarkFilter & {
      sort?: SortOption;
      page?: number;
      limit?: number;
    },
  ) => {
    const query = new URLSearchParams();
    if (params?.collectionId) query.set("collectionId", params.collectionId);
    if (params?.tags?.length) query.set("tags", params.tags.join(","));
    if (params?.isFavorite !== undefined)
      query.set("isFavorite", String(params.isFavorite));
    if (params?.search) query.set("search", params.search);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));

    return fetcher<PaginatedResponse<Bookmark>>(`/bookmarks?${query}`);
  },

  get: (id: string) => fetcher<Bookmark>(`/bookmarks/${id}`),

  create: (data: CreateBookmarkInput) =>
    fetcher<Bookmark>("/bookmarks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateBookmarkInput) =>
    fetcher<Bookmark>(`/bookmarks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetcher<void>(`/bookmarks/${id}`, { method: "DELETE" }),

  bulkDelete: (ids: string[]) =>
    fetcher<void>("/bookmarks/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  move: (ids: string[], collectionId: string | null) =>
    fetcher<void>("/bookmarks/move", {
      method: "POST",
      body: JSON.stringify({ ids, collectionId }),
    }),
};

// === COLLECTIONS ===

export const collectionsApi = {
  list: () => fetcher<Collection[]>("/collections"),

  get: (id: string) => fetcher<Collection>(`/collections/${id}`),

  create: (data: CreateCollectionInput) =>
    fetcher<Collection>("/collections", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateCollectionInput) =>
    fetcher<Collection>(`/collections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetcher<void>(`/collections/${id}`, { method: "DELETE" }),
};

// === TAGS ===

export const tagsApi = {
  list: () => fetcher<Tag[]>("/tags"),

  create: (data: CreateTagInput) =>
    fetcher<Tag>("/tags", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: string) => fetcher<void>(`/tags/${id}`, { method: "DELETE" }),
};

// === USER ===

export const userApi = {
  me: () => fetcher<User>("/user/me"),

  update: (data: Partial<User>) =>
    fetcher<User>("/user/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// === EXPORT ===

export const api = {
  bookmarks: bookmarksApi,
  collections: collectionsApi,
  tags: tagsApi,
  user: userApi,
};
