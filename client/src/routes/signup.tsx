import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { SignupForm } from "@/components/signup-form";
import { authClient } from "@/lib/auth-client";
import { z } from "zod";
import { GalleryVerticalEnd } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/signup")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SignupPage,
});

export default function SignupPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const { refetch, isLoading } = useAuth();

  const handleSuccess = () => {
    refetch?.();
    router.invalidate();
    navigate({ to: redirectTo || "/dashboard" });
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Aggregator
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm onSuccess={handleSuccess} redirectUrl={redirectTo} />
            {isLoading ? (
              <p className="text-muted-foreground mt-4 text-center text-sm">
                Checking your session…
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-primary/20 to-primary/5">
          <div className="text-center space-y-4 px-8">
            <GalleryVerticalEnd className="size-16 mx-auto text-primary/40" />
            <h2 className="text-3xl font-bold text-primary/60">Aggregator</h2>
            <p className="text-muted-foreground text-lg max-w-sm">
              Organize your bookmarks, collections, and tags — all in one place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
