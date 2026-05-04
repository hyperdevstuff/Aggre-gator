import { useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { GalleryVerticalEnd, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ForgotPasswordPage,
});

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (response.error) {
        throw new Error(response.error.message || "Unable to send reset email");
      }
      return response.data;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      setFormError(message);
      toast.error(message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = (formData.get("email") || "").toString().trim();

    if (!email) {
      setFormError("Please enter your email address");
      return;
    }

    setFormError(null);
    resetMutation.mutate(email);
  };

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

        {submitted ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-muted-foreground text-sm text-balance">
              If an account with that email exists, we&apos;ve sent a password
              reset link. Check your inbox (and spam folder).
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-2">
                <ArrowLeft className="mr-2 size-4" />
                Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-2">
                  <Mail className="size-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-bold">Forgot your password?</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  Enter your email and we&apos;ll send you a link to reset your
                  password.
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  disabled={resetMutation.isPending}
                  required
                  autoFocus
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
                    ? "Sending reset link..."
                    : "Send reset link"}
                </Button>
              </Field>
              <FieldDescription className="text-center">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="underline underline-offset-4"
                >
                  Log in
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>
        )}
      </div>
    </div>
  );
}
