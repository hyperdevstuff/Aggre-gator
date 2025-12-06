import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarFooter as Footer } from "@/components/sidebar/footer";
import { useCollections, useTags } from "@/hooks/queries";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { SystemItems } from "./sidebar/system-items";
import { CollectionsSection } from "./sidebar/collections-section";
import { TagsSection } from "./sidebar/tags-section";

export function AppSidebar() {
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const { session } = useAuth();

  const systemCollections = collections?.filter((c) => c.isSystem) || [];
  const userCollections = collections?.filter((c) => c.isSystem) || [];
  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 font-semibold text-lg"
        >
          aggregator
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SystemItems collections={systemCollections} />
        <CollectionsSection
          collections={userCollections}
          isLoading={collectionsLoading}
        />
        <TagsSection tags={tags || []} isLoading={tagsLoading} />
      </SidebarContent>
      <SidebarFooter />

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <Footer session={session} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
