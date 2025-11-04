export type Bookmark = {
  id: string;
  title: string;
  url: string;
  description?: string;
  note?: string;
  collectionId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  cover?: string;
  domain?: string;
};

export type CreateBookmarkInput = Omit<
  Bookmark,
  "id" | "createdAt" | "updatedAt" | "domain"
>;
export type UpdateBookmarkInput = Partial<
  Omit<Bookmark, "id" | "createdAt" | "updatedAt">
>;

export type Collection = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  count: number;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
};

export type CreateCollectionInput = Omit<
  Collection,
  "id" | "count" | "createdAt" | "updatedAt"
>;
export type UpdateCollectionInput = Partial<
  Omit<Collection, "id" | "count" | "createdAt" | "updatedAt">
>;

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
  createdAt: string;
};

export type BookmarkFilter = {
  collectionId?: string;
  tags?: string[];
  isFavorite?: boolean;
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
};
