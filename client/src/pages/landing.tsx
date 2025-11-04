import { Search, Plus, Folder, Tag, Star, Clock, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/toogle-theme";

const collections = [
  { name: "unsorted", icon: Folder, count: 24 },
  { name: "favorites", icon: Star, count: 12 },
  { name: "reading list", icon: Clock, count: 8 },
  { name: "archive", icon: Archive, count: 156 },
];

const tags = [
  { name: "design", count: 45 },
  { name: "dev", count: 89 },
  { name: "research", count: 23 },
  { name: "inspiration", count: 34 },
];

export function LandingPage() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <div className="p-4 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">john doe</p>
                  <p className="text-xs text-muted-foreground truncate">
                    john@example.com
                  </p>
                </div>
              </div>
            </div>

            <SidebarGroup>
              <SidebarGroupLabel>collections</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {collections.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.count}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>tags</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {tags.map((tag) => (
                    <SidebarMenuItem key={tag.name}>
                      <SidebarMenuButton>
                        <Tag className="h-4 w-4" />
                        <span className="flex-1">{tag.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {tag.count}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex-1 max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="search bookmarks..."
                    className="pl-9 w-full"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  add bookmark
                </Button>
                <ModeToggle />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">all bookmarks</h1>
              <p className="text-muted-foreground">289 items</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Card
                  key={i}
                  className="group hover:shadow-md transition-shadow cursor-pointer"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-1">
                          example bookmark {i + 1}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 mt-1.5">
                          some description about this bookmark that explains
                          what it contains
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>example.com</span>
                      <span>•</span>
                      <span>2 days ago</span>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs">
                        design
                      </span>
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs">
                        ui
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
