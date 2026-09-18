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
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RowActions } from "./row-actions";
import { Tag as TagIcon, Plus, Loader2, Edit, Trash2 } from "lucide-react";
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
        <SidebarGroupLabel className="group/label flex items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1">
            <span className="font-light text-sm">Tags</span>
          </CollapsibleTrigger>

          <RowActions group="label" label="Tag options">
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New tag
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </RowActions>
        </SidebarGroupLabel>

        <TagDialog open={createOpen} onOpenChange={setCreateOpen} />

        <CollapsibleContent>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-2">
                No tags
              </p>
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
    <SidebarMenuItem className="group/item flex items-center">
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

      <RowActions
        group="item"
        label={`Options for tag ${tag.name}`}
        badge={tag.count}
      >
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteTag.isPending}
            >
              {deleteTag.isPending ? (
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
