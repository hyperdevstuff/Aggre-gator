import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useShareStatus, useUser } from "@/hooks/queries";
import {
  useShareCollection,
  useUnshareCollection,
  useUpdateCollection,
} from "@/hooks/use-mutations";
import { Check, Copy, Globe, Link2, Loader2, Lock } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Collection, CollectionVisibility } from "@/types";

type ShareDialogProps = {
  collection: Collection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Mirrors the API's SLUG_PATTERN. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const VISIBILITY_COPY: Record<
  CollectionVisibility,
  { label: string; hint: string }
> = {
  private: {
    label: "Private",
    hint: "No link. Only you can see this collection.",
  },
  unlisted: {
    label: "Unlisted",
    hint: "Anyone with the link can open it. It won't appear in Explore.",
  },
  public: {
    label: "Public",
    hint: "Anyone can open it, and it appears on your profile and in Explore.",
  },
};

export function ShareDialog({
  collection,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [unshareOpen, setUnshareOpen] = useState(false);

  const { data: shareInfo, isLoading } = useShareStatus(collection?.id || "");
  const { data: user } = useUser();
  const shareCollection = useShareCollection();
  const unshareCollection = useUnshareCollection();
  const updateCollection = useUpdateCollection();

  const visibility: CollectionVisibility = collection?.visibility ?? "private";
  const [draftVisibility, setDraftVisibility] = useState<CollectionVisibility | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  // The dialog remounts per collection via `key` in the parent, so local state
  // only needs to model "has the user touched this yet".
  const chosen = draftVisibility ?? visibility;
  const slugValue = (slug ?? collection?.slug ?? "").trim();

  const codeUrl = shareInfo?.isActive && shareInfo.shareCode
    ? `${window.location.origin}/share/${shareInfo.shareCode}`
    : null;
  const publicUrl =
    user?.username && slugValue
      ? `${window.location.origin}/u/${user.username}/${slugValue}`
      : null;

  const needsSlug = chosen === "public" && !slugValue;
  const invalidSlug =
    slugValue.length > 0 && !SLUG_PATTERN.test(slugValue);
  const pending =
    shareCollection.isPending ||
    unshareCollection.isPending ||
    updateCollection.isPending;

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  const applyVisibility = async (next: CollectionVisibility) => {
    if (!collection) return;
    setDraftVisibility(next);
    setSlugError(null);
    // A share code and visibility are independent: the code is the unlisted
    // URL, `visibility` decides whether the collection is *listed*. Creating a
    // code does not publish anything.
    if (next !== "private" && !shareInfo?.isActive) {
      shareCollection.mutate(collection.id);
    }
    if (next === "private") {
      if (shareInfo?.isActive) unshareCollection.mutate(collection.id);
      return;
    }
    try {
      await updateCollection.mutateAsync({
        id: collection.id,
        data: {
          visibility: next,
          ...(next === "public" && slugValue
            ? { slug: slugValue }
            : {}),
        },
      });
    } catch (error) {
      setSlugError(
        error instanceof Error
          ? error.message
          : "Could not change visibility.",
      );
    }
  };

  const commitSlug = async () => {
    if (!collection || !slugValue || invalidSlug) return;
    setSlugError(null);
    try {
      await updateCollection.mutateAsync({
        id: collection.id,
        data: { slug: slugValue },
      });
      setSlug(null);
    } catch (error) {
      setSlugError(
        error instanceof Error ? error.message : "Could not update the URL.",
      );
    }
  };

  const handleUnshare = () => {
    if (!collection) return;
    unshareCollection.mutate(collection.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              {chosen === "private" ? (
                <Lock className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Globe className="h-5 w-5 text-success" />
              )}
              Share “{collection?.name}”
            </span>
          </DialogTitle>
          <DialogDescription>
            Choose who can open this collection. A random link always works for
            anyone who has it; publishing also lists it.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <fieldset disabled={pending} className="space-y-2">
              <Label htmlFor="share-visibility">Visibility</Label>
              <Select
                value={chosen}
                onValueChange={(value) =>
                  applyVisibility(value as CollectionVisibility)
                }
              >
                <SelectTrigger id="share-visibility" className="w-full">
                  {VISIBILITY_COPY[chosen].label}
                </SelectTrigger>
                <SelectContent>
                  {(
                    ["private", "unlisted", "public"] as const
                  ).map((option) => (
                    <SelectItem key={option} value={option}>
                      {VISIBILITY_COPY[option].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {VISIBILITY_COPY[chosen].hint}
              </p>
              {!user?.username && chosen === "public" && (
                <p role="alert" className="text-xs text-destructive">
                  Set a username in settings before publishing — it is the URL
                  your collection lives at.
                </p>
              )}
            </fieldset>

            {chosen === "public" && (
              <fieldset disabled={pending} className="space-y-2">
                <Label htmlFor="share-slug">Address</Label>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="truncate">
                    /u/{user?.username ?? "you"}/{slugValue || "…"}
                  </span>
                </div>
                <Input
                  id="share-slug"
                  value={slugValue}
                  onChange={(event) => {
                    setSlug(event.target.value);
                    setSlugError(null);
                  }}
                  placeholder={collection?.name
                    ? collection.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, "")
                    : "my-collection"}
                  aria-invalid={invalidSlug}
                  aria-describedby={slugError ? "share-slug-error" : undefined}
                />
                {invalidSlug && (
                  <p className="text-xs text-destructive">
                    Use lowercase words separated by hyphens.
                  </p>
                )}
                {slugError && (
                  <p id="share-slug-error" role="alert" className="text-xs text-destructive">
                    {slugError}
                  </p>
                )}
                {!collection?.slug && slugValue && !invalidSlug && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={commitSlug}
                    disabled={pending}
                  >
                    Save address
                  </Button>
                )}
              </fieldset>
            )}

            {codeUrl && (
              <div className="space-y-1.5">
                <Label>{chosen === "public" ? "Unlisted link" : "Share link"}</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={codeUrl} fontMono />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(codeUrl)}
                    aria-label="Copy share link"
                    className="shrink-0"
                  >
                    {copied === codeUrl ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {publicUrl && chosen === "public" && (
              <div className="space-y-1.5">
                <Label>Public link</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={publicUrl} fontMono />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(publicUrl)}
                    aria-label="Copy public link"
                    className="shrink-0"
                  >
                    {copied === publicUrl ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {chosen === "public" && needsSlug && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Link2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                A slug is derived from the collection name when you publish —
                leave it blank to accept that.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
          {chosen !== "private" && (
            <Button
              variant="destructive"
              onClick={() => setUnshareOpen(true)}
              disabled={pending}
            >
              Stop sharing
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={unshareOpen}
        onOpenChange={setUnshareOpen}
        title="Stop sharing this collection?"
        description="Nobody will be able to open it from a link, and it leaves Explore."
        confirmLabel="Stop sharing"
        onConfirm={handleUnshare}
      />
    </Dialog>
  );
}