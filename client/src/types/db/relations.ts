import { relations } from "drizzle-orm/relations";
import { user, account, bookmarks, collections, bookmarkTags, tags, session } from "./schema";

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	bookmarks: many(bookmarks),
	tags: many(tags),
	collections: many(collections),
	sessions: many(session),
}));

export const bookmarksRelations = relations(bookmarks, ({one, many}) => ({
	user: one(user, {
		fields: [bookmarks.userId],
		references: [user.id]
	}),
	collection: one(collections, {
		fields: [bookmarks.collectionId],
		references: [collections.id]
	}),
	bookmarkTags: many(bookmarkTags),
}));

export const collectionsRelations = relations(collections, ({one, many}) => ({
	bookmarks: many(bookmarks),
	user: one(user, {
		fields: [collections.userId],
		references: [user.id]
	}),
	collection: one(collections, {
		fields: [collections.parentId],
		references: [collections.id],
		relationName: "collections_parentId_collections_id"
	}),
	collections: many(collections, {
		relationName: "collections_parentId_collections_id"
	}),
}));

export const bookmarkTagsRelations = relations(bookmarkTags, ({one}) => ({
	bookmark: one(bookmarks, {
		fields: [bookmarkTags.bookmarkId],
		references: [bookmarks.id]
	}),
	tag: one(tags, {
		fields: [bookmarkTags.tagId],
		references: [tags.id]
	}),
}));

export const tagsRelations = relations(tags, ({one, many}) => ({
	bookmarkTags: many(bookmarkTags),
	user: one(user, {
		fields: [tags.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));