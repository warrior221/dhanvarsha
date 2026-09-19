"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError, requestJson } from "@/lib/api-client";
import { formatInr } from "@/lib/format";
import { computeTax, toBasisPoints } from "@/lib/tax";
import type { TaxSettings } from "@/lib/tax";

/**
 * GST settings.
 *
 * The worked example underneath is the point of this screen: "inclusive" and
 * "exclusive" are accounting words, and the owner should be able to see what
 * each one does to a real ₹2,199 saree before saving.
 */
export function TaxSettingsForm({ initial }: { initial: TaxSettings }) {
  const [gstRate, setGstRate] = useState(initial.gstRate);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(initial.pricesIncludeTax);
  const [gstin, setGstin] = useState(initial.gstin ?? "");
  const [legalName, setLegalName] = useState(initial.legalName ?? "");

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    setFieldErrors({});

    try {
      await requestJson<TaxSettings>("/api/admin/settings/tax", "PUT", {
        gstRate: gstRate.trim(),
        pricesIncludeTax,
        gstin: gstin.trim(),
        legalName: legalName.trim(),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const flat: Record<string, string> = {};
        for (const [key, messages] of Object.entries(err.fields ?? {})) {
          if (messages[0]) flat[key] = messages[0];
        }
        setFieldErrors(flat);
      } else {
        setError("Could not save those settings.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-lg border bg-background p-5">
      <div>
        <h2 className="text-lg font-medium">GST</h2>
        <p className="text-sm text-muted-foreground">
          How tax is recorded on every new order. Existing orders keep the
          figures they were placed with.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gstRate">GST rate (%)</Label>
          <Input
            id="gstRate"
            inputMode="decimal"
            value={gstRate}
            placeholder="5"
            onChange={(event) => setGstRate(event.target.value)}
          />
          {fieldErrors.gstRate ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldErrors.gstRate}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Leave at 0 until your accountant confirms the rate.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input
            id="gstin"
            value={gstin}
            placeholder="27ABCDE1234F1Z5"
            onChange={(event) => setGstin(event.target.value.toUpperCase())}
          />
          {fieldErrors.gstin ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldErrors.gstin}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Optional until you are registered.
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="legalName">Registered business name</Label>
          <Input
            id="legalName"
            value={legalName}
            placeholder="Dhanvarsha Sarees"
            onChange={(event) => setLegalName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Printed on invoices. Optional.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border p-4">
        <Switch
          id="pricesIncludeTax"
          checked={pricesIncludeTax}
          onCheckedChange={setPricesIncludeTax}
        />
        <div className="space-y-1">
          <Label htmlFor="pricesIncludeTax" className="cursor-pointer">
            My prices already include GST
          </Label>
          <p className="text-sm text-muted-foreground">
            {pricesIncludeTax
              ? "The price on the tag is what the customer pays. GST is worked backwards out of it for your records."
              : "GST is added on top at checkout, so the customer pays more than the listed price."}
          </p>
        </div>
      </div>

      <WorkedExample gstRate={gstRate} inclusive={pricesIncludeTax} />

      <Button type="button" disabled={busy} onClick={() => void save()}>
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : saved ? (
          <>
            <Check className="size-4" aria-hidden />
            Saved
          </>
        ) : (
          "Save GST settings"
        )}
      </Button>
    </section>
  );
}

/** A real ₹2,199 saree, run through whichever setting is selected. */
function WorkedExample({
  gstRate,
  inclusive,
}: {
  gstRate: string;
  inclusive: boolean;
}) {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(gstRate.trim())) return null;

  const EXAMPLE_PAISE = 219_900;
  const breakdown = computeTax(
    EXAMPLE_PAISE,
    toBasisPoints(gstRate.trim()),
    inclusive,
  );

  const rupees = (paise: number) => formatInr((paise / 100).toFixed(2));

  return (
    <div className="rounded-md bg-muted p-4 text-sm" aria-live="polite">
      <p className="mb-2 font-medium">On a saree listed at ₹2,199</p>
      <dl className="space-y-1">
        <Row label="Goods value" value={rupees(breakdown.netPaise)} />
        <Row label="GST" value={rupees(breakdown.taxPaise)} />
        <Row
          label="Customer pays"
          value={rupees(breakdown.grossPaise)}
          strong
        />
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {inclusive
          ? "The customer still pays ₹2,199 — only the split changes."
          : "The customer pays more than the listed ₹2,199."}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between ${strong ? "border-t pt-1 font-medium" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
