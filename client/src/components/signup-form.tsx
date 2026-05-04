import { useState, type ComponentProps, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type SignupFormValues = {
  name: string;
  email: string;
  password: string;
};

type SignupFormProps = ComponentProps<"form"> & {
  onSuccess?: () => void;
  redirectUrl?: string;
};

export function SignupForm({
  className,
  onSuccess,
  redirectUrl,
  ...props
}: SignupFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const signupMutation = useMutation({
    mutationFn: async (values: SignupFormValues) => {
      const response = await authClient.signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
        callbackURL: redirectUrl || "/dashboard",
      });
      if (response.error) {
        throw new Error(response.error.message || "Unable to create account");
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("Account created! Welcome aboard 🎉");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create account right now. Please try again.";
      setFormError(message);
      toast.error(message);
    },
  });

  const socialSignIn = useMutation({
    mutationFn: async (provider: "google") => {
      const response = await authClient.signIn.social({
        provider,
        callbackURL: getCallbackURL(redirectUrl),
      });
      if (response.error) {
        throw new Error(
          response.error.message || "Unable to sign up with Google",
        );
      }
      return response.data;
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start Google sign up. Please try again.";
      setFormError(message);
      toast.error(message);
    },
  });

  const isSubmitting = signupMutation.isPending || socialSignIn.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = (formData.get("name") || "").toString().trim();
    const email = (formData.get("email") || "").toString().trim();
    const password = (formData.get("password") || "").toString();
    const confirmPassword = (formData.get("confirmPassword") || "").toString();

    if (!name || !email || !password) {
      setFormError("All fields are required");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords don't match");
      return;
    }

    setFormError(null);
    signupMutation.mutate({ name, email, password });
  };

  const handleGoogleSignIn = () => {
    setFormError(null);
    socialSignIn.mutate("google");
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your details below to get started
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            autoComplete="name"
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            disabled={isSubmitting}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            disabled={isSubmitting}
            required
            minLength={8}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            disabled={isSubmitting}
            required
            minLength={8}
          />
        </Field>
        {formError ? (
          <FieldDescription className="text-sm text-destructive" role="alert">
            {formError}
          </FieldDescription>
        ) : null}
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && !socialSignIn.isPending
              ? "Creating account..."
              : "Sign up"}
          </Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            {socialSignIn.isPending ? "Redirecting..." : "Sign up with Google"}
          </Button>
          <FieldDescription className="text-center">
            Already have an account?{" "}
            <Link to="/login" className="underline underline-offset-4">
              Log in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}

function getCallbackURL(redirectUrl?: string) {
  if (typeof window === "undefined") return redirectUrl || "/dashboard";
  const fallback = new URL("/dashboard", window.location.origin).href;
  if (!redirectUrl) return fallback;
  try {
    return new URL(redirectUrl, window.location.origin).href;
  } catch {
    return fallback;
  }
}
