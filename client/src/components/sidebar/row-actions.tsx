import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type RowActionsProps = {
  /** Which ancestor carries the hover group: a nav row (`item`) or a section header (`label`). */
  group: "item" | "label";
  label: string;
  /** Count shown until hover/focus. Omit for headers. */
  badge?: ReactNode;
  /** The menu content (`DropdownMenuContent`). */
  children: ReactNode;
};

/**
 * Fixed 28px trailing slot shared by section headers and nav rows, so the
 * options button lands on the same edge everywhere. The badge swaps to the
 * button on hover/focus; touch keeps both visible.
 */
export function RowActions({ group, label, badge, children }: RowActionsProps) {
  // Full class literals — Tailwind cannot see through string interpolation.
  const badgeSwap =
    group === "label"
      ? "[@media(hover:hover)]:group-hover/label:opacity-0 [@media(hover:hover)]:group-focus-within/label:opacity-0"
      : "[@media(hover:hover)]:group-hover/item:opacity-0 [@media(hover:hover)]:group-focus-within/item:opacity-0";
  const buttonSwap =
    group === "label"
      ? "[@media(hover:hover)]:group-hover/label:opacity-100 [@media(hover:hover)]:group-focus-within/label:opacity-100"
      : "[@media(hover:hover)]:group-hover/item:opacity-100 [@media(hover:hover)]:group-focus-within/item:opacity-100";

  return (
    <span className="relative ml-1 flex h-7 shrink-0 items-center justify-center gap-1 [@media(hover:hover)]:w-7 [@media(hover:hover)]:gap-0">
      {badge !== undefined && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums transition-opacity duration-150 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-0",
            badgeSwap,
          )}
        >
          {badge}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={label}
              className={cn(
                "relative size-7 shrink-0 opacity-100 transition-opacity duration-150 after:absolute after:-inset-2 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-0 [@media(hover:hover)]:m-auto [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100",
                buttonSwap,
              )}
            />
          }
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        {children}
      </DropdownMenu>
    </span>
  );
}
