import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/queries";
import {
  useUpdateUser,
  useUsernameAvailability,
} from "@/hooks/use-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { User } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

/** Mirrors `USERNAME_PATTERN` in app/src/utils/username.ts. */
const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
/** Mirrors `RESERVED_USERNAMES` — only the ones a user would plausibly pick. */
const RESERVED = [
  "admin", "api", "explore", "login", "logout", "profile", "search",
  "settings", "share", "signup", "support", "dashboard", "collections",
];

function reservedReason(username: string): string | undefined {
  if (username.length < 3) return "Usernames need at least 3 characters.";
  if (username.length > 30) return "Usernames can be at most 30 characters.";
  if (!USERNAME_PATTERN.test(username))
    return "Use lowercase letters, numbers and underscores only.";
  if (RESERVED.includes(username)) return "That username is reserved.";
  return undefined;
}

function SettingsPage() {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading your profile…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Couldn&apos;t load your profile.
      </div>
    );
  }

  // Keyed on the user id so a different account gets fresh state, and so the
  // form is seeded by the initialiser rather than by an effect — resetting state
  // in an effect is what `react-hooks/set-state-in-effect` rejects, and it also
  // costs an extra render on every mount.
  return <ProfileForm key={user.id} user={user} />;
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateUser();

  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatar, setAvatar] = useState(user.avatar ?? "");
  const [error, setError] = useState<string | null>(null);

  const normalized = username.trim().toLowerCase();
  const formatError = reservedReason(normalized);
  const availability = useUsernameAvailability(normalized);
  const unchanged =
    name.trim() === (user.name ?? "") &&
    normalized === (user.username ?? "") &&
    bio.trim() === (user.bio ?? "") &&
    avatar.trim() === (user.avatar ?? "");
  const dirty = !unchanged;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        name: name.trim(),
        username: normalized,
        bio: bio.trim(),
        avatar: avatar.trim(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your profile.",
      );
    }
  }

  const pending = update.isPending;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your name and photo are private. Your username and bio are public —
          they appear on your profile page.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6"
        aria-busy={pending}
      >
        <fieldset disabled={pending} className="space-y-6">
          <Field>
            <FieldLabel htmlFor="settings-name">Display name</FieldLabel>
            <Input
              id="settings-name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
            <FieldDescription>
              Shown to you, and used to derive a username at sign-up.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="settings-username">Username</FieldLabel>
            <Input
              id="settings-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your-name"
              aria-invalid={!!formatError || availability.data === false}
              aria-describedby="settings-username-status"
              autoComplete="username"
              spellCheck={false}
            />
            <div
              id="settings-username-status"
              className="flex min-h-5 items-center gap-1.5 text-xs"
            >
              {formatError ? (
                <span className="text-destructive">{formatError}</span>
              ) : availability.isFetching ? (
                <span className="text-muted-foreground">Checking…</span>
              ) : availability.data === false ? (
                <span className="text-destructive">
                  That username is already taken.
                </span>
              ) : availability.data === true ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Check className="size-3.5" aria-hidden="true" />
                  Available.
                </span>
              ) : null}
            </div>
            <FieldDescription>
              This is your public URL. Letters are lower-cased for you.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="settings-bio">Bio</FieldLabel>
            <Textarea
              id="settings-bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="min-h-20"
              placeholder="A sentence or two about what you collect."
            />
            <FieldDescription>
              {bio.length}/500. Shown on your public profile.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="settings-avatar">Avatar URL</FieldLabel>
            <Input
              id="settings-avatar"
              type="url"
              value={avatar}
              onChange={(event) => setAvatar(event.target.value)}
              placeholder="https://example.com/avatar.png"
            />
            <FieldDescription>
              Leave empty to use your initials.
            </FieldDescription>
          </Field>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <Button
            type="submit"
            disabled={
              pending || !dirty || !!formatError || availability.data === false
            }
          >
            {pending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            Save changes
          </Button>
          {dirty && (
            <span className="text-xs text-muted-foreground">
              You have unsaved changes.
            </span>
          )}
        </div>
      </form>

      {user?.username && (
        <section className="mt-10 border-t pt-6">
          <h2 className="text-sm font-medium">Your public profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anyone with this link can see the collections you have published.
          </p>
          <Link
            to="/u/$username"
            params={{ username: user.username }}
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline",
            )}
          >
            /u/{user.username}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </section>
      )}
    </div>
  );
}

