import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { Session } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { ChevronUp, LogOut, Settings, User2 } from "lucide-react";
import { toast } from "sonner";

type SidebarFooterProps = {
  session: Session;
};

export function SidebarFooter({ session }: SidebarFooterProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut();
    toast.success("signed out");
    navigate({ to: "/login" });
  };

  if (!session?.user) {
    return (
      <SidebarMenuButton>
        <User2 className="h-4 w-4" />
        <span>loading...</span>
      </SidebarMenuButton>
    );
  }

  const initials =
    session.user.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <Avatar className="h-6 w-6">
            <AvatarImage
              src={session.user.image || ""}
              alt={session.user.name}
            />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate">{session.user.name}</span>
          <ChevronUp className="ml-auto h-4 w-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        className="w-[--radix-popper-anchor-width]"
      >
        <DropdownMenuItem>
          <Settings className="h-4 w-4 mr-2" />
          settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
