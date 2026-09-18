import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type SearchBarProps = {
  defaultValue?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
};

export function SearchBar({
  defaultValue = "",
  onSearch,
  placeholder = "search bookmarks...",
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSearch(value);
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 basis-full gap-2 sm:flex-1">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search bookmarks"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="pl-9"
        />
      </div>
    </form>
  );
}
