import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/mota/bits";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  hideBelowMd?: boolean;
  hideBelowLg?: boolean;
};

const PAGE_SIZES = [10, 25, 50] as const;

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  searchPlaceholder,
  search,
  onSearchChange,
  searchKeys,
  onRowClick,
  selectable,
  selectedKeys,
  onSelectionChange,
  pageSize = 10,
  emptyTitle = "No records found",
  emptyDesc = "Try adjusting the filters to see more results.",
  emptyAction,
}: {
  data: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchKeys?: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDesc?: string;
  emptyAction?: ReactNode;
}) {
  const [localSearch, setLocalSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(pageSize);

  const query = onSearchChange ? (search ?? "") : localSearch;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = data;
    if (q && searchKeys) {
      rows = data.filter((r) => searchKeys(r).toLowerCase().includes(q));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        rows = [...rows].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv));
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    return rows;
  }, [data, query, searchKeys, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * size, safePage * size + size);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const allSelected =
    selectable &&
    rows.length > 0 &&
    selectedKeys &&
    rows.every((r) => selectedKeys.has(getRowKey(r)));

  const toggleAll = () => {
    if (!selectable || !selectedKeys || !onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (allSelected) {
      rows.forEach((r) => next.delete(getRowKey(r)));
    } else {
      rows.forEach((r) => next.add(getRowKey(r)));
    }
    onSelectionChange(next);
  };

  const toggleOne = (key: string) => {
    if (!selectable || !selectedKeys || !onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  return (
    <div>
      {searchPlaceholder ? (
        <div className="mb-4 max-w-sm">
          <Label htmlFor={searchPlaceholder} className="sr-only">
            Search
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={searchPlaceholder}
              value={query}
              onChange={(e) => {
                if (onSearchChange) onSearchChange(e.target.value);
                else setLocalSearch(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title={emptyTitle} desc={emptyDesc} action={emptyAction} />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {selectable ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all rows on this page"
                    />
                  </TableHead>
                ) : null}
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(
                      c.hideBelowMd && "hidden md:table-cell",
                      c.hideBelowLg && "hidden lg:table-cell",
                      c.className,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => c.sortValue && toggleSort(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 font-medium",
                        c.sortValue ? "cursor-pointer hover:text-foreground" : "cursor-default",
                      )}
                    >
                      {c.header}
                      {c.sortValue ? (
                        sortKey === c.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="size-3.5 text-primary" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3.5 text-primary" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 text-muted-foreground/60" aria-hidden />
                        )
                      ) : null}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const key = getRowKey(row);
                const selected = selectedKeys?.has(key) ?? false;
                return (
                  <TableRow
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={cn(onRowClick && "cursor-pointer", selected && "bg-primary/5")}
                  >
                    {selectable ? (
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleOne(key)}
                          aria-label={`Select row ${key}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(
                          c.hideBelowMd && "hidden md:table-cell",
                          c.hideBelowLg && "hidden lg:table-cell",
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : safePage * size + 1}–
              {Math.min(filtered.length, (safePage + 1) * size)} of {filtered.length}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows</span>
                <Select
                  value={String(size)}
                  onValueChange={(v) => {
                    setSize(Number(v));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 w-16" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground">
                  {safePage + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
