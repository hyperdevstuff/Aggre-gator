import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();

    if (!session.data) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <>
      <SidebarProvider defaultOpen={!useIsMobile()}>
        <AppSidebar />
        <main>
          <SidebarTrigger hidden={!useIsMobile()} />
          {/*I don't need sidebar toggle for lg md only mobile which takes over entire screen*/}
          {/*TODO: fix trigger for responsive layouto*/}
          {/*Fix: shadcn useSidebar hook*/}
          <Outlet />
          <Toaster />
        </main>
      </SidebarProvider>
    </>
  );
}
