"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { AddressForm } from "@/components/checkout/address-form";
import { EmptyState } from "@/components/shared/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, requestJson } from "@/lib/api-client";
import type { AddressView } from "@/lib/queries/address";

export function AddressBook({ initial }: { initial: AddressView[] }) {
  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setList(await requestJson<AddressView[]>("/api/addresses", "GET"));
  }

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);

    try {
      await work();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {list.length === 0 && !adding ? (
        <EmptyState
          title="No addresses saved"
          description="Add one now, or you can add it while checking out."
          action={<Button onClick={() => setAdding(true)}>Add an address</Button>}
        />
      ) : null}

      <ul className="space-y-3">
        {list.map((address) => (
          <li key={address.id} className="rounded-lg border bg-background p-4">
            {editing === address.id ? (
              <AddressForm
                initial={address}
                onSaved={() => {
                  setEditing(null);
                  void reload();
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <address className="text-sm not-italic text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {address.fullName}
                  </span>
                  {address.isDefault ? (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                      Default
                    </span>
                  ) : null}
                  <br />
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                  <br />
                  {address.city}, {address.state} {address.pincode}
                  <br />
                  Phone {address.phone}
                </address>

                <div className="flex flex-wrap gap-1">
                  {!address.isDefault ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          requestJson("/api/addresses", "PATCH", { id: address.id }),
                        )
                      }
                    >
                      Make default
                    </Button>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setEditing(address.id)}
                  >
                    Edit
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Remove this address?")) {
                        void run(() =>
                          requestJson("/api/addresses", "DELETE", { id: address.id }),
                        );
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 text-sm font-medium">New address</h2>
          <AddressForm
            onSaved={() => {
              setAdding(false);
              void reload();
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : list.length > 0 ? (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          Add another address
        </Button>
      ) : null}
    </div>
  );
}
