import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

type Filter = {
  key: string;
  label: string;
  onRemove: () => void;
};

type FilterBadgesProps = {
  filters: Filter[];
};

export function FilterBadges({ filters }: FilterBadgesProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {filters.map((filter) => (
        <Badge 
          key={filter.key} 
          variant="secondary"
          className="gap-1 pr-1"
        >
          {filter.label}
          <button
            onClick={filter.onRemove}
            className="hover:bg-muted rounded p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}