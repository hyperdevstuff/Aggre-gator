import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

type SearchBarProps = {
  defaultValue?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
};

export function SearchBar({
  defaultValue = "",
  onSearch,
  placeholder = "Search bookmarks…",
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSearch(value);
  };

  const handleClear = () => {
    setValue("");
    onSearch("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-w-0 basis-full gap-2 sm:flex-1"
    >
      <div className="relative flex-1 w-full group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
        <Input
          aria-label="Search bookmarks"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 pl-12 pr-24 text-base rounded-xl border-2 transition-all focus-visible:ring-0 focus-visible:border-primary"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="h-6 w-6"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </Button>
          )}
          <kbd className="pointer-events-none hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>
    </form>
  );
}
