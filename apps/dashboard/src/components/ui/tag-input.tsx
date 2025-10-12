"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TagInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
};

export function TagInput({ value, onChange, suggestions = [], placeholder, className }: TagInputProps) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const normalizedSuggestions = React.useMemo(() => {
    const normalizedDraft = draft.trim().toLowerCase();
    return suggestions
      .filter((tag) => !value.includes(tag))
      .filter((tag) => (normalizedDraft ? tag.toLowerCase().includes(normalizedDraft) : true))
      .slice(0, 6);
  }, [draft, suggestions, value]);

  const addTag = React.useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (!tag) return;
      if (value.includes(tag)) return;
      onChange([...value, tag]);
      setDraft("");
      inputRef.current?.focus();
    },
    [onChange, value]
  );

  const removeTag = React.useCallback(
    (tag: string) => {
      onChange(value.filter((item) => item !== tag));
    },
    [onChange, value]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === "Backspace" && !draft) {
      removeTag(value[value.length - 1] ?? "");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 rounded-full bg-secondary/80 text-secondary-foreground"
          >
            <span>{tag}</span>
            <button
              type="button"
              className="rounded-full border border-transparent p-0.5 hover:border-border hover:bg-background/60"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="flex-1 min-w-[120px] border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {normalizedSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wide text-[0.65rem]">Suggestions:</span>
          {normalizedSuggestions.map((tag) => (
            <Button
              key={tag}
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 rounded-full border border-dashed border-border px-2 text-xs"
              onClick={() => addTag(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
