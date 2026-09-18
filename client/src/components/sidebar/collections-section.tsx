import { Link, useSearch } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RowActions } from "./row-actions";
import { Plus, Edit, Loader2, Trash2, Share2 } from "lucide-react";
import {
  useDeleteCollection,
  useUpdateCollection,
} from "@/hooks/use-mutations";
import { CollectionDialog } from "@/components/collection-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ShareDialog } from "@/components/share-dialog";
import {
  MAX_COLLECTION_DEPTH,
  collectionDepth,
  collectionParentError,
} from "#shared/collection-tree";
import { useState, useMemo } from "react";
import type { Collection } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import type { DragEndEvent } from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";

/** Dropping onto the group header moves a collection back to the top level. */
const ROOT_DROP_ID = "__collection_root__";

type CollectionNodeInput = {
  id: string;
  parentId?: string | null;
  isSystem?: boolean;
};

type CollectionsSectionProps = {
  collections: Collection[];
  isLoading: boolean;
};

export function CollectionsSection({
  collections,
  isLoading,
}: CollectionsSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const { state } = useSidebar();
  const disabled = state === "collapsed";
  const updateCollection = useUpdateCollection();
  const nodes = useMemo<CollectionNodeInput[]>(
    () =>
      collections.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        isSystem: c.isSystem,
      })),
    [collections],
  );

  // Depth-first order: each parent is followed by its (indented) children.
  const ordered = useMemo(() => {
    const byParent = new Map<string | null, Collection[]>();
    for (const collection of collections) {
      const key = collection.parentId ?? null;
      const siblings = byParent.get(key);
      if (siblings) siblings.push(collection);
      else byParent.set(key, [collection]);
    }
    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => a.name.localeCompare(b.name));
    }
    const out: { collection: Collection; depth: number }[] = [];
    const visited = new Set<string>();
    const walk = (parent: string | null, depth: number) => {
      for (const collection of byParent.get(parent) ?? []) {
        // Guard against a legacy cycle so the list can never loop forever.
        if (visited.has(collection.id)) continue;
        visited.add(collection.id);
        out.push({ collection, depth });
        walk(collection.id, depth + 1);
      }
    };
    walk(null, 1);
    // A collection whose parent is missing would otherwise never render.
    for (const collection of collections) {
      if (!visited.has(collection.id)) out.push({ collection, depth: 1 });
    }
    return out;
  }, [collections]);

  const { ref: rootDropRef, isDropTarget: isRootTarget } = useDroppable({
    id: ROOT_DROP_ID,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return;
    const { source, target } = event.operation;
    if (!source || !target) return;
    const movingId = String(source.id);
    const targetId = String(target.id);
    if (targetId === movingId) return;
    const parentId = targetId === ROOT_DROP_ID ? null : targetId;
    const error = collectionParentError(nodes, parentId, movingId);
    if (error) {
      toast.error(error);
      return;
    }
    const current = nodes.find((node) => node.id === movingId);
    if ((current?.parentId ?? null) === parentId) return;
    updateCollection.mutate(
      { id: movingId, data: { parentId } },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Could not move collection",
          ),
      },
    );
  };

  return (
    <DragDropProvider
      sensors={[
        PointerSensor.configure({
          activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 8 }),
          ],
        }),
        KeyboardSensor,
      ]}
      onDragEnd={handleDragEnd}
    >
      <Collapsible defaultOpen>
        <SidebarGroup>
          <SidebarGroupLabel
            ref={rootDropRef}
            className={cn(
              "group/label flex items-center justify-between",
              isRootTarget && "ring-2 ring-sidebar-ring",
            )}
          >
            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
              <span className="text-sm font-light">Collections</span>
            </CollapsibleTrigger>

            <RowActions group="label" label="Collection options">
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    New collection
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </RowActions>
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
                  No collections
                </p>
              ) : (
                <SidebarMenu>
                  {ordered.map(({ collection, depth }) => (
                    <CollectionItem
                      key={collection.id}
                      collection={collection}
                      nodes={nodes}
                      depth={depth}
                      disabled={disabled}
                    />
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      <DragOverlay>
        {(source) => {
          const dragged = collections.find((c) => c.id === String(source.id));
          if (!dragged) return null;
          return (
            <div
              aria-hidden
              className="flex items-center gap-2 rounded-md border bg-sidebar px-2 py-1.5 text-sm shadow-md"
            >
              <span
                className="size-2 rounded-full"
                style={{
                  backgroundColor:
                    dragged.color || "var(--muted-foreground)",
                }}
              />
              <span className="truncate">{dragged.name}</span>
            </div>
          );
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}

function CollectionItem({
  collection,
  nodes,
  depth,
  disabled,
}: {
  collection: Collection;
  nodes: CollectionNodeInput[];
  depth: number;
  disabled: boolean;
}) {
  const search = useSearch({ from: "/_protected/dashboard" });
  const active = search.collectionId === collection.id;
  const deleteCollection = useDeleteCollection();
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const atMaxDepth =
    collectionDepth(collection.id, nodes) >= MAX_COLLECTION_DEPTH;

  const { ref: dragRef, isDragging } = useDraggable({
    id: collection.id,
    disabled,
  });
  const { ref: dropRef, isDropTarget } = useDroppable({ id: collection.id });

  const handleDelete = () => {
    deleteCollection.mutate(collection.id);
  };

  return (
    <SidebarMenuItem
      ref={dropRef}
      style={{ paddingLeft: (depth - 1) * 12 }}
      className={cn(
        "group/item flex items-center rounded-md",
        isDropTarget && "ring-2 ring-sidebar-ring",
      )}
    >
      <SidebarMenuButton
        ref={dragRef}
        className={cn("flex-1", isDragging && "opacity-40")}
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
        {/* Color dot (Raindrop pattern) */}
        <div
          className="size-2 rounded-full"
          style={{
            backgroundColor: collection.color || "var(--muted-foreground)",
          }}
        />
        <span className="flex-1 truncate">{collection.name}</span>
      </SidebarMenuButton>

      <RowActions
        group="item"
        label={`Options for collection ${collection.name}`}
        badge={collection.count}
      >
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSubOpen(true)}
              disabled={atMaxDepth}
            >
              <Plus className="h-4 w-4 mr-2" />
              {atMaxDepth
                ? "Sub-collection limit reached"
                : "New sub-collection"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteCollection.isPending}
            >
              {deleteCollection.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </RowActions>

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
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${collection.name}"?`}
        description="Its bookmarks become unfiled but are kept. This cannot be undone."
        onConfirm={handleDelete}
      />
    </SidebarMenuItem>
  );
}
