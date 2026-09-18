import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { Plus, X } from "lucide-react";
import { useCollections, useTags } from "@/hooks/queries";
import { useCreateBookmark, useUpdateBookmark } from "@/hooks/use-mutations";
import type { Bookmark } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type BookmarkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmark?: Bookmark;
  collectionId?: string;
  isFavorite?: boolean;
  returnFocus?: RefObject<HTMLElement | null>;
};

export function BookmarkDialog({ open, onOpenChange, returnFocus, ...defaults }: BookmarkDialogProps) {
  // Content is mounted afresh by the dialog on each open; cancelled drafts never
  // leak into another bookmark, and query refreshes don't reset an active draft.
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg motion-reduce:animate-none"
        showCloseButton={!pending}
        finalFocus={() => returnFocus?.current?.isConnected ? returnFocus.current : false}
      >
        <DialogHeader>
          <DialogTitle>{defaults.bookmark ? "Edit bookmark" : "New bookmark"}</DialogTitle>
          <DialogDescription>
            {defaults.bookmark
              ? "Update the details and choose where this bookmark belongs."
              : "Save a link. Leave the title blank to fetch details from the page."}
          </DialogDescription>
        </DialogHeader>
        <BookmarkForm {...defaults} onPendingChange={setPending} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BookmarkForm({
  bookmark, collectionId: defaultCollectionId, isFavorite: defaultFavorite,
  onPendingChange, onClose,
}: Omit<BookmarkDialogProps, "open" | "onOpenChange" | "returnFocus"> & {
  onPendingChange: (pending: boolean) => void;
  onClose: () => void;
}) {
  const id = useId();
  const create = useCreateBookmark();
  const update = useUpdateBookmark();
  const collections = useCollections();
  const tags = useTags();
  const [collectionId, setCollectionId] = useState(bookmark ? bookmark.collectionId ?? "" : defaultCollectionId ?? "");
  const [favorite, setFavorite] = useState(bookmark?.isFavorite ?? defaultFavorite ?? false);
  const [selectedTags, setSelectedTags] = useState(bookmark?.tags.map((tag) => tag.name) ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const pending = create.isPending || update.isPending;
  const availableTags = tags.data?.filter((tag) => !selectedTags.includes(tag.name)) ?? [];

  function addTag(name: string) {
    const trimmed = name.trim();
    if (trimmed) setSelectedTags((current) => [...new Set([...current, trimmed])]);
    setTagDraft("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (bookmark && !title) {
      const input = event.currentTarget.elements.namedItem("title") as HTMLInputElement;
      input.setCustomValidity("Enter a title.");
      input.reportValidity();
      return;
    }
    const details = {
      description: String(form.get("description") ?? "").trim(),
      note: String(form.get("note") ?? "").trim(),
      tags: [...new Set([...selectedTags, tagDraft.trim()].filter(Boolean))],
      isFavorite: favorite,
    };
    submitting.current = true;
    onPendingChange(true);
    setError(null);
    try {
      if (bookmark) {
        await update.mutateAsync({ id: bookmark.id, data: { ...details, title, collectionId: collectionId || null } });
      } else {
        await create.mutateAsync({
          ...details,
          url: String(form.get("url")).trim(),
          title: title || undefined,
          description: details.description || undefined,
          collectionId: collectionId || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this bookmark. Please try again.");
    } finally {
      submitting.current = false;
      onPendingChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-url`}>URL</Label>
          <Input id={`${id}-url`} name="url" type="url" required readOnly={!!bookmark}
            defaultValue={bookmark?.url} placeholder="https://example.com"
            pattern="https?://.+" title="Enter a full http:// or https:// URL."
            autoComplete="url" className="read-only:bg-muted read-only:text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-title`}>Title{!bookmark && " (optional)"}</Label>
          <Input id={`${id}-title`} name="title" required={!!bookmark} maxLength={500}
            defaultValue={bookmark?.title} placeholder="Use the page title"
            onInput={(event) => event.currentTarget.setCustomValidity("")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-description`}>Description (optional)</Label>
          <Textarea id={`${id}-description`} name="description" rows={2} maxLength={2000}
            defaultValue={bookmark?.description ?? ""} className="min-h-16" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-note`}>Note (optional)</Label>
          <Textarea id={`${id}-note`} name="note" rows={2} maxLength={5000}
            defaultValue={bookmark?.note ?? ""} placeholder="Something to remember…" className="min-h-16" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-collection`}>Collection</Label>
          <NativeSelect id={`${id}-collection`} className="w-full" value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)} disabled={collections.isPending}>
            <NativeSelectOption value="">{bookmark ? "No collection" : "Unsorted (default)"}</NativeSelectOption>
            {collectionId && !collections.data?.some((collection) => collection.id === collectionId) && (
              <NativeSelectOption value={collectionId}>Current collection</NativeSelectOption>
            )}
            {collections.data?.map((collection) => (
              <NativeSelectOption key={collection.id} value={collection.id}>{collection.name}</NativeSelectOption>
            ))}
          </NativeSelect>
          {collections.isPending && <p role="status" className="text-xs text-muted-foreground">Loading collections…</p>}
          {collections.isError && (
            <p role="status" className="text-xs text-muted-foreground">
              Could not load collections. Your current selection will be kept.{" "}
              <Button type="button" variant="link" size="sm" onClick={() => collections.refetch()}>Retry</Button>
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-tag`}>Tags (optional)</Label>
          {selectedTags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Selected tags">
              {selectedTags.map((name) => (
                <li key={name}>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedTags((current) => current.filter((tag) => tag !== name))}
                    aria-label={`Remove tag ${name}`} className="max-w-full">
                    <span className="max-w-48 truncate">{name}</span><X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input id={`${id}-tag`} value={tagDraft} placeholder="Add a tag" aria-describedby={`${id}-tag-help`}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  addTag(tagDraft);
                }
              }} />
            <Button type="button" variant="outline" size="icon" aria-label="Add tag" disabled={!tagDraft.trim()} onClick={() => addTag(tagDraft)}><Plus aria-hidden="true" /></Button>
          </div>
          <p id={`${id}-tag-help`} className="text-xs text-muted-foreground">Press Enter to add a tag. New tags are created when you save.</p>
          {availableTags.length > 0 && (
            <NativeSelect aria-label="Choose an existing tag" className="w-full" value="" onChange={(event) => addTag(event.target.value)}>
              <NativeSelectOption value="" disabled>Choose an existing tag…</NativeSelectOption>
              {availableTags.map((tag) => <NativeSelectOption key={tag.id} value={tag.name}>{tag.name}</NativeSelectOption>)}
            </NativeSelect>
          )}
          {tags.isError && <p role="status" className="text-xs text-muted-foreground">Existing tags could not be loaded. You can still enter tag names.</p>}
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <Label htmlFor={`${id}-favorite`}>Add to favorites</Label>
          <Switch id={`${id}-favorite`} checked={favorite} onCheckedChange={setFavorite} disabled={pending} />
        </div>
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {pending && <p role="status" className="text-sm text-muted-foreground">{bookmark ? "Saving changes…" : "Saving bookmark and fetching page details…"}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : bookmark ? "Save changes" : "Save bookmark"}</Button>
      </DialogFooter>
    </form>
  );
}
