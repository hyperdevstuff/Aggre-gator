import { Link, useSearch } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  FolderIcon,
  MoreVertical,
  Plus,
  Edit,
  Loader2,
  Trash2,
  Share2,
} from "lucide-react";
import { useDeleteCollection } from "@/hooks/use-mutations";
import { CollectionDialog } from "@/components/collection-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { MAX_COLLECTION_DEPTH, collectionDepth } from "#shared/collection-tree";
import { useState, useMemo } from "react";
import type { Collection } from "@/types";

type CollectionsSectionProps = {
  collections: Collection[];
  isLoading: boolean;
};

export function CollectionsSection({
  collections,
  isLoading,
}: CollectionsSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  // Full tree so depth checks in item menus see ancestors, not just one node.
  const nodes = useMemo(
    () => collections.map((c) => ({ id: c.id, parentId: c.parentId, isSystem: c.isSystem })),
    [collections],
  );

  return (
    <Collapsible defaultOpen>
      <SidebarGroup>
        <SidebarGroupLabel>
          <div className="flex items-center justify-between group/label rounded-md transition-colors hover:bg-sidebar-accent">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 py-1.5">
              <span className="text-sm font-light">Collections</span>
            </CollapsibleTrigger>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label="Collection options" />}>
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  new collection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarGroupLabel>

        <CollectionDialog open={createOpen} onOpenChange={setCreateOpen} />

        <CollapsibleContent>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : collections.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-2">
                {" "}
                no collections
              </p>
            ) : (
              <SidebarMenu className="relative">
                <div className="absolute left-3 top-0 bottom-3 w-px bg-border"></div>
                {collections.map((col, idx) => (
                  <CollectionItem
                    key={col.id}
                    collection={col}
                    nodes={nodes}
                    isLast={idx === collections.length - 1}
                  />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function CollectionItem({
  collection,
  nodes,
  isLast,
}: {
  collection: Collection;
  nodes: { id: string; parentId?: string; isSystem?: boolean }[];
  isLast: boolean;
}) {
  const search = useSearch({ from: "/_protected/dashboard" });
  const active = search.collectionId === collection.id;
  const deleteCollection = useDeleteCollection();
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const atMaxDepth = collectionDepth(collection.id, nodes) >= MAX_COLLECTION_DEPTH;

  const handleDelete = () => {
    if (confirm(`delete "${collection.name}"?`)) {
      deleteCollection.mutate(collection.id);
    }
  };

  return (
    <SidebarMenuItem className="relative">
      <div className="flex items-center group/item" />
      {!isLast && (
        <div className="absolute left-3 top-3 bottom-0 w-px bg-border" />
      )}
      <div className="flex items-center group/item ml-6">
        <SidebarMenuButton
          className="flex-1"
          isActive={active}
          render={
            <Link
              to="/dashboard"
              search={{ collectionId: collection.id }}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2"
            />
          }
        >
          {collection.icon ? (
            <span className="text-sm">{collection.icon}</span>
          ) : (
            <FolderIcon
              className="h-4 w-4 shrink-0"
              style={{ color: collection.color || undefined }}
            />
          )}
          <span className="flex-1 truncate">{collection.name}</span>
        </SidebarMenuButton>

        <span className="relative ml-1 flex h-7 shrink-0 items-center justify-center gap-1 [@media(hover:hover)]:w-7 [@media(hover:hover)]:gap-0">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums transition-opacity duration-150 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-0 [@media(hover:hover)]:group-hover/item:opacity-0 [@media(hover:hover)]:group-focus-within/item:opacity-0">
            {collection.count}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Options for collection ${collection.name}`}
                  className="size-7 shrink-0 opacity-100 transition-opacity duration-150 after:absolute after:-inset-2 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-0 [@media(hover:hover)]:m-auto [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:opacity-100 [@media(hover:hover)]:group-focus-within/item:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSubOpen(true)} disabled={atMaxDepth}>
              <Plus className="h-4 w-4 mr-2" />
              {atMaxDepth ? "sub-collection limit reached" : "new sub-collection"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={handleDelete}
              disabled={deleteCollection.isPending}
            >
              {deleteCollection.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  delete
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      <ShareDialog
        collection={collection}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <CollectionDialog
        collection={collection}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <CollectionDialog
        parentId={collection.id}
        open={subOpen}
        onOpenChange={setSubOpen}
      />
    </SidebarMenuItem>
  );
}
