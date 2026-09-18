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
import { AnimatedLogo } from "@/components/ui/animated-logo";
import { Link } from "@tanstack/react-router";
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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/dashboard" search={{ page: 1 }} aria-label="Aggre-gator home" />}
            >
              <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <AnimatedLogo className="size-8 max-w-none" />
              </span>
              <span className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Aggre-gator</span>
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
