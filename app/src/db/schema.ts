import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** A collection is private by default; unlisted is link-only; public is listed. */
export type CollectionVisibility = "private" | "unlisted" | "public";

// AUTO-GEN
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    username: text("username"),
    bio: text("bio"),
    avatar: text("avatar"),
    plan: text("plan").notNull().default("free"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => ({
    // Case-insensitive uniqueness; usernames are for public URLs, so "Alice"
    // and "alice" must not both exist.
    usernameUnique: uniqueIndex("user_username_unique")
      .on(sql`lower(${table.username})`)
      .where(sql`${table.username} is not null`),
  }),
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
// AUTO-GEN OVER
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    note: text("note"),
    cover: text("cover"),
    domain: text("domain"),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("bookmarks_user_id_idx").on(table.userId),
    urlIdx: index("bookmarks_url_idx").on(table.url),
    domainIdx: index("bookmarks_domain_idx").on(table.domain),
    createdAtIdx: index("bookmarks_created_at_idx").on(table.createdAt),
    userUrlUnique: uniqueIndex("bookmarks_user_url_unique").on(
      table.userId,
      table.url,
    ),
  }),
);

export const collections = pgTable(
  "collections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    parentId: text("parent_id").references((): any => collections.id, {
      onDelete: "set null",
    }),
    isSystem: boolean("is_system").notNull().default(false),
    slug: text("slug"),
    visibility: text("visibility")
      .$type<CollectionVisibility>()
      .notNull()
      .default("private"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("collections_user_id_idx").on(table.userId),
    userNameUnique: uniqueIndex("collections_user_name_unique").on(
      table.userId,
      table.name,
    ),
    systemSlugUnique: uniqueIndex("collections_system_slug_unique")
      .on(table.userId, table.slug)
      .where(sql`${table.isSystem} = true`),
    // User-assigned slugs must be unique per owner (system slugs are covered above).
    userSlugUnique: uniqueIndex("collections_user_slug_unique")
      .on(table.userId, table.slug)
      .where(sql`${table.isSystem} = false and ${table.slug} is not null`),
    collectionsSlugIdx: index("collections_slug_idx").on(table.slug),
  }),
);

export const tags = pgTable(
  "tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("tags_user_id_idx").on(table.userId),
    userNameUnique: uniqueIndex("tags_user_name_unique").on(
      table.userId,
      table.name,
    ),
  }),
);

export const bookmarkTags = pgTable(
  "bookmark_tags",
  {
    bookmarkId: text("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: uniqueIndex("bookmark_tags_pk").on(table.bookmarkId, table.tagId),
  }),
);

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    bookmarkId: text("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: uniqueIndex("collection_items_pk").on(
      table.collectionId,
      table.bookmarkId,
    ),
    bookmarkIdIdx: index("collection_items_bookmark_id_idx").on(
      table.bookmarkId,
    ),
    collectionPositionIdx: index("collection_items_collection_position_idx").on(
      table.collectionId,
      table.position,
    ),
  }),
);

export const sharedCollections = pgTable(
  "shared_collections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    shareCode: text("share_code").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    shareCodeIdx: uniqueIndex("shared_collections_share_code_idx").on(
      table.shareCode,
    ),
    collectionUserIdx: uniqueIndex(
      "shared_collections_collection_user_idx",
    ).on(table.collectionId, table.userId),
    userIdx: index("shared_collections_user_idx").on(table.userId),
  }),
);

// RELATIONS
export const userRelations = relations(user, ({ many }) => ({
  bookmarks: many(bookmarks),
  collections: many(collections),
  tags: many(tags),
}));

export const bookmarksRelations = relations(bookmarks, ({ one, many }) => ({
  user: one(user, {
    fields: [bookmarks.userId],
    references: [user.id],
  }),
  bookmarkTags: many(bookmarkTags),
  collectionItems: many(collectionItems),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(user, {
    fields: [collections.userId],
    references: [user.id],
  }),
  parent: one(collections, {
    fields: [collections.parentId],
    references: [collections.id],
    relationName: "nested_collections",
  }),
  children: many(collections, {
    relationName: "nested_collections",
  }),
  items: many(collectionItems),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(user, {
    fields: [tags.userId],
    references: [user.id],
  }),
  bookmarkTags: many(bookmarkTags),
}));

export const bookmarkTagsRelations = relations(bookmarkTags, ({ one }) => ({
  bookmark: one(bookmarks, {
    fields: [bookmarkTags.bookmarkId],
    references: [bookmarks.id],
  }),
  tag: one(tags, {
    fields: [bookmarkTags.tagId],
    references: [tags.id],
  }),
}));

export const collectionItemsRelations = relations(
  collectionItems,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionItems.collectionId],
      references: [collections.id],
    }),
    bookmark: one(bookmarks, {
      fields: [collectionItems.bookmarkId],
      references: [bookmarks.id],
    }),
  }),
);

export const sharedCollectionsRelations = relations(
  sharedCollections,
  ({ one }) => ({
    user: one(user, {
      fields: [sharedCollections.userId],
      references: [user.id],
    }),
    collection: one(collections, {
      fields: [sharedCollections.collectionId],
      references: [collections.id],
    }),
  }),
);
