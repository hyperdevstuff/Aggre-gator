export type Bookmark = {
  id: string;
  title: string;
  url: string;
  description?: string | null;
  note?: string | null;
  cover?: string | null;
  collectionIds: string[];
  /** Set when archived; the bookmark keeps its collection. */
  archivedAt?: string | null;
  tags: { id: string; name: string; color: string | null }[];
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  domain?: string;
};

// Write endpoints accept tag names, while read endpoints return tag objects.
export type CreateBookmarkInput = {
  url: string;
  title?: string;
  description?: string;
  note?: string;
  cover?: string;
  collectionIds?: string[];
  tags?: string[];
  isFavorite?: boolean;
};
export type UpdateBookmarkInput = Partial<CreateBookmarkInput>;

export type Collection = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  count: number;
  isSystem: boolean;
  slug?: string | null;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  /** Phase 3: `private` (default) | `unlisted` (link only) | `public` (listed). */
  visibility?: CollectionVisibility;
  /** Set when the collection transitions into `public`, cleared otherwise. */
  publishedAt?: string | null;
};

export type CollectionVisibility = "private" | "unlisted" | "public";

export type CreateCollectionInput = {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  visibility?: CollectionVisibility;
};
export type UpdateCollectionInput = Omit<Partial<CreateCollectionInput>, "parentId"> & {
  /** null clears the parent and moves the collection to the top level. */
  parentId?: string | null;
};

export type Tag = {
  id: string;
  name: string;
  color?: string;
  count: number;
};

export type CreateTagInput = Omit<Tag, "id" | "count">;

export type User = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  image?: string;
  username?: string | null;
  bio?: string | null;
  plan?: string;
  createdAt: string;
};

export type BookmarkFilter = {
  collectionId?: string;
  tags?: string[];
  isFavorite?: boolean;
  archived?: boolean;
  search?: string;
};

export type SortOption =
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc"
  | "url_asc";

export type PaginationParams = {
  page?: number;
  limit?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ApiError = {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
  existingId?: string;
};

export type ShareInfo = {
  id: string;
  shareCode: string;
  isActive: boolean;
  createdAt: string;
};

/**
 * A bookmark as it appears on a public share page. Deliberately narrower than
 * `Bookmark`: the API strips `note` and `isFavorite` before serving it.
 */
export type PublicBookmark = Omit<Bookmark, "isFavorite" | "note">;

export type PublicShareResponse = {
  collection: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
  };
  sharedBy: string;
  sharedAt: string;
  bookmarks: PaginatedResponse<PublicBookmark>;
  nestedCollections: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    bookmarkCount: number;
  }>;
};

/** One entry in the public directory (`GET /u/explore`). */
export type PublicExploreEntry = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  slug: string | null;
  username: string | null;
  sharedBy: string;
  publishedAt: string | null;
  bookmarkCount: number;
};

/** One entry in the public Explore directory (`GET /share/explore`). */
export type ExploreShare = {
  code: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  /** Present once the owner has a username (phase 3); null for legacy rows. */
  username: string | null;
  slug: string | null;
  sharedBy: string;
  sharedAt: string | null;
  bookmarkCount: number;
};

export type ExploreShareResponse = PaginatedResponse<ExploreShare>;

/** A collection as it appears on a public profile or in the public directory. */
export type PublicCollection = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  slug: string | null;
  publishedAt?: string | null;
  bookmarkCount: number;
};

/** `GET /u/:username`. Deliberately excludes email, plan and verification. */
export type PublicProfile = {
  profile: {
    username: string;
    name: string;
    bio: string | null;
    avatar: string | null;
    joinedAt: string;
    stats: {
      /**
       * Follower counts are deliberately absent — the `follows` table arrives in
       * phase 5. Rendering zeros before then would be a lie.
       */
      publicCollections: number;
      publicBookmarks: number;
    };
  };
  collections: PaginatedResponse<PublicCollection>;
};

/** `GET /u/:username/:slug`, shaped to match `PublicShareResponse`. */
export type PublicCollectionPage = {
  collection: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    slug: string | null;
  };
  owner: {
    username: string;
    name: string;
    avatar: string | null;
  };
  /** The unlisted fallback URL, or null when the owner has no active share. */
  shareCode: string | null;
  bookmarks: PaginatedResponse<PublicBookmark>;
  nestedCollections: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    slug: string | null;
    bookmarkCount: number;
  }>;
};