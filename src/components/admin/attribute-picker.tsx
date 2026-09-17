"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ApiError, requestJson } from "@/lib/api-client";

export type PickerAttribute = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

type CreatedValue = { id: string; value: string; slug: string; created: boolean };

/**
 * Tick existing attribute values, or invent a new one without leaving the
 * product form.
 *
 * A value added here is written straight to AttributeValue, so it shows up as
 * a customer-facing filter immediately — the catalog sidebar is rendered from
 * those rows and nothing about it is hardcoded.
 */
export function AttributePicker({
  attributes,
  selectedIds,
  onChange,
}: {
  attributes: PickerAttribute[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  // Values created during this session, merged into the lists below so they
  // appear without a page reload.
  const [added, setAdded] = useState<Record<string, { id: string; value: string }[]>>({});

  function toggle(valueId: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(valueId);
    else next.delete(valueId);
    onChange([...next]);
  }

  if (attributes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No attributes yet. Create some on the Attributes page first.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {attributes.map((attribute) => {
        const values = [...attribute.values, ...(added[attribute.id] ?? [])];

        return (
          <fieldset key={attribute.id}>
            <legend className="mb-2 text-sm font-medium">{attribute.name}</legend>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {values.map((value) => (
                <label key={value.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedIds.includes(value.id)}
                    onCheckedChange={(checked) => toggle(value.id, checked === true)}
                    aria-label={`${attribute.name}: ${value.value}`}
                  />
                  <span>{value.value}</span>
                </label>
              ))}
            </div>

            <AddValue
              attributeId={attribute.id}
              attributeName={attribute.name}
              onAdded={(value) => {
                setAdded((current) => {
                  const existing = current[attribute.id] ?? [];
                  // Do not list it twice if the server matched an existing row.
                  if (
                    existing.some((v) => v.id === value.id) ||
                    attribute.values.some((v) => v.id === value.id)
                  ) {
                    return current;
                  }
                  return { ...current, [attribute.id]: [...existing, value] };
                });

                // Tick it straight away — adding it clearly means wanting it.
                if (!selectedIds.includes(value.id)) {
                  onChange([...selectedIds, value.id]);
                }
              }}
            />
          </fieldset>
        );
      })}
    </div>
  );
}

function AddValue({
  attributeId,
  attributeName,
  onAdded,
}: {
  attributeId: string;
  attributeName: string;
  onAdded: (value: { id: string; value: string }) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);

    try {
      const created = await requestJson<CreatedValue>(
        "/api/admin/attributes/values",
        "POST",
        { attributeId, value: trimmed },
      );

      onAdded({ id: created.id, value: created.value });
      setValue("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that value.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={`Add a new ${attributeName.toLowerCase()}…`}
          aria-label={`Add a new ${attributeName} value`}
          className="h-8 w-56 text-sm"
          onKeyDown={(event) => {
            // The product form is a <form>; Enter here must add the value, not
            // submit the whole product.
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={busy || value.trim().length === 0}
          onClick={() => void submit()}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-3.5" aria-hidden />
          )}
          Add
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
