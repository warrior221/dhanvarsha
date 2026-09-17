"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";
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

const ALL = "__all__";

export function AdminProductFilters({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function push(next: URLSearchParams) {
    next.delete("page");
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    const next = new URLSearchParams(searchParams.toString());
    if (term) next.set("q", term);
    else next.delete("q");
    push(next);
  }

  const lowStock = searchParams.get("lowStock") === "1";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-3">
      <form onSubmit={onSearch} className="flex gap-2" role="search">
        <div>
          <Label htmlFor="admin-q" className="sr-only">
            Search by name or SKU
          </Label>
          <Input
            id="admin-q"
            name="q"
            type="search"
            placeholder="Name or SKU…"
            defaultValue={searchParams.get("q") ?? ""}
            className="w-56"
          />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          Search
        </Button>
      </form>

      <div>
        <Label htmlFor="admin-category" className="mb-1 block text-xs">
          Category
        </Label>
        <Select
          value={searchParams.get("categoryId") ?? ALL}
          onValueChange={(value) => set("categoryId", value)}
        >
          <SelectTrigger id="admin-category" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="admin-status" className="mb-1 block text-xs">
          Status
        </Label>
        <Select
          value={searchParams.get("status") ?? ALL}
          onValueChange={(value) => set("status", value)}
        >
          <SelectTrigger id="admin-status" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value="active">Live</SelectItem>
            <SelectItem value="inactive">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant={lowStock ? "default" : "outline"}
        onClick={() => set("lowStock", lowStock ? null : "1")}
        disabled={isPending}
      >
        Low stock only
      </Button>
    </div>
  );
}
