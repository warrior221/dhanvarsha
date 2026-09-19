"use client";

import { OrderStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestJson } from "@/lib/api-client";
import {
  ALLOWED_TRANSITIONS,
  TRANSITION_LABEL,
  isTerminal,
  requiresTracking,
  restoresStock,
} from "@/lib/order-status";

/**
 * Advances an order through its lifecycle.
 *
 * Only the transitions the rules actually allow are offered, using the same
 * pure module the server enforces with — so the buttons cannot drift out of
 * step with what the API will accept.
 */
export function OrderStatusControl({
  orderId,
  status,
  courierName,
  trackingNumber,
}: {
  orderId: string;
  status: OrderStatus;
  courierName: string | null;
  trackingNumber: string | null;
}) {
  const router = useRouter();
  const [pendingTo, setPendingTo] = useState<OrderStatus | null>(null);
  const [courier, setCourier] = useState(courierName ?? "");
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = ALLOWED_TRANSITIONS[status];

  async function apply(to: OrderStatus) {
    setBusy(true);
    setError(null);

    try {
      await requestJson(`/api/admin/orders/${orderId}/status`, "POST", {
        to,
        courierName: requiresTracking(to) ? courier : undefined,
        trackingNumber: requiresTracking(to) ? tracking : undefined,
        note: note || undefined,
      });

      setPendingTo(null);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Status</h2>
        <OrderStatusBadge status={status} />
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isTerminal(status) ? (
        <p className="text-sm text-muted-foreground">
          This order is closed. No further changes are possible.
        </p>
      ) : pendingTo ? (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium">{TRANSITION_LABEL[pendingTo]}</p>

          {requiresTracking(pendingTo) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="courier">Courier</Label>
                <Input
                  id="courier"
                  value={courier}
                  placeholder="Delhivery, Blue Dart…"
                  onChange={(event) => setCourier(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tracking">Tracking number</Label>
                <Input
                  id="tracking"
                  value={tracking}
                  placeholder="ABC123456789"
                  onChange={(event) => setTracking(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {restoresStock(pendingTo) ? (
            <p className="rounded-md bg-muted p-3 text-sm">
              Cancelling puts every item on this order back into stock.
            </p>
          ) : null}

          {pendingTo === OrderStatus.RETURNED ? (
            <p className="rounded-md bg-muted p-3 text-sm">
              A return does <strong>not</strong> add stock back automatically —
              returned pieces may not be resellable. Adjust stock yourself on the
              Inventory page if they are.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              value={note}
              placeholder="Anything worth recording on the order history"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              disabled={
                busy ||
                (requiresTracking(pendingTo) && (!courier.trim() || !tracking.trim()))
              }
              onClick={() => void apply(pendingTo)}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                `Confirm: ${TRANSITION_LABEL[pendingTo].toLowerCase()}`
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setPendingTo(null)}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((to) => (
            <Button
              key={to}
              type="button"
              variant={to === OrderStatus.CANCELLED ? "outline" : "default"}
              className={
                to === OrderStatus.CANCELLED
                  ? "text-destructive hover:text-destructive"
                  : undefined
              }
              onClick={() => setPendingTo(to)}
            >
              {TRANSITION_LABEL[to]}
            </Button>
          ))}
        </div>
      )}

      {courierName && trackingNumber ? (
        <p className="text-sm text-muted-foreground">
          Shipped with {courierName} · <span className="font-mono">{trackingNumber}</span>
        </p>
      ) : null}
    </div>
  );
}
