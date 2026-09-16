"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { FilterableAttribute } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type CategoryOption = { id: string; name: string; slug: string };

/**
 * Filters live entirely in the URL, so a filtered view can be bookmarked,
 * shared or reloaded (spec section 7).
 *
 * Nothing here is hardcoded: the attribute sections are rendered from whatever
 * rows exist in the Attribute table with isFilterable = true. Adding a value in
 * the admin makes a new checkbox appear with no code change.
 */
export function FilterSidebar({
  attributes,
  categories,
  className,
  onNavigate,
}: {
  attributes: FilterableAttribute[];
  categories: CategoryOption[];
  className?: string;
  /** Lets the mobile sheet close itself after a filter is picked. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function commit(next: URLSearchParams) {
    // Any filter change puts us back on page 1 — page 4 of the old result set
    // is meaningless once the filters move.
    next.delete("page");

    const query = next.toString();

    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      onNavigate?.();
    });
  }

  function selectedValues(key: string): string[] {
    const raw = searchParams.get(key);
    return raw ? raw.split(",").filter(Boolean) : [];
  }

  function toggleValue(key: string, value: string, checked: boolean) {
    const next = new URLSearchParams(searchParams.toString());
    const current = new Set(selectedValues(key));

    if (checked) current.add(value);
    else current.delete(value);

    if (current.size === 0) next.delete(key);
    else next.set(key, [...current].join(","));

    commit(next);
  }

  function setCategory(slug: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (slug) next.set("category", slug);
    else next.delete("category");
    commit(next);
  }

  function applyPrice(formData: FormData) {
    const next = new URLSearchParams(searchParams.toString());

    for (const key of ["minPrice", "maxPrice"] as const) {
      const value = String(formData.get(key) ?? "").trim();
      if (value && /^\d{1,8}$/.test(value)) next.set(key, value);
      else next.delete(key);
    }

    commit(next);
  }

  const activeCategory = searchParams.get("category");

  const activeCount =
    (activeCategory ? 1 : 0) +
    (searchParams.get("minPrice") || searchParams.get("maxPrice") ? 1 : 0) +
    attributes.reduce((n, a) => n + selectedValues(a.slug).length, 0);

  return (
    <div
      className={cn("space-y-6", isPending && "pointer-events-none opacity-60", className)}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => {
              // Keep the search term and sort; drop every filter.
              const next = new URLSearchParams();
              const q = searchParams.get("q");
              const sort = searchParams.get("sort");
              if (q) next.set("q", q);
              if (sort) next.set("sort", sort);
              commit(next);
            }}
          >
            Clear all ({activeCount})
          </Button>
        ) : null}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Type</legend>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!activeCategory}
            onCheckedChange={() => setCategory(null)}
            aria-label="All types"
          />
          <span>All</span>
        </label>

        {categories.map((category) => (
          <label key={category.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={activeCategory === category.slug}
              onCheckedChange={(checked) =>
                setCategory(checked === true ? category.slug : null)
              }
              aria-label={category.name}
            />
            <span>{category.name}</span>
          </label>
        ))}
      </fieldset>

      <Separator />

      <form action={applyPrice} className="space-y-3">
        <p className="text-sm font-medium">Price (₹)</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label htmlFor="minPrice" className="sr-only">
              Minimum price
            </Label>
            <Input
              id="minPrice"
              name="minPrice"
              inputMode="numeric"
              placeholder="Min"
              defaultValue={searchParams.get("minPrice") ?? ""}
            />
          </div>
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <div className="flex-1">
            <Label htmlFor="maxPrice" className="sr-only">
              Maximum price
            </Label>
            <Input
              id="maxPrice"
              name="maxPrice"
              inputMode="numeric"
              placeholder="Max"
              defaultValue={searchParams.get("maxPrice") ?? ""}
            />
          </div>
        </div>
        <Button type="submit" variant="outline" size="sm" className="w-full">
          Apply price
        </Button>
      </form>

      {attributes.map((attribute) => {
        const selected = selectedValues(attribute.slug);

        return (
          <div key={attribute.id} className="space-y-3">
            <Separator />
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">{attribute.name}</legend>

              {attribute.values.length === 0 ? (
                <p className="text-sm text-muted-foreground">No options yet.</p>
              ) : (
                attribute.values.map((value) => (
                  <label key={value.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(value.slug)}
                      onCheckedChange={(checked) =>
                        toggleValue(attribute.slug, value.slug, checked === true)
                      }
                      aria-label={`${attribute.name}: ${value.value}`}
                    />
                    <span>{value.value}</span>
                  </label>
                ))
              )}
            </fieldset>
          </div>
        );
      })}
    </div>
  );
}
