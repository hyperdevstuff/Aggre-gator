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
  FolderIcon,
  MoreVertical,
  Plus,
  Settings,
  Edit,
  Loader2,
  Trash2,
} from "lucide-react";
import { useDeleteCollection } from "@/hooks/use-mutations";
import type { Collection } from "@/types";

type CollectionsSectionProps = {
  collections: Collection[];
  isLoading: boolean;
};

export function CollectionsSection({
  collections,
  isLoading,
}: CollectionsSectionProps) {
  return (
    <Collapsible defaultOpen>
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
              <span className="font-semibold text-sm">collections</span>
            </CollapsibleTrigger>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Plus className="h-4 w-4 mr-2" />
                  new collection
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
            ) : collections.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-2">
                no collections yet
              </p>
            ) : (
              <SidebarMenu>
                {collections.map((col) => (
                  <CollectionItem key={col.id} collection={col} />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

// COLLECTION ITEM w/ hover actions
function CollectionItem({ collection }: { collection: Collection }) {
  const deleteCollection = useDeleteCollection();

  const handleDelete = () => {
    if (confirm(`delete "${collection.name}"?`)) {
      deleteCollection.mutate(collection.id);
    }
  };

  return (
    <SidebarMenuItem>
      <div className="flex items-center group/item">
        <SidebarMenuButton asChild className="flex-1">
          <Link
            to="/dashboard"
            search={{ collectionId: collection.id }}
            className="flex items-center gap-2"
          >
            {collection.icon ? (
              <span className="text-sm">{collection.icon}</span>
            ) : (
              <FolderIcon
                className="h-4 w-4"
                style={{ color: collection.color || undefined }}
              />
            )}
            <span className="flex-1 truncate">{collection.name}</span>
            <SidebarMenuBadge>{collection.count}</SidebarMenuBadge>
          </Link>
        </SidebarMenuButton>

        {/* ACTIONS DROPDOWN */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity"
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
      </div>
    </SidebarMenuItem>
  );
}
