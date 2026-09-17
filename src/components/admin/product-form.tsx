"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AttributePicker,
  type PickerAttribute,
} from "@/components/admin/attribute-picker";
import { ImageUploader, type EditableImage } from "@/components/admin/image-uploader";
import {
  VariantEditor,
  type EditableVariant,
} from "@/components/admin/variant-editor";
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
  sku: string;
  description: string;
  categoryId: string;
  mrp: string;
  sellingPrice: string;
  costPrice: string;
  supplierName: string;
  purchaseNote: string;
  isReadymade: boolean;
  isActive: boolean;
  careInstructions: string;
  images: EditableImage[];
  variants: EditableVariant[];
  attributeValueIds: string[];
};

const BLANK: ProductFormValues = {
  name: "",
  slug: "",
  sku: "",
  description: "",
  categoryId: "",
  mrp: "",
  sellingPrice: "",
  costPrice: "",
  supplierName: "",
  purchaseNote: "",
  isReadymade: false,
  isActive: true,
  careInstructions: "",
  images: [],
  variants: [],
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
          <Field label="Product code (SKU)" error={fieldErrors.sku} htmlFor="sku">
            <Input
              id="sku"
              value={values.sku}
              onChange={(event) => set("sku", event.target.value.toUpperCase())}
              placeholder="SR-KJV-001"
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

        <div className="flex flex-wrap gap-8">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={values.isReadymade}
              onCheckedChange={(checked) => set("isReadymade", checked)}
            />
            Readymade (stitched)
          </label>

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
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="MRP (₹)" error={fieldErrors.mrp} htmlFor="mrp">
            <Input
              id="mrp"
              inputMode="decimal"
              value={values.mrp}
              onChange={(event) => set("mrp", event.target.value)}
              placeholder="12999"
            />
          </Field>

          <Field
            label="Selling price (₹)"
            error={fieldErrors.sellingPrice}
            htmlFor="sellingPrice"
          >
            <Input
              id="sellingPrice"
              inputMode="decimal"
              value={values.sellingPrice}
              onChange={(event) => set("sellingPrice", event.target.value)}
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
        title="Sizes and stock"
        description="Customers must pick a size before adding to their bag, so every product needs at least one."
      >
        {fieldErrors.variants ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldErrors.variants}
          </p>
        ) : null}
        <VariantEditor
          variants={values.variants}
          productSku={values.sku}
          defaultPrice={values.sellingPrice}
          onChange={(next) => set("variants", next)}
        />
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
