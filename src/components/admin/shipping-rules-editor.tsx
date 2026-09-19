"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, requestJson } from "@/lib/api-client";
import type { ShippingRuleRow } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";

/**
 * Delivery charges.
 *
 * Checkout picks the rule with the HIGHEST starting amount the basket reaches,
 * so "free over ₹2,000" naturally beats "₹99 from ₹0". That is stated on the
 * screen rather than left to be inferred, because getting it backwards would
 * quietly cost the shop money on every order.
 */

type Draft = {
  id: string | null;
  name: string;
  minSubtotal: string;
  charge: string;
  codExtraCharge: string;
  isActive: boolean;
};

const BLANK: Draft = {
  id: null,
  name: "",
  minSubtotal: "0",
  charge: "0",
  codExtraCharge: "0",
  isActive: true,
};

export function ShippingRulesEditor({ initial }: { initial: ShippingRuleRow[] }) {
  const [rules, setRules] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!draft) return;

    setBusy(true);
    setError(null);

    const body = {
      name: draft.name.trim(),
      minSubtotal: draft.minSubtotal.trim(),
      charge: draft.charge.trim(),
      codExtraCharge: draft.codExtraCharge.trim(),
      isActive: draft.isActive,
    };

    try {
      const result = await requestJson<{ rules: ShippingRuleRow[] }>(
        draft.id ? `/api/admin/shipping-rules/${draft.id}` : "/api/admin/shipping-rules",
        draft.id ? "PUT" : "POST",
        body,
      );

      setRules(result.rules);
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save that rule.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(rule: ShippingRuleRow) {
    setBusy(true);
    setError(null);

    try {
      const result = await requestJson<{ rules: ShippingRuleRow[] }>(
        `/api/admin/shipping-rules/${rule.id}`,
        "DELETE",
      );

      setRules(result.rules);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Delivery charges</h2>
          <p className="text-sm text-muted-foreground">
            The rule with the highest starting amount the basket reaches is the
            one that applies.
          </p>
        </div>

        {draft === null ? (
          <Button type="button" variant="outline" onClick={() => setDraft(BLANK)}>
            <Plus className="size-4" aria-hidden />
            Add a rule
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {rules.length === 0 ? (
        <p className="rounded-md bg-muted p-4 text-sm">
          No rules yet, so delivery is currently <strong>free on every order</strong>.
          Add a rule to start charging.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Applies from</TableHead>
              <TableHead className="text-right">Delivery</TableHead>
              <TableHead className="text-right">Extra for cash</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id} className={cn(!rule.isActive && "opacity-55")}>
                <TableCell>
                  <p className="font-medium">{rule.name}</p>
                  {!rule.isActive ? (
                    <p className="text-xs text-muted-foreground">Turned off</p>
                  ) : null}
                </TableCell>
                <TableCell className="tabular-nums">
                  {rule.minSubtotalFormatted}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {rule.chargeFormatted}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {rule.codExtraChargeFormatted}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={`Edit ${rule.name}`}
                      onClick={() =>
                        setDraft({
                          id: rule.id,
                          name: rule.name,
                          minSubtotal: rule.minSubtotal,
                          charge: rule.charge,
                          codExtraCharge: rule.codExtraCharge,
                          isActive: rule.isActive,
                        })
                      }
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={`Delete ${rule.name}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => void remove(rule)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {draft ? (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium">
            {draft.id ? "Edit rule" : "New rule"}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ruleName">What customers see</Label>
              <Input
                id="ruleName"
                value={draft.name}
                placeholder="Free delivery over ₹2,000"
                onChange={(event) => set("name", event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minSubtotal">Applies from (₹)</Label>
              <Input
                id="minSubtotal"
                inputMode="decimal"
                value={draft.minSubtotal}
                placeholder="2000"
                onChange={(event) => set("minSubtotal", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use 0 for the rule that covers small baskets.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="charge">Delivery charge (₹)</Label>
              <Input
                id="charge"
                inputMode="decimal"
                value={draft.charge}
                placeholder="0"
                onChange={(event) => set("charge", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">0 means free.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="codExtraCharge">Extra for cash on delivery (₹)</Label>
              <Input
                id="codExtraCharge"
                inputMode="decimal"
                value={draft.codExtraCharge}
                placeholder="50"
                onChange={(event) => set("codExtraCharge", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shown to the customer on its own line.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="ruleActive"
              checked={draft.isActive}
              onCheckedChange={(checked) => set("isActive", checked)}
            />
            <Label htmlFor="ruleActive" className="cursor-pointer">
              Rule is on
            </Label>
          </div>

          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save rule"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
