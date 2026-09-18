import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  if (!session?.user) {
    return (
      <SidebarMenuButton>
        <User2 className="h-4 w-4" />
        <span>Loading…</span>
      </SidebarMenuButton>
    );
  }

  const initials =
    session.user.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || "?";

  // Plan comes from the paywall epic (#18) — defaults to Free until user.plan exists.
  const plan = (session.user as { plan?: string }).plan ?? "Free";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" />
        }
      >
        <Avatar className="h-6 w-6">
          <AvatarImage src={session.user.image || ""} alt={session.user.name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate">{session.user.name}</span>
        <ChevronUp className="ml-auto h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuLabel>
          <span className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={session.user.image || ""} alt={session.user.name} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate font-medium">{session.user.name}</span>
              <Badge variant="secondary" className="w-fit text-xs capitalize">{plan}</Badge>
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Settings className="h-4 w-4 mr-2" />
          Settings
          <span className="ml-auto text-xs text-muted-foreground">Soon</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
