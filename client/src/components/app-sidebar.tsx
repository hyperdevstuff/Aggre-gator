import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SidebarFooter as AccountMenu } from "@/components/sidebar/footer";
import { useCollections, useTags } from "@/hooks/queries";
import { useAuth } from "@/hooks/use-auth";
import { SystemItems } from "./sidebar/system-items";
import { CollectionsSection } from "./sidebar/collections-section";
import { TagsSection } from "./sidebar/tags-section";

export function AppSidebar() {
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const { session } = useAuth();

  const systemCollections = collections?.filter((c) => c.isSystem) || [];
  const userCollections = collections?.filter((c) => !c.isSystem) || [];
  return (
    <Sidebar variant="inset">
      <SidebarContent>
        <SystemItems collections={systemCollections} />
        <CollectionsSection
          collections={userCollections}
          isLoading={collectionsLoading}
        />
        <TagsSection tags={tags || []} isLoading={tagsLoading} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountMenu session={session} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
