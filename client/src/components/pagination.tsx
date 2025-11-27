import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!canGoPrev}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        prev
      </Button>

      <span className="text-sm text-muted-foreground px-4">
        page <span className="font-medium text-foreground">{currentPage}</span>{" "}
        of <span className="font-medium text-foreground">{totalPages}</span>
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={!canGoNext}
        onClick={() => onPageChange(currentPage + 1)}
      >
        next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
