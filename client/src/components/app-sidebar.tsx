import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SidebarFooter as AccountMenu } from "@/components/sidebar/footer";
import { Logo } from "@/components/ui/logo";
import { Link } from "@tanstack/react-router";
import { useCollections, useTags } from "@/hooks/queries";
import { useAuth } from "@/hooks/use-auth";
import { SystemItems } from "./sidebar/system-items";
import { CollectionsSection } from "./sidebar/collections-section";
import { TagsSection } from "./sidebar/tags-section";

const SYSTEM_ORDER = ["unsorted", "archived"];

export function AppSidebar() {
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const { session } = useAuth();

  const systemCollections =
    collections
      ?.filter((c) => c.isSystem)
      .sort((a, b) => SYSTEM_ORDER.indexOf(a.name.toLowerCase()) - SYSTEM_ORDER.indexOf(b.name.toLowerCase())) || [];
  const userCollections =
    collections?.filter((c) => !c.isSystem).sort((a, b) => a.name.localeCompare(b.name)) || [];
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/dashboard" search={{ page: 1 }} aria-label="Aggregator home" />}
            >
              <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Logo className="size-6" />
              </span>
              <span className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Aggregator</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
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
