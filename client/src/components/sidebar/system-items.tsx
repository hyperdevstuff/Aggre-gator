import { Link } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { FolderOpen, FolderArchive, FolderHeart } from "lucide-react";
import type { Collection } from "@/types";

type SystemItemsProps = {
  collections: Collection[];
};

export function SystemItems({ collections }: SystemItemsProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {collections.map((col) => (
            <SidebarMenuItem key={col.id}>
              <SidebarMenuButton
                render={
                  <Link to="/dashboard" search={{ collectionId: col.id }} />
                }
              >
                {col.name.toLowerCase() === "unsorted" ? (
                  <FolderOpen />
                ) : (
                  <FolderArchive />
                )}
                <span className="capitalize">{col.name}</span>
                <SidebarMenuBadge className="ml-auto">
                  {col.count}
                </SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/dashboard" search={{ isFavorite: true }} />}
            >
              <FolderHeart className="text-pink-600" />
              <span>favorites</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
