"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getJson } from "@/lib/api-client";
import type { DesignMatch } from "@/lib/queries/admin-products";

/**
 * Links this piece to another colour of the same design.
 *
 * Colours are separate products on purpose — each is its own piece on the shelf
 * with its own tag, cost, stock and photographs. This only records that two
 * entries are the same design, so each one's page can offer the other.
 *
 * Pointing at a piece that is already linked to others joins the whole set, so a
 * third and fourth colour can each be linked to whichever one is easiest to find.
 */
export function DesignPicker({
  value,
  alreadyLinked,
  excludeProductId,
  onChange,
}: {
  value: string | null;
  alreadyLinked: { id: string; name: string; colourName: string | null }[];
  excludeProductId?: string;
  onChange: (productId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<DesignMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<DesignMatch | null>(null);

  // Ignores a slow response that arrives after a newer one.
  const latest = useRef(0);

  const term = query.trim();
  const shown = term.length >= 2 ? matches : [];

  useEffect(() => {
    if (term.length < 2) return;

    const ticket = ++latest.current;

    const timer = setTimeout(() => {
      setSearching(true);

      const params = new URLSearchParams({ q: term });
      if (excludeProductId) params.set("exclude", excludeProductId);

      getJson<{ matches: DesignMatch[] }>(`/api/admin/products/search?${params}`)
        .then((data) => {
          if (ticket === latest.current) setMatches(data.matches);
        })
        .catch(() => {
          if (ticket === latest.current) setMatches([]);
        })
        .finally(() => {
          if (ticket === latest.current) setSearching(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [term, excludeProductId]);

  // Already linked, and nothing new picked in this sitting.
  if (value !== null && picked === null && alreadyLinked.length > 0) {
    return (
      <div className="rounded-md border p-3 text-sm">
        <p className="font-medium">
          Linked to {alreadyLinked.length}{" "}
          {alreadyLinked.length === 1 ? "other colour" : "other colours"}
        </p>
        <ul className="mt-1 text-muted-foreground">
          {alreadyLinked.map((other) => (
            <li key={other.id}>{other.colourName ?? other.name}</li>
          ))}
        </ul>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-xs"
          onClick={() => onChange(null)}
        >
          <X className="size-3.5" aria-hidden />
          Unlink this colour
        </Button>
      </div>
    );
  }

  if (picked !== null) {
    return (
      <div className="rounded-md border p-3 text-sm">
        <p className="font-medium">
          Same design as {picked.colourName ?? picked.name}
        </p>
        <p className="font-mono text-muted-foreground">
          {picked.code ?? ""}
          {picked.coloursInGroup > 1
            ? ` · joins a set of ${picked.coloursInGroup}`
            : ""}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-xs"
          onClick={() => {
            setPicked(null);
            onChange(null);
          }}
        >
          <X className="size-3.5" aria-hidden />
          Change
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          autoComplete="off"
          placeholder="Search the other colour by name or code"
          className="pl-9"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Leave this empty unless this piece is another colour of something you
        already have.
      </p>

      {searching && shown.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Looking…</p>
      ) : null}

      {shown.length > 0 ? (
        <ul className="mt-2 divide-y rounded-md border">
          {shown.map((match) => (
            <li key={match.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 p-2 text-left transition hover:bg-muted/60"
                onClick={() => {
                  setPicked(match);
                  onChange(match.id);
                  setQuery("");
                }}
              >
                {match.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={match.imageUrl}
                    alt=""
                    className="size-9 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="size-9 shrink-0 rounded bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {match.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="font-mono">{match.code ?? "no code"}</span>
                    {match.colourName ? ` · ${match.colourName}` : ""}
                    {match.coloursInGroup > 1
                      ? ` · already ${match.coloursInGroup} colours`
                      : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {term.length >= 2 && !searching && shown.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing matches.</p>
      ) : null}
    </div>
  );
}
