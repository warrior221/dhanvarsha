"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AttributePicker,
  type PickerAttribute,
} from "@/components/admin/attribute-picker";
import { DesignPicker } from "@/components/admin/design-picker";
import { ImageUploader, type EditableImage } from "@/components/admin/image-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, requestJson } from "@/lib/api-client";
import { formatInr } from "@/lib/format";
import { productFormSchema, slugify } from "@/lib/validations/product";

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  mrp: string;
  sellingPrice: string;
  costPrice: string;
  supplierName: string;
  purchaseNote: string;
  isActive: boolean;
  careInstructions: string;
  silkMarkNumber: string;
  colourName: string;
  sameDesignAsProductId: string | null;
  images: EditableImage[];
  /** The one piece's stock. There are no sizes to keep separate counts for. */
  stockQty: number;
  attributeValueIds: string[];
  /** The piece's one code, read-only. Issued once and never reissued. */
  code?: string | null;
  /** Sizes from before the shop went one-size. Shown as a warning, never edited. */
  legacySizes?: { size: string; stockQty: number; code: string }[];
  /** The other colours already linked to this one, for the picker to show. */
  otherColours?: { id: string; name: string; colourName: string | null }[];
};

const BLANK: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  categoryId: "",
  mrp: "",
  sellingPrice: "",
  costPrice: "",
  supplierName: "",
  purchaseNote: "",
  isActive: true,
  careInstructions: "",
  silkMarkNumber: "",
  colourName: "",
  sameDesignAsProductId: null,
  images: [],
  stockQty: 0,
  attributeValueIds: [],
};

