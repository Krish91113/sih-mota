import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type FilterOption = { value: string; label: string };

export type FilterBarDef<T> = {
  key: string;
  label: string;
  placeholder?: string;
  options: FilterOption[];
};

export function FilterBar({
  definitions,
  value,
  onChange,
  disabled = false,
  onClear,
}: {
  definitions: FilterBarDef<unknown>[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  onClear?: () => void;
}) {
  const active = Object.values(value).filter(Boolean).length;
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-card",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {definitions.map((f) => (
        <div key={f.key} className="min-w-40 flex-1 sm:flex-none">
          <label
            htmlFor={`f-${f.key}`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {f.label}
          </label>
          <Select
            value={value[f.key] ?? "all"}
            onValueChange={(v) => onChange({ ...value, [f.key]: v === "all" ? "" : v })}
          >
            <SelectTrigger id={`f-${f.key}`} className="w-full sm:w-44" aria-label={f.label}>
              <SelectValue placeholder={f.placeholder ?? "All"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      {onClear && active > 0 ? (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X className="size-3.5" aria-hidden /> Clear ({active})
        </Button>
      ) : null}
    </div>
  );
}
