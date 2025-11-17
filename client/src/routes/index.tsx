import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    throw redirect({ to: session ? "/dashboard" : "/login" });
  },
});