export function ProductForm({
  categories,
  attributes,
  initial,
}: {
  categories: { id: string; name: string }[];
  attributes: PickerAttribute[];
  initial?: ProductFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(initial ?? BLANK);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Local only, never submitted.
   *
   * The discount is a way of ARRIVING at the selling price, not a third thing
   * to store — the shop recomputes it from the two prices every time it is
   * shown, so a stored copy could only ever drift out of step with them.
   */
  const [discount, setDiscount] = useState(
    () => discountFromSelling(initial?.mrp ?? "", initial?.sellingPrice ?? "") ?? "",
  );

  const isEdit = Boolean(initial?.id);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Same schema the API route runs. This is only for quick feedback — the
    // server validates again and is the one that counts.
    const parsed = productFormSchema.safeParse(values);

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_";
        next[key] ??= issue.message;
      }
      setFieldErrors(next);
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);

    try {
      if (isEdit && initial?.id) {
        await requestJson(`/api/admin/products/${initial.id}`, "PUT", parsed.data);
      } else {
        await requestJson("/api/admin/products", "POST", parsed.data);
      }

      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        if (error.fields) {
          const next: Record<string, string> = {};
          for (const [key, messages] of Object.entries(error.fields)) {
            if (messages[0]) next[key] = messages[0];
          }
          setFieldErrors(next);
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setSaving(false);
    }
  }

  const margin = liveMargin(values.sellingPrice, values.costPrice);

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {/* ---------------------------------------------------------- */}
      <Section title="Basics">
        <Field label="Product name" error={fieldErrors.name} htmlFor="name">
          <Input
            id="name"
            value={values.name}
            onChange={(event) => {
              const name = event.target.value;
              setValues((current) => ({
                ...current,
                name,
                // Keep the web address in step until it is edited by hand.
                slug:
                  !isEdit && (current.slug === "" || current.slug === slugify(current.name))
                    ? slugify(name)
                    : current.slug,
              }));
            }}
            placeholder="Kanjeevaram Silk Saree in Deep Maroon"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            htmlFor="code"
            hint={
              isEdit
                ? "Printed on the tag and scanned at the counter. Issued once and never changed, so labels already printed keep working."
                : "Issued automatically when you save, and printed on the tag. It is the only code this piece has."
            }
          >
            <Input
              id="code"
              readOnly
              value={values.code ?? "issued when you save"}
              className="font-mono select-all"
            />
          </Field>

          <Field
            label="Web address"
            error={fieldErrors.slug}
            htmlFor="slug"
            hint="Appears in the link customers see."
          >
            <Input
              id="slug"
              value={values.slug}
              onChange={(event) => set("slug", event.target.value)}
              placeholder="kanjeevaram-silk-saree-deep-maroon"
            />
          </Field>
        </div>

        <Field label="Category" error={fieldErrors.categoryId} htmlFor="category">
          <Select
            value={values.categoryId}
            onValueChange={(value) => set("categoryId", value)}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Description" error={fieldErrors.description} htmlFor="description">
          <Textarea
            id="description"
            rows={5}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="Fabric, weave, border, what it comes with…"
          />
        </Field>

        <Field
          label="Care instructions"
          error={fieldErrors.careInstructions}
          htmlFor="care"
          hint="Optional."
        >
          <Input
            id="care"
            value={values.careInstructions}
            onChange={(event) => set("careInstructions", event.target.value)}
            placeholder="Dry clean only."
          />
        </Field>

        <Field
          label="Silk Mark number"
          error={fieldErrors.silkMarkNumber}
          htmlFor="silk-mark"
          hint="Optional. The number on the Silk Mark hologram tag attached to this piece. Fill it in only for a piece that actually carries one — the badge on the shop is a certification claim, not a description of the fabric."
        >
          <Input
            id="silk-mark"
            value={values.silkMarkNumber}
            onChange={(event) => set("silkMarkNumber", event.target.value)}
            placeholder="e.g. 1234567"
          />
        </Field>

        <div className="flex flex-wrap gap-8">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={values.isActive}
              onCheckedChange={(checked) => set("isActive", checked)}
            />
            Visible in the shop
          </label>
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        title="Pricing"
        description="Cost price is never shown to customers — it is stored in a separate admin-only table."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field
            label="MRP (₹)"
            error={fieldErrors.mrp}
            htmlFor="mrp"
            hint="Leave MRP and selling price both blank to keep this piece off the shop. It stays in stock and in your inventory until you price it."
          >
            <Input
              id="mrp"
              inputMode="decimal"
              value={values.mrp}
              onChange={(event) => {
                const mrp = event.target.value;
                set("mrp", mrp);

                // Keep whichever of the other two the owner last worked from.
                // Discount is the one they usually think in, so it wins.
                const fromDiscount = sellingFromDiscount(mrp, discount);
                if (discount.trim() !== "" && fromDiscount !== null) {
                  set("sellingPrice", fromDiscount);
                } else {
                  setDiscount(discountFromSelling(mrp, values.sellingPrice) ?? "");
                }
              }}
              placeholder="12999"
            />
          </Field>

          <Field
            label="Discount (%)"
            htmlFor="discount"
            hint="Type this or the selling price — the other fills itself in. 0 means sell at the MRP."
          >
            <Input
              id="discount"
              inputMode="numeric"
              value={discount}
              onChange={(event) => {
                const next = event.target.value.replace(/[^\d]/g, "").slice(0, 3);
                setDiscount(next);

                const selling = sellingFromDiscount(values.mrp, next);
                if (selling !== null) set("sellingPrice", selling);
              }}
              placeholder="30"
            />
          </Field>

          <Field
            label="Selling price (₹)"
            error={fieldErrors.sellingPrice}
            htmlFor="sellingPrice"
            hint="What the customer pays."
          >
            <Input
              id="sellingPrice"
              inputMode="decimal"
              value={values.sellingPrice}
              onChange={(event) => {
                const selling = event.target.value;
                set("sellingPrice", selling);
                setDiscount(discountFromSelling(values.mrp, selling) ?? "");
              }}
              placeholder="8999"
            />
          </Field>

          <Field
            label="Cost price (₹)"
            error={fieldErrors.costPrice}
            htmlFor="costPrice"
            hint="What you paid."
          >
            <Input
              id="costPrice"
              inputMode="decimal"
              value={values.costPrice}
              onChange={(event) => set("costPrice", event.target.value)}
              placeholder="5500"
            />
          </Field>
        </div>

        {margin ? (
          <p className="text-sm">
            Profit per piece:{" "}
            <strong className="tabular-nums">{formatInr(margin.profit)}</strong>{" "}
            <span
              className={
                margin.percent < 20
                  ? "text-destructive"
                  : "text-emerald-700 dark:text-emerald-500"
              }
            >
              ({margin.percent}% margin)
            </span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Supplier" error={fieldErrors.supplierName} htmlFor="supplier" hint="Optional.">
            <Input
              id="supplier"
              value={values.supplierName}
              onChange={(event) => set("supplierName", event.target.value)}
              placeholder="Kumaran Silks, Kanchipuram"
            />
          </Field>

          <Field label="Purchase note" error={fieldErrors.purchaseNote} htmlFor="note" hint="Optional.">
            <Input
              id="note"
              value={values.purchaseNote}
              onChange={(event) => set("purchaseNote", event.target.value)}
              placeholder="Bulk rate for 10+ pieces"
            />
          </Field>
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section title="Photos">
        {fieldErrors.images ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.images}
          </p>
        ) : null}
        <ImageUploader images={values.images} onChange={(next) => set("images", next)} />
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        title="Stock"
        description="Every piece is one size, so there is nothing to choose and nothing to set up. One piece is created with the product, and this is how many of it you have."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How many in stock" error={fieldErrors.stockQty} htmlFor="stock">
            <Input
              id="stock"
              inputMode="numeric"
              value={String(values.stockQty)}
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(/\D/g, ""));
                set("stockQty", Number.isFinite(parsed) ? parsed : 0);
              }}
            />
          </Field>

        </div>

        {values.legacySizes && values.legacySizes.length > 0 ? (
          <Alert>
            <AlertDescription>
              <span className="font-medium">
                This product still has {values.legacySizes.length} extra{" "}
                {values.legacySizes.length === 1 ? "size" : "sizes"} from before the
                shop went one-size.
              </span>{" "}
              Only the first is on the shop; the stock below cannot be sold and is not
              edited here. Nothing has been deleted — these rows hold real stock and
              real history.
              <ul className="mt-2 space-y-0.5 font-mono text-xs">
                {values.legacySizes.map((extra) => (
                  <li key={extra.code}>
                    {extra.code} · size {extra.size} · {extra.stockQty} in stock
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        title="Colour"
        description="Each colour is its own product, because each is its own piece on the shelf with its own tag, cost, stock and photographs. Linking them lets a shopper switch between the colours from the product page."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="This colour"
            error={fieldErrors.colourName}
            htmlFor="colour"
            hint="Optional. Shown on the colour buttons, e.g. Royal Blue."
          >
            <Input
              id="colour"
              value={values.colourName}
              onChange={(event) => set("colourName", event.target.value)}
              placeholder="Royal Blue"
            />
          </Field>

          <div>
            <p className="mb-1 text-sm font-medium">Same design as</p>
            <DesignPicker
              value={values.sameDesignAsProductId}
              alreadyLinked={values.otherColours ?? []}
              excludeProductId={values.id}
              onChange={(next) => set("sameDesignAsProductId", next)}
            />
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- */}
      <Section
        title="Attributes"
        description="These become filters in the shop. Add a new option here and it appears for customers straight away."
      >
        <AttributePicker
          attributes={attributes}
          selectedIds={values.attributeValueIds}
          onChange={(next) => set("attributeValueIds", next)}
        />
      </Section>

      <div className="flex gap-3 border-t pt-6">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : isEdit ? (
            "Save changes"
          ) : (
            "Create product"
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => router.push("/admin/products")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border bg-background p-5">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * MRP, discount and selling price: give any two, get the third.
 *
 * The owner prices either way round — "₹12,999 at 30% off" or "₹12,999, sell
 * at ₹8,999" — so whichever is typed second fills in the other. A discount of
 * 0 is meaningful: sell at the MRP, with no badge on the shop.
 *
 * Only the selling price is saved. The discount is recomputed from the two
 * prices wherever it is shown, so it cannot drift out of step with them.
 */
const MONEY_RE = /^\d{1,8}(\.\d{1,2})?$/;

function moneyToPaise(value: string): number | null {
  if (!MONEY_RE.test(value.trim())) return null;
  const [whole, fraction = "0"] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function paiseToMoney(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, "0")}`;
}

/** Selling price from an MRP and a whole-percent discount. */
function sellingFromDiscount(mrp: string, discount: string): string | null {
  const mrpPaise = moneyToPaise(mrp);
  const trimmed = discount.trim();
  const percent = Number(trimmed);

  if (mrpPaise === null || trimmed === "" || !Number.isFinite(percent)) return null;

  // 100 is refused rather than computed. It would set the selling price to
  // zero, which the shop would happily publish and sell for nothing — and it
  // is far more likely to be a slipped keystroke than a gift. Typing a selling
  // price of 0 directly is still possible for anyone who truly means it.
  if (percent < 0 || percent >= 100) return null;

  return paiseToMoney(Math.round(mrpPaise * (1 - percent / 100)));
}

/** Whole-percent discount from an MRP and a selling price. */
function discountFromSelling(mrp: string, sellingPrice: string): string | null {
  const mrpPaise = moneyToPaise(mrp);
  const sellingPaise = moneyToPaise(sellingPrice);

  if (mrpPaise === null || sellingPaise === null || mrpPaise <= 0) return null;
  if (sellingPaise > mrpPaise) return null;

  return String(Math.round(((mrpPaise - sellingPaise) / mrpPaise) * 100));
}

/** Profit and margin, computed in integer paise so nothing rounds via float. */
function liveMargin(
  sellingPrice: string,
  costPrice: string,
): { profit: string; percent: number } | null {
  const money = /^\d{1,8}(\.\d{1,2})?$/;
  if (!money.test(sellingPrice.trim()) || !money.test(costPrice.trim())) return null;

  const toPaise = (value: string) => {
    const [whole, fraction = "0"] = value.trim().split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  };

  const selling = toPaise(sellingPrice);
  const cost = toPaise(costPrice);
  if (selling <= 0) return null;

  const profitPaise = selling - cost;
  const profit = `${Math.trunc(profitPaise / 100)}.${String(Math.abs(profitPaise) % 100).padStart(2, "0")}`;

  return { profit, percent: Math.round((profitPaise / selling) * 100) };
}
