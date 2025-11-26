import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Bookmark,
  ChevronDown,
  Container,
  FolderOpenDot,
  Trash,
} from "lucide-react";
import { Collapsible, CollapsibleTrigger } from "./ui/collapsible";

const items = [
  {
    title: "Not sorted",
    url: "/collections/not-sorted",
    icon: FolderOpenDot,
  },
  {
    title: "Trash",
    url: "/collections/trash",
    icon: Trash,
  },
  {
    title: "Collections",
    icon: Container,
    items: [
      {
        title: "Bootmark 1",
        url: "/bookmarks?sort=dateCreated",
        icon: Bookmark,
      },
      {
        title: "Bootmark 2",
        url: "/bookmarks?sort=dateCreated",
        icon: Bookmark,
      },
      {
        title: "Bootmark 3",
        url: "/bookmarks?sort=dateCreated",
        icon: Bookmark,
      },
    ],
  },
];
export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>Aggregator</SidebarHeader>
      <SidebarContent>
        <SidebarGroup />
        <SidebarGroupLabel>Something</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
        <SidebarGroup />
      </SidebarContent>
      <SidebarRail></SidebarRail>
      {/*-------*/}
      <Collapsible defaultOpen className="group/collapsible">
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger>
              Help
              <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          {/*<CollapsibleContent>
            <SidebarGroupContent />
          </CollapsibleContent>*/}
        </SidebarGroup>
      </Collapsible>
      <SidebarFooter />
    </Sidebar>
  );
}
