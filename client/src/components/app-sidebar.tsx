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
import { Separator } from "@/components/ui/separator";
import { Link } from "@tanstack/react-router";
import { useCollections, useTags } from "@/hooks/queries";
import { useAuth } from "@/hooks/use-auth";
import { SystemItems } from "./sidebar/system-items";
import { CollectionsSection } from "./sidebar/collections-section";
import { TagsSection } from "./sidebar/tags-section";
import { Plus } from "lucide-react";
import { motion } from "motion/react";

const SYSTEM_ORDER = ["unsorted", "archived"];

export function AppSidebar() {
  const { data: collections, isLoading: collectionsLoading } = useCollections();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const { session } = useAuth();

  const systemCollections =
    collections
      ?.filter((c) => c.isSystem)
      .sort(
        (a, b) =>
          SYSTEM_ORDER.indexOf((a.slug ?? a.name).toLowerCase()) -
          SYSTEM_ORDER.indexOf((b.slug ?? b.name).toLowerCase()),
      ) || [];
  const userCollections = collections?.filter((c) => !c.isSystem) || [];

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link
                  to="/dashboard"
                  search={{ page: 1 }}
                  aria-label="Aggregator home"
                />
              }
              className="group"
            >
              <motion.span
                className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Logo className="size-6" />
              </motion.span>
              <div className="flex flex-col">
                <span className="font-bold tracking-tight">Aggregator</span>
                <span className="text-xs text-muted-foreground">
                  Link curator
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Quick Actions */}
        <SidebarMenu className="px-2 py-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link to="/dashboard" search={{}} className="flex items-center gap-2" />
              }
              className="h-9 rounded-lg"
            >
              <Plus className="size-4" />
              <span className="text-sm">All Bookmarks</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <Separator className="mx-4" />

        <SystemItems collections={systemCollections} />

        <Separator className="mx-4" />

        <CollectionsSection
          collections={userCollections}
          isLoading={collectionsLoading}
        />

        <Separator className="mx-4" />

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
