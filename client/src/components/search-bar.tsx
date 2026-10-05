import { useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
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
      <InputGroup>
        <InputGroupAddon>
          <Search className="text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search bookmarks"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <InputGroupAddon align="inline-end">
          {value && (
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X />
            </InputGroupButton>
          )}
          <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
