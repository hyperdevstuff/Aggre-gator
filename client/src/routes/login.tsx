import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/auth-form";
import { authClient } from "@/lib/auth-client";
import { z } from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate({ to: redirectTo || "/dashboard" });
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AuthForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
