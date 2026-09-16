"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  FilterSidebar,
  type CategoryOption,
} from "@/components/product/filter-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SORT_OPTIONS, type FilterableAttribute } from "@/lib/catalog";

/** Search box + sort control, plus the filter sheet on small screens. */
export function CatalogToolbar({
  attributes,
  categories,
  total,
}: {
  attributes: FilterableAttribute[];
  categories: CategoryOption[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  function push(next: URLSearchParams) {
    next.delete("page");
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    const next = new URLSearchParams(searchParams.toString());

    if (term) next.set("q", term);
    else next.delete("q");

    push(next);
  }

  function onSort(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "newest") next.delete("sort");
    else next.set("sort", value);
    push(next);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form onSubmit={onSearch} className="flex w-full gap-2 sm:max-w-xs" role="search">
        <Label htmlFor="catalog-search" className="sr-only">
          Search products
        </Label>
        <Input
          id="catalog-search"
          name="q"
          type="search"
          placeholder="Search sarees, lehengas…"
          defaultValue={searchParams.get("q") ?? ""}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="flex items-center gap-2">
        <p className="hidden text-sm text-muted-foreground sm:block" aria-live="polite">
          {total} {total === 1 ? "product" : "products"}
        </p>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden">
              <SlidersHorizontal aria-hidden className="size-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-8">
              <FilterSidebar
                attributes={attributes}
                categories={categories}
                onNavigate={() => setSheetOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Label htmlFor="catalog-sort" className="sr-only">
          Sort products
        </Label>
        <Select
          value={searchParams.get("sort") ?? "newest"}
          onValueChange={onSort}
        >
          <SelectTrigger id="catalog-sort" className="w-[180px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
