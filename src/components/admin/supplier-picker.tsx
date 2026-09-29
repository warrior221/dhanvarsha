"use client";

import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestJson } from "@/lib/api-client";
import type { SupplierRow } from "@/lib/queries/suppliers";

/**
 * Picking the weaver a delivery came from.
 *
 * Search rather than a dropdown, because a shop with a hundred weavers makes a
 * dropdown useless — and searching is how the owner already thinks of them
 * ("the Ramesh one"). Matches on name or number.
 *
 * A weaver who is not on the list yet can be added here without leaving the
 * delivery half-entered, which is the moment it actually comes up: the goods
 * are on the counter and the person is standing there.
 */

/** Long enough that a fast typist does not fire a request per keystroke. */
const DEBOUNCE_MS = 250;

export type PickedSupplier = { id: string; name: string; mobile: string | null };

export function SupplierPicker({
  value,
  onChange,
}: {
  value: PickedSupplier | null;
  onChange: (supplier: PickedSupplier | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SupplierRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ignores a slow response that arrives after a newer one. Without this,
  // typing "ram" then "ramesh" can leave the results for "ram" on screen.
  const latest = useRef(0);

  useEffect(() => {
    if (value !== null) return;

    const term = query.trim();
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      setSearching(true);

      void requestJson<SupplierRow[]>(
        `/api/admin/suppliers?q=${encodeURIComponent(term)}`,
        "GET",
      )
        .then((rows) => {
          if (ticket === latest.current) setResults(rows.filter((row) => row.isActive));
        })
        .catch(() => {
          if (ticket === latest.current) setResults([]);
        })
        .finally(() => {
          if (ticket === latest.current) setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, value]);

  async function addNew() {
    setBusy(true);
    setError(null);

    try {
      const { id } = await requestJson<{ id: string }>("/api/admin/suppliers", "POST", {
        name: newName.trim(),
        mobile: newMobile.trim(),
        notes: "",
        isActive: true,
      });

      onChange({ id, name: newName.trim(), mobile: newMobile.trim() });
      setAdding(false);
      setNewName("");
      setNewMobile("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that weaver.");
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
        <Check className="size-4 shrink-0 text-emerald-700 dark:text-emerald-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{value.name}</p>
          {value.mobile ? (
            <p className="text-sm text-muted-foreground">{value.mobile}</p>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <X className="size-4" aria-hidden />
          Change
        </Button>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="space-y-3 rounded-lg border bg-background p-3">
        <p className="text-sm font-medium">New weaver</p>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-weaver-name">Name</Label>
            <Input
              id="new-weaver-name"
              value={newName}
              placeholder="Ramesh Weavers"
              onChange={(event) => setNewName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-weaver-mobile">Mobile number</Label>
            <Input
              id="new-weaver-mobile"
              inputMode="tel"
              value={newMobile}
              placeholder="9876543210"
              onChange={(event) => setNewMobile(event.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || newName.trim().length < 2 || newMobile.trim().length < 10}
            onClick={() => void addNew()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Add and use"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          placeholder="Search by name or number…"
          aria-label="Search weavers"
          className="pl-8"
          onChange={(event) => setQuery(event.target.value)}
        />
        {searching ? (
          <Loader2
            className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      {results.length > 0 ? (
        <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border bg-background">
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-muted/60"
                onClick={() =>
                  onChange({ id: row.id, name: row.name, mobile: row.mobile })
                }
              >
                <div className="size-9 shrink-0 overflow-hidden rounded bg-muted">
                  {row.hasPhoto ? (
                    // The same face as on the weavers page, so the person
                    // picking recognises them without reading.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/admin/suppliers/${row.id}/photo/thumb?v=${row.photoVersion ?? ""}`}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.mobile ?? "No number"}
                    {row.purchaseCount > 0 ? ` · ${row.purchaseCount} deliveries` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : query.trim() !== "" && !searching ? (
        <p className="text-sm text-muted-foreground">
          No weaver matches &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          // Carry what was typed across, so it is not typed twice.
          setNewName(query.trim());
          setAdding(true);
          setError(null);
        }}
      >
        <Plus className="size-4" aria-hidden />
        New weaver
      </Button>
    </div>
  );
}
