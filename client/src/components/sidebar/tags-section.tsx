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
  Tag as TagIcon,
  MoreVertical,
  Plus,
  Loader2,
  Edit,
  Trash2,
} from "lucide-react";
import { useDeleteTag } from "@/hooks/use-mutations";
import { TagDialog } from "@/components/tag-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useState } from "react";
import type { Tag } from "@/types";

type TagsSectionProps = {
  tags: Tag[];
  isLoading: boolean;
};

export function TagsSection({ tags, isLoading }: TagsSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel>
          <div className="-mr-2 flex w-full items-center justify-between group/label rounded-md transition-colors hover:bg-sidebar-accent ">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 py-1.5">
              <span className="font-light text-sm">Tags</span>
            </CollapsibleTrigger>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon"
                    aria-label="Tag options"
                    variant="ghost"
                    className="size-7 shrink-0 transition-opacity duration-150 after:absolute after:-inset-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/label:opacity-100 [@media(hover:hover)]:group-focus-within/label:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                  />
                }
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New tag
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarGroupLabel>

        <TagDialog open={createOpen} onOpenChange={setCreateOpen} />

        <CollapsibleContent>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-2"></p>
            ) : (
              <SidebarMenu>
                {tags.map((tag) => (
                  <TagItem key={tag.id} tag={tag} />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function TagItem({ tag }: { tag: Tag }) {
  const search = useSearch({ from: "/_protected/dashboard" });
  const active = search.tags?.includes(tag.id) ?? false;
  const deleteTag = useDeleteTag();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = () => {
    deleteTag.mutate(tag.id);
  };

  return (
    <SidebarMenuItem>
      <div className="flex items-center group/item">
        <SidebarMenuButton
          className="flex-1"
          isActive={active}
          render={
            <Link
              to="/dashboard"
              search={{ tags: [tag.id] }}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-2"
            />
          }
        >
          <TagIcon
            className="size-4 shrink-0"
            style={{ color: tag.color || undefined }}
          />
          <span className="flex-1 truncate">{tag.name}</span>
        </SidebarMenuButton>

        <span className="relative ml-1 flex h-7 shrink-0 items-center justify-center gap-1 [@media(hover:hover)]:w-7 [@media(hover:hover)]:gap-0">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums transition-opacity duration-150 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-0 [@media(hover:hover)]:group-hover/item:opacity-0 [@media(hover:hover)]:group-focus-within/item:opacity-0">
            {tag.count}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Options for tag ${tag.name}`}
                  className="size-7 shrink-0 opacity-100 transition-opacity duration-150 after:absolute after:-inset-2 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-0 [@media(hover:hover)]:m-auto [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:opacity-100 [@media(hover:hover)]:group-focus-within/item:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteTag.isPending}
            >
              {deleteTag.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      <TagDialog tag={tag} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete tag "${tag.name}"?`}
        description="The tag is removed from all bookmarks. This cannot be undone."
        onConfirm={handleDelete}
      />
    </SidebarMenuItem>
  );
}
