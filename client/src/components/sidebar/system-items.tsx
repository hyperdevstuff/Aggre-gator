import { Link, useSearch } from "@tanstack/react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Library, FolderOpen, FolderArchive, FolderHeart } from "lucide-react";
import type { Collection } from "@/types";

type SystemItemsProps = {
  collections: Collection[];
};

export function SystemItems({ collections }: SystemItemsProps) {
  const search = useSearch({ from: "/_protected/dashboard" });
  const allActive = !search.collectionId && !search.tags?.length && search.isFavorite === undefined;
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={allActive}
              render={<Link to="/dashboard" search={{ page: 1 }} aria-current={allActive ? "page" : undefined} />}
            >
              <Library />
              <span>All Bookmarks</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {collections.map((col) => (
            <SidebarMenuItem key={col.id}>
              <SidebarMenuButton
                isActive={search.collectionId === col.id}
                render={
                  <Link to="/dashboard" search={{ collectionId: col.id }} aria-current={search.collectionId === col.id ? "page" : undefined} />
                }
              >
                {col.name.toLowerCase() === "unsorted" ? (
                  <FolderOpen />
                ) : (
                  <FolderArchive />
                )}
                <span className="capitalize">{col.name}</span>
                <SidebarMenuBadge className="ml-auto tabular-nums">
                  {col.count}
                </SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={search.isFavorite === true}
              render={<Link to="/dashboard" search={{ isFavorite: true }} aria-current={search.isFavorite ? "page" : undefined} />}
            >
              <FolderHeart />
              <span>Favorites</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
