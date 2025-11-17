import {
  pgTable,
  check,
  text,
  timestamp,
  unique,
  boolean,
  foreignKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (table) => [
    check("verification_id_not_null", sql`NOT NULL id`),
    check("verification_identifier_not_null", sql`NOT NULL identifier`),
    check("verification_value_not_null", sql`NOT NULL value`),
    check("verification_expires_at_not_null", sql`NOT NULL expires_at`),
    check("verification_created_at_not_null", sql`NOT NULL created_at`),
    check("verification_updated_at_not_null", sql`NOT NULL updated_at`),
  ],
);

export const user = pgTable(
  "user",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("user_email_unique").on(table.email),
    check("user_id_not_null", sql`NOT NULL id`),
    check("user_name_not_null", sql`NOT NULL name`),
    check("user_email_not_null", sql`NOT NULL email`),
    check("user_email_verified_not_null", sql`NOT NULL email_verified`),
    check("user_created_at_not_null", sql`NOT NULL created_at`),
    check("user_updated_at_not_null", sql`NOT NULL updated_at`),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "string",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "string",
    }),
    scope: text(),
    password: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_user_id_user_id_fk",
    }).onDelete("cascade"),
    check("account_id_not_null", sql`NOT NULL id`),
    check("account_account_id_not_null", sql`NOT NULL account_id`),
    check("account_provider_id_not_null", sql`NOT NULL provider_id`),
    check("account_user_id_not_null", sql`NOT NULL user_id`),
    check("account_created_at_not_null", sql`NOT NULL created_at`),
    check("account_updated_at_not_null", sql`NOT NULL updated_at`),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    url: text().notNull(),
    title: text().notNull(),
    description: text(),
    note: text(),
    cover: text(),
    domain: text(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    collectionId: text("collection_id"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("bookmarks_created_at_idx").using(
      "btree",
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("bookmarks_domain_idx").using(
      "btree",
      table.domain.asc().nullsLast().op("text_ops"),
    ),
    index("bookmarks_url_idx").using(
      "btree",
      table.url.asc().nullsLast().op("text_ops"),
    ),
    index("bookmarks_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("bookmarks_user_url_unique").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.url.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "bookmarks_user_id_user_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.collectionId],
      foreignColumns: [collections.id],
      name: "bookmarks_collection_id_collections_id_fk",
    }).onDelete("set null"),
    check("bookmarks_id_not_null", sql`NOT NULL id`),
    check("bookmarks_user_id_not_null", sql`NOT NULL user_id`),
    check("bookmarks_url_not_null", sql`NOT NULL url`),
    check("bookmarks_title_not_null", sql`NOT NULL title`),
    check("bookmarks_is_favorite_not_null", sql`NOT NULL is_favorite`),
    check("bookmarks_created_at_not_null", sql`NOT NULL created_at`),
    check("bookmarks_updated_at_not_null", sql`NOT NULL updated_at`),
  ],
);

export const bookmarkTags = pgTable(
  "bookmark_tags",
  {
    bookmarkId: text("bookmark_id").notNull(),
    tagId: text("tag_id").notNull(),
  },
  (table) => [
    uniqueIndex("bookmark_tags_pk").using(
      "btree",
      table.bookmarkId.asc().nullsLast().op("text_ops"),
      table.tagId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.bookmarkId],
      foreignColumns: [bookmarks.id],
      name: "bookmark_tags_bookmark_id_bookmarks_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tags.id],
      name: "bookmark_tags_tag_id_tags_id_fk",
    }).onDelete("cascade"),
    check("bookmark_tags_bookmark_id_not_null", sql`NOT NULL bookmark_id`),
    check("bookmark_tags_tag_id_not_null", sql`NOT NULL tag_id`),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    name: text().notNull(),
    color: text(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tags_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("tags_user_name_unique").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "tags_user_id_user_id_fk",
    }).onDelete("cascade"),
    check("tags_id_not_null", sql`NOT NULL id`),
    check("tags_user_id_not_null", sql`NOT NULL user_id`),
    check("tags_name_not_null", sql`NOT NULL name`),
    check("tags_created_at_not_null", sql`NOT NULL created_at`),
  ],
);

export const collections = pgTable(
  "collections",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    name: text().notNull(),
    description: text(),
    icon: text(),
    color: text(),
    parentId: text("parent_id"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("collections_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("collections_user_name_unique").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "collections_user_id_user_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "collections_parent_id_collections_id_fk",
    }).onDelete("set null"),
    check("collections_id_not_null", sql`NOT NULL id`),
    check("collections_user_id_not_null", sql`NOT NULL user_id`),
    check("collections_name_not_null", sql`NOT NULL name`),
    check("collections_created_at_not_null", sql`NOT NULL created_at`),
    check("collections_updated_at_not_null", sql`NOT NULL updated_at`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    token: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_user_id_user_id_fk",
    }).onDelete("cascade"),
    unique("session_token_unique").on(table.token),
    check("session_id_not_null", sql`NOT NULL id`),
    check("session_expires_at_not_null", sql`NOT NULL expires_at`),
    check("session_token_not_null", sql`NOT NULL token`),
    check("session_created_at_not_null", sql`NOT NULL created_at`),
    check("session_updated_at_not_null", sql`NOT NULL updated_at`),
    check("session_user_id_not_null", sql`NOT NULL user_id`),
  ],
);
