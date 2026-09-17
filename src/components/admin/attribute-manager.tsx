"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError, requestJson } from "@/lib/api-client";
import type { AdminAttribute } from "@/lib/queries/admin-attributes";
import { slugify } from "@/lib/validations/product";

/**
 * Create and edit attributes and their values.
 *
 * Everything here feeds the customer filter sidebar directly — that sidebar is
 * rendered from these rows, so nothing needs a code change when a new option
 * is invented.
 */
export function AttributeManager({ attributes }: { attributes: AdminAttribute[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);

    try {
      await work();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <NewAttribute onCreate={(input) => run(() => requestJson("/api/admin/attributes", "POST", input))} busy={busy} />

      {attributes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No attributes yet. Create one above — Occasion, Fabric and Style are
          good starting points.
        </p>
      ) : null}

      {attributes.map((attribute) => (
        <section key={attribute.id} className="space-y-4 rounded-lg border bg-background p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">{attribute.name}</h2>
              <p className="text-xs text-muted-foreground">
                URL name: <code>{attribute.slug}</code> · {attribute.values.length}{" "}
                {attribute.values.length === 1 ? "option" : "options"}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={attribute.isFilterable}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    void run(() =>
                      requestJson("/api/admin/attributes", "PATCH", {
                        id: attribute.id,
                        isFilterable: checked,
                      }),
                    )
                  }
                />
                Show as filter
              </label>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={busy}
                onClick={() => {
                  const used = attribute.values.reduce((n, v) => n + v.productCount, 0);
                  const warning =
                    used > 0
                      ? `\n\nThis will untag ${used} product${used === 1 ? "" : "s"}.`
                      : "";

                  if (
                    window.confirm(
                      `Delete the "${attribute.name}" attribute and all its options?${warning}`,
                    )
                  ) {
                    void run(() =>
                      requestJson("/api/admin/attributes", "DELETE", { id: attribute.id }),
                    );
                  }
                }}
              >
                Delete attribute
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {attribute.values.map((value) => (
              <Badge key={value.id} variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1">
                {value.value}
                <span className="text-muted-foreground">({value.productCount})</span>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Delete ${value.value}`}
                  className="rounded-full p-0.5 hover:bg-background/60"
                  onClick={() => {
                    const warning =
                      value.productCount > 0
                        ? `\n\nThis will untag ${value.productCount} product${value.productCount === 1 ? "" : "s"}.`
                        : "";

                    if (window.confirm(`Delete "${value.value}"?${warning}`)) {
                      void run(() =>
                        requestJson("/api/admin/attributes/values", "DELETE", {
                          id: value.id,
                        }),
                      );
                    }
                  }}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            ))}

            {attribute.values.length === 0 ? (
              <p className="text-sm text-muted-foreground">No options yet.</p>
            ) : null}
          </div>

          <NewValue
            attributeName={attribute.name}
            busy={busy}
            onCreate={(value) =>
              run(() =>
                requestJson("/api/admin/attributes/values", "POST", {
                  attributeId: attribute.id,
                  value,
                }),
              )
            }
          />
        </section>
      ))}
    </div>
  );
}

function NewAttribute({
  onCreate,
  busy,
}: {
  onCreate: (input: { name: string; slug: string }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");

  return (
    <section className="space-y-3 rounded-lg border bg-background p-5">
      <div>
        <h2 className="text-lg font-medium">New attribute</h2>
        <p className="text-sm text-muted-foreground">
          A group of options customers can filter by — Fabric, Occasion, Work.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 sm:max-w-xs">
          <Label htmlFor="new-attribute" className="sr-only">
            Attribute name
          </Label>
          <Input
            id="new-attribute"
            value={name}
            placeholder="e.g. Work"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || name.trim().length === 0}
          onClick={() => {
            onCreate({ name: name.trim(), slug: slugify(name) });
            setName("");
          }}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Create
        </Button>
      </div>
    </section>
  );
}

function NewValue({
  attributeName,
  onCreate,
  busy,
}: {
  attributeName: string;
  onCreate: (value: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex gap-2">
      <div className="w-56">
        <Label htmlFor={`new-value-${attributeName}`} className="sr-only">
          New {attributeName} option
        </Label>
        <Input
          id={`new-value-${attributeName}`}
          value={value}
          className="h-8 text-sm"
          placeholder={`Add a ${attributeName.toLowerCase()} option…`}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (value.trim()) {
                onCreate(value.trim());
                setValue("");
              }
            }
          }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        disabled={busy || value.trim().length === 0}
        onClick={() => {
          onCreate(value.trim());
          setValue("");
        }}
      >
        <Plus className="size-3.5" aria-hidden />
        Add
      </Button>
    </div>
  );
}
