"use client";

import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SupplierPhoto } from "@/components/admin/supplier-photo";
import { ApiError, requestJson } from "@/lib/api-client";
import type { SupplierRow } from "@/lib/queries/suppliers";

/**
 * The weavers and sellers the shop buys from.
 *
 * Add and edit happen on the same screen as the list, because adding a weaver
 * is something the owner does mid-delivery with a phone in one hand — not a
 * separate page to navigate to and come back from.
 */

const BLANK = { name: "", mobile: "", notes: "", isActive: true };

export function SupplierManager({ initial }: { initial: SupplierRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [values, setValues] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function startAdd() {
    setValues(BLANK);
    setEditing(null);
    setAdding(true);
    setError(null);
  }

  function startEdit(row: SupplierRow) {
    setValues({
      name: row.name,
      mobile: row.mobile ?? "",
      notes: row.notes ?? "",
      isActive: row.isActive,
    });
    setAdding(false);
    setEditing(row.id);
    setError(null);
  }

  function close() {
    setAdding(false);
    setEditing(null);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);

    try {
      if (editing) {
        await requestJson(`/api/admin/suppliers/${editing}`, "PUT", values);
      } else {
        await requestJson("/api/admin/suppliers", "POST", values);
      }
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: SupplierRow) {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<{ deleted: boolean }>(
        `/api/admin/suppliers/${row.id}`,
        "DELETE",
      );

      // Says what actually happened. A weaver with deliveries behind them is
      // kept and marked inactive, because a purchase that cannot say who it
      // came from is worth less than a tidy list.
      setNotice(
        result.deleted
          ? `${row.name} removed.`
          : `${row.name} has ${row.purchaseCount} ${row.purchaseCount === 1 ? "delivery" : "deliveries"} on record, so they were marked inactive rather than deleted.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  }

  const open = adding || editing !== null;

  return (
    <div className="space-y-4">
      {notice ? (
        <Alert>
          <AlertDescription className="flex items-start justify-between gap-2">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X className="size-4" aria-hidden />
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!open ? (
        <Button type="button" onClick={startAdd}>
          <Plus className="size-4" aria-hidden />
          Add a weaver
        </Button>
      ) : (
        <div className="space-y-4 rounded-lg border bg-background p-5">
          <h2 className="text-lg font-medium">
            {editing ? "Edit weaver" : "Add a weaver"}
          </h2>

          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-name">Name</Label>
              <Input
                id="supplier-name"
                value={values.name}
                placeholder="Ramesh Weavers"
                onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-mobile">Mobile number</Label>
              <Input
                id="supplier-mobile"
                inputMode="tel"
                value={values.mobile}
                placeholder="9876543210"
                onChange={(event) =>
                  setValues((v) => ({ ...v, mobile: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                How the same weaver is recognised next time. Two people can share
                a name; they cannot share a number.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-notes">Notes</Label>
            <Textarea
              id="supplier-notes"
              rows={2}
              value={values.notes}
              placeholder="Village, what they weave, anything worth remembering."
              onChange={(event) => setValues((v) => ({ ...v, notes: event.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={values.isActive}
              onCheckedChange={(checked) => setValues((v) => ({ ...v, isActive: checked }))}
            />
            Still buying from them
          </label>

          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save"}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {initial.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No weavers yet. Add the first one before recording a delivery.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {initial.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-3 rounded-lg border bg-background p-3"
            >
              <SupplierPhoto
                supplierId={row.id}
                supplierName={row.name}
                hasPhoto={row.hasPhoto}
                photoVersion={row.photoVersion}
              />

              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {row.name}
                  {!row.isActive ? (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      No longer buying
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {row.mobile ?? "No number"}
                  {row.purchaseCount > 0
                    ? ` · ${row.purchaseCount} ${row.purchaseCount === 1 ? "delivery" : "deliveries"}`
                    : " · no deliveries yet"}
                </p>
                {row.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>
                ) : null}

                <div className="mt-2 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={busy}
                    onClick={() => startEdit(row)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    disabled={busy}
                    aria-label={`Remove ${row.name}`}
                    onClick={() => void remove(row)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
