yeah backend changes needed. here's the plan:

## 1. schema changes

```sql
-- add is_system flag to collections table
ALTER TABLE collections ADD COLUMN is_system BOOLEAN DEFAULT FALSE;

-- mark existing system collections if any
UPDATE collections SET is_system = TRUE WHERE name IN ('unsorted', 'archive');
```

## 2. user signup hook

```typescript
// in your better-auth setup or user creation logic
async function createDefaultCollections(userId: string) {
  await db.collections.createMany({
    data: [
      {
        userId,
        name: 'unsorted',
        icon: 'folder',
        description: 'default collection for new bookmarks',
        isSystem: true,
      },
      {
        userId,
        name: 'archive',
        icon: 'archive',
        description: 'archived bookmarks',
        isSystem: true,
      },
    ],
  });
}

// call after user is created
await createDefaultCollections(newUser.id);
```

## 3. bookmark creation logic

```typescript
// POST /bookmarks handler
async function createBookmark(userId: string, data: CreateBookmarkInput) {
  // if no collectionId provided, find unsorted
  if (!data.collectionId) {
    const unsorted = await db.collections.findFirst({
      where: { userId, name: 'unsorted', isSystem: true },
    });
    
    if (!unsorted) {
      throw new Error('unsorted collection not found - user setup incomplete');
    }
    
    data.collectionId = unsorted.id;
  }
  
  // ... rest of bookmark creation
}
```

## 4. prevent system collection deletion

```typescript
// DELETE /collections/:id handler
async function deleteCollection(userId: string, collectionId: string) {
  const collection = await db.collections.findFirst({
    where: { id: collectionId, userId },
  });
  
  if (!collection) {
    throw new NotFoundError('collection not found');
  }
  
  if (collection.isSystem) {
    throw new ForbiddenError('cannot delete system collections');
  }
  
  // ... rest of deletion logic
}

// PATCH /collections/:id handler - also block name changes for system collections
if (collection.isSystem && data.name && data.name !== collection.name) {
  throw new ForbiddenError('cannot rename system collections');
}
```

## 5. migration for existing users

```typescript
// run once script or migration
async function migrateExistingUsers() {
  const users = await db.users.findMany();
  
  for (const user of users) {
    // check if user already has unsorted
    const existing = await db.collections.findFirst({
      where: { userId: user.id, name: 'unsorted' },
    });
    
    if (!existing) {
      await createDefaultCollections(user.id);
    }
  }
  
  // move orphaned bookmarks to unsorted
  await db.bookmarks.updateMany({
    where: { collectionId: null },
    data: { 
      collectionId: db.collections.findFirst({
        where: { userId: user.id, name: 'unsorted' },
        select: { id: true },
      }),
    },
  });
}
```

## 6. update types

```typescript
// types/index.ts
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
  isSystem?: boolean; // ADD THIS
};
```

## execution order

1. **schema migration** - add `is_system` column
2. **update collection creation** - add default collections on signup
3. **run migration script** - create defaults for existing users
4. **update bookmark creation** - auto-assign to unsorted
5. **add deletion guards** - prevent system collection deletion
6. **update frontend types** - add `isSystem` field

## frontend changes (minimal)

```tsx
// in collection dropdown menu
{!collection.isSystem && (
  <>
    <DropdownMenuItem onClick={onEdit}>rename</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive" onClick={onDelete}>
      delete
    </DropdownMenuItem>
  </>
)}

// maybe add visual indicator
{collection.isSystem && (
  <Badge variant="secondary" className="ml-2 text-xs">system</Badge>
)}
```

## testing checklist

- [ ] new user signup → has unsorted + archive
- [ ] create bookmark w/o collection → goes to unsorted
- [ ] try delete system collection → 403 error
- [ ] try rename system collection → 403 error
- [ ] regular collections → can edit/delete normally
- [ ] existing users → migration added defaults

this is 1-2 hours backend work max. schema change + hook + guards. don't overthink it.

want me to write the actual drizzle/prisma migration or you got it from here?
