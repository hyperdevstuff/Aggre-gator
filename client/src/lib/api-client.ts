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
  ShareInfo,
  PublicShareResponse,
  ExploreShareResponse,
  PublicProfile,
  PublicCollectionPage,
  PublicExploreResponse,
} from "@/types";

/** Shared filter params for the two Explore directory endpoints. */
export type ExploreParams = {
  page?: number;
  limit?: number;
  q?: string;
  tag?: string;
  sort?: "new" | "top";
};

/**
 * Empty string means same-origin (the API serves the SPA in the single-process
 * deployment — see docs/DEPLOY.md); fetches then go to `/bookmarks` etc.
 * Anything else must match the proxy target in `vite.config.ts` and the API's
 * `PORT` default (3001). Defaulting to 3000 was wrong: a checkout without
 * `VITE_API_URL` set would silently talk to whatever else happened to be on 3000.
 */
const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>,
    public existingId?: string,
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
    throw new ApiError(
      res.status,
      error.message || error.error || res.statusText || "Request failed",
      error.errors,
      error.details?.existingId ?? error.existingId,
    );
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
    if (params?.archived !== undefined)
      query.set("archived", String(params.archived));
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

  bulkArchive: (ids: string[]) =>
    fetcher<{ archived: number; ids: string[] }>("/bookmarks/bulk/archive", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  bulkUnarchive: (ids: string[]) =>
    fetcher<{ unarchived: number; ids: string[] }>(
      "/bookmarks/bulk/unarchive",
      {
        method: "POST",
        body: JSON.stringify({ ids }),
      },
    ),

  move: (ids: string[], collectionIds: string[]) =>
    fetcher<void>("/bookmarks/move", {
      method: "POST",
      body: JSON.stringify({ ids, collectionIds }),
    }),
};

// === COLLECTIONS ===

export const collectionsApi = {
  list: async () => {
    const collections = await fetcher<(Omit<Collection, "count"> & { bookmarkCount: number })[]>("/collections");
    return collections.map(({ bookmarkCount, ...collection }) => ({
      ...collection,
      count: bookmarkCount,
    }));
  },

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

  update: (id: string, data: Partial<CreateTagInput>) =>
    fetcher<Tag>(`/tags/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) => fetcher<void>(`/tags/${id}`, { method: "DELETE" }),
};

// === USER ===

export const userApi = {
  me: () => fetcher<User>("/user/me"),

  update: (data: Partial<{
    name: string;
    image: string;
    username: string;
    bio: string;
    avatar: string;
  }>) =>
    fetcher<User>("/user/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /** True when `username` is unclaimed. Backed by better-auth's endpoint. */
  isUsernameAvailable: async (username: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/is-username-available`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      if (!res.ok) return true; // Don't block the user on a probe failure.
      const data = await res.json();
      return data.available === true;
    } catch {
      return true;
    }
  },
};

export const shareApi = {
  // Auth
  create: (collectionId: string) =>
    fetcher<ShareInfo>(`/collections/${collectionId}/share`, {
      method: "POST",
    }),

  get: (collectionId: string) =>
    fetcher<ShareInfo | null>(`/collections/${collectionId}/share`),

  revoke: (collectionId: string) =>
    fetcher<void>(`/collections/${collectionId}/share`, { method: "DELETE" }),

  // Public — no auth
  getPublic: (code: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    return fetcher<PublicShareResponse>(`/share/${code}?${query}`);
  },

  explore: (params?: ExploreParams) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.q) query.set("q", params.q);
    if (params?.tag) query.set("tag", params.tag);
    if (params?.sort) query.set("sort", params.sort);
    return fetcher<ExploreShareResponse>(`/share/explore?${query}`);
  },
};

// === PUBLIC PROFILES (anonymous) ===

export const publicApi = {
  profile: (username: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    return fetcher<PublicProfile>(`/u/${username}?${query}`);
  },

  collection: (
    username: string,
    slug: string,
    params?: { page?: number; limit?: number },
  ) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    return fetcher<PublicCollectionPage>(`/u/${username}/${slug}?${query}`);
  },

  explore: (params?: ExploreParams) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.q) query.set("q", params.q);
    if (params?.tag) query.set("tag", params.tag);
    if (params?.sort) query.set("sort", params.sort);
    return fetcher<PublicExploreResponse>(`/u/explore?${query}`);
  },
};

export const api = {
  bookmarks: bookmarksApi,
  collections: collectionsApi,
  tags: tagsApi,
  user: userApi,
  share: shareApi,
  public: publicApi,
};
