import { Link } from "@tanstack/react-router";
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
  Settings,
  Loader2,
  Edit,
  Trash2,
} from "lucide-react";
import { useDeleteTag } from "@/hooks/use-mutations";
import type { Tag } from "@/types";

type TagsSectionProps = {
  tags: Tag[];
  isLoading: boolean;
};

export function TagsSection({ tags, isLoading }: TagsSectionProps) {
  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <div className="flex items-center justify-between group/label rounded-md transition-colors hover:bg-sidebar-accent">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 py-1.5">
              <span className="font-light text-sm">tags</span>
            </CollapsibleTrigger>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover/label:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Plus className="h-4 w-4 mr-2" />
                  new tag
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  manage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-2">no tags</p>
            ) : (
              <SidebarMenu>
                {tags.slice(0, 10).map((tag) => (
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
  const deleteTag = useDeleteTag();

  const handleDelete = () => {
    if (confirm(`delete tag "${tag.name}"?`)) {
      deleteTag.mutate(tag.id);
    }
  };

  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-2 group/item rounded-md hover:bg-sidebar-accent transition-colors">
        <SidebarMenuButton asChild className="flex-1 hover:bg-transparent">
          <Link
            to="/dashboard"
            search={{ tags: [tag.id] }}
            className="flex items-center gap-2"
          >
            <TagIcon
              className="h-3 w-3"
              style={{ color: tag.color || undefined }}
            />
            <span className="flex-1 truncate">{tag.name}</span>
          </Link>
        </SidebarMenuButton>

        <SidebarMenuBadge className="bg-transparent">
          {tag.count}
        </SidebarMenuBadge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-transparent"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
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
    </SidebarMenuItem>
  );
}
