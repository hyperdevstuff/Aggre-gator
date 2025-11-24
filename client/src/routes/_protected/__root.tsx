import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";

export const Route = createFileRoute("/_protected/__root")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <Toaster richColors position="bottom-right" />
      <Outlet />
    </div>
  );
}
