"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/validations/product";

export type EditableVariant = {
  /** Present when editing an existing row. */
  id?: string;
  size: string;
  sku: string;
  price: string;
  stockQty: number;
};

const COMMON_SIZES = ["Free Size", "XS", "S", "M", "L", "XL", "XXL"];

/**
 * Sizes and their stock.
 *
 * Every product needs at least one, and each one needs a real size — the shop
 * requires an explicit size at add-to-cart, so a product sold in a single size
 * is recorded as "Free Size" rather than left blank.
 */
export function VariantEditor({
  variants,
  productSku,
  defaultPrice,
  onChange,
}: {
  variants: EditableVariant[];
  productSku: string;
  defaultPrice: string;
  onChange: (next: EditableVariant[]) => void;
}) {
  function update(index: number, patch: Partial<EditableVariant>) {
    const next = [...variants];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  }

  function add(size = "") {
    onChange([
      ...variants,
      {
        size,
        sku: suggestSku(productSku, size, variants),
        price: defaultPrice,
        stockQty: 0,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sizes yet. Add at least one — use “Free Size” if the product comes
          in a single size.
        </p>
      ) : null}

      {variants.map((variant, index) => (
        <div
          key={variant.id ?? `new-${index}`}
          className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_100px_auto]"
        >
          <div>
            <Label htmlFor={`size-${index}`} className="mb-1 block text-xs">
              Size
            </Label>
            <Input
              id={`size-${index}`}
              value={variant.size}
              placeholder="M or Free Size"
              onChange={(event) => {
                const size = event.target.value;
                // Only auto-fill the SKU while it is still untouched.
                const shouldSuggest =
                  !variant.id &&
                  (variant.sku === "" ||
                    variant.sku === suggestSku(productSku, variant.size, variants));

                update(index, {
                  size,
                  ...(shouldSuggest
                    ? { sku: suggestSku(productSku, size, variants) }
                    : {}),
                });
              }}
            />
          </div>

          <div>
            <Label htmlFor={`sku-${index}`} className="mb-1 block text-xs">
              Size SKU
            </Label>
            <Input
              id={`sku-${index}`}
              value={variant.sku}
              placeholder="SR-KJV-001-M"
              onChange={(event) =>
                update(index, { sku: event.target.value.toUpperCase() })
              }
            />
          </div>

          <div>
            <Label htmlFor={`price-${index}`} className="mb-1 block text-xs">
              Price (₹)
            </Label>
            <Input
              id={`price-${index}`}
              value={variant.price}
              inputMode="decimal"
              placeholder="8999"
              onChange={(event) => update(index, { price: event.target.value })}
            />
          </div>

          <div>
            <Label htmlFor={`stock-${index}`} className="mb-1 block text-xs">
              Stock
            </Label>
            <Input
              id={`stock-${index}`}
              value={String(variant.stockQty)}
              inputMode="numeric"
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(/\D/g, ""));
                update(index, { stockQty: Number.isFinite(parsed) ? parsed : 0 });
              }}
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label={`Remove size ${variant.size || index + 1}`}
              onClick={() => onChange(variants.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add()}>
          <Plus className="size-3.5" aria-hidden />
          Add size
        </Button>

        {COMMON_SIZES.filter(
          (size) => !variants.some((v) => v.size.toLowerCase() === size.toLowerCase()),
        ).map((size) => (
          <Button
            key={size}
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => add(size)}
          >
            + {size}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** "SR-KJV-001" + "Free Size" -> "SR-KJV-001-FREE-SIZE" */
function suggestSku(
  productSku: string,
  size: string,
  existing: EditableVariant[],
): string {
  const base = productSku.trim().toUpperCase();
  if (!base) return "";

  const suffix = slugify(size).toUpperCase();
  const candidate = suffix ? `${base}-${suffix}` : base;

  // Avoid colliding with a row already in this form.
  if (!existing.some((variant) => variant.sku === candidate)) return candidate;

  let counter = 2;
  while (existing.some((variant) => variant.sku === `${candidate}-${counter}`)) {
    counter += 1;
  }

  return `${candidate}-${counter}`;
}
