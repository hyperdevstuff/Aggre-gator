import { Link, useSearch } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
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
          <div className="flex items-center justify-between group/label rounded-md transition-colors hover:bg-sidebar-accent ">
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
                    className="h-6 w-6 mr-1 group-hover/label:opacity-100 transition-opacity"
                  />
                }
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Tag
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

  const handleDelete = () => {
    if (confirm(`delete tag "${tag.name}"?`)) {
      deleteTag.mutate(tag.id);
    }
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
            className="h-3 w-3"
            style={{ color: tag.color || undefined }}
          />
          <span className="flex-1 truncate">{tag.name}</span>
          <SidebarMenuBadge>{tag.count}</SidebarMenuBadge>
        </SidebarMenuButton>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Options for tag ${tag.name}`}
                className="size-8"
              />
            }
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={handleDelete}
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
                  delete
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <TagDialog tag={tag} open={editOpen} onOpenChange={setEditOpen} />
    </SidebarMenuItem>
  );
}
