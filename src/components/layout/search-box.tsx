"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";

/**
 * Search, reachable from every page.
 *
 * A plain form that navigates to /products?q=…, so it still works with
 * JavaScript switched off or still loading. Submitting drops every other
 * filter on purpose: a new search is a new intent, and silently keeping a
 * category from three pages ago is how a shopper concludes you have nothing.
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  // The navbar renders this twice — one for wide screens, one for narrow —
  // so the id cannot be a constant or the label would point at the wrong box.
  const id = useId();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const q = value.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  return (
    <form
      role="search"
      action="/products"
      onSubmit={onSubmit}
      className={className}
    >
      <label htmlFor={id} className="sr-only">
        Search products
      </label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          name="q"
          type="search"
          value={value}
          placeholder="Search sarees, lehengas…"
          className="h-9 pl-8"
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
    </form>
  );
}
