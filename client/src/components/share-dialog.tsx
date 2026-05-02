import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShareStatus } from "@/hooks/queries";
import {
  useShareCollection,
  useUnshareCollection,
} from "@/hooks/use-mutations";
import { Check, Copy, Globe, Loader2, Lock } from "lucide-react";
import type { Collection } from "@/types";

type ShareDialogProps = {
  collection: Collection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShareDialog({
  collection,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const { data: shareInfo, isLoading } = useShareStatus(collection?.id || "");
  const shareCollection = useShareCollection();
  const unshareCollection = useUnshareCollection();

  const shareUrl = shareInfo?.shareCode
    ? `${window.location.origin}/share/${shareInfo.shareCode}`
    : null;

  const handleShare = () => {
    if (!collection) return;
    shareCollection.mutate(collection.id);
  };

  const handleUnshare = () => {
    if (!collection) return;
    if (confirm("This will make the collection private. Anyone with the link will no longer have access.")) {
      unshareCollection.mutate(collection.id);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {shareInfo?.isActive ? (
              <Globe className="h-5 w-5 text-green-500" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
            Share "{collection?.name}"
          </DialogTitle>
          <DialogDescription>
            {shareInfo?.isActive
              ? "This collection is public. Anyone with the link can view it."
              : "Make this collection public so anyone with the link can view the bookmarks."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : shareInfo?.isActive ? (
          // shared state — show link + copy + unshare
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl || ""}
                className="font-mono text-sm"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Nested sub-collections and their bookmarks are included automatically.
            </p>
            <div className="flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUnshare}
                disabled={unshareCollection.isPending}
              >
                {unshareCollection.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Stop sharing"
                )}
              </Button>
            </div>
          </div>
        ) : (
          // not shared — show publish button
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              All bookmarks in this collection (and nested sub-collections) will
              be visible to anyone with the link.
            </p>
            <Button
              onClick={handleShare}
              disabled={shareCollection.isPending}
              className="w-full"
            >
              {shareCollection.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Make public
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
