import { useState, type FormEvent } from "react";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { z } from "zod";
import {
  GalleryVerticalEnd,
  ArrowLeft,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ResetPasswordPage,
});

export default function ResetPasswordPage() {
  const { token, error: urlError } = Route.useSearch();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      if (!token) throw new Error("Missing reset token");
      const response = await authClient.resetPassword({
        newPassword,
        token,
      });
      if (response.error) {
        throw new Error(
          response.error.message || "Unable to reset password",
        );
      }
      return response.data;
    },
    onSuccess: () => {
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 3000);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to reset password. The link may have expired.";
      setFormError(message);
      toast.error(message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newPassword = (formData.get("newPassword") || "").toString();
    const confirmPassword = (
      formData.get("confirmPassword") || ""
    ).toString();

    if (!newPassword) {
      setFormError("Please enter a new password");
      return;
    }

    if (newPassword.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("Passwords don't match");
      return;
    }

    setFormError(null);
    resetMutation.mutate(newPassword);
  };

  // Error state — invalid/expired token
  if (urlError === "INVALID_TOKEN" || (!token && !urlError)) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <a href="/" className="flex items-center gap-2 font-medium">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-4" />
              </div>
              Aggregator
            </a>
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Invalid or expired link</h1>
            <p className="text-muted-foreground text-sm text-balance">
              This password reset link is invalid or has expired. Please
              request a new one.
            </p>
            <Link to="/forgot-password">
              <Button className="mt-2">Request new reset link</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 size-4" />
                Back to login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <a href="/" className="flex items-center gap-2 font-medium">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-4" />
              </div>
              Aggregator
            </a>
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Password reset!</h1>
            <p className="text-muted-foreground text-sm text-balance">
              Your password has been reset successfully. Redirecting to
              login...
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-2">
                <ArrowLeft className="mr-2 size-4" />
                Go to login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Aggregator
          </a>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <FieldGroup>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-2">
                <KeyRound className="size-6 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-bold">Set new password</h1>
              <p className="text-muted-foreground text-sm text-balance">
                Enter your new password below.
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={resetMutation.isPending}
                required
                minLength={8}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">
                Confirm Password
              </FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={resetMutation.isPending}
                required
                minLength={8}
              />
            </Field>
            {formError ? (
              <FieldDescription
                className="text-sm text-destructive"
                role="alert"
              >
                {formError}
              </FieldDescription>
            ) : null}
            <Field>
              <Button type="submit" disabled={resetMutation.isPending}>
                {resetMutation.isPending
                  ? "Resetting password..."
                  : "Reset password"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
