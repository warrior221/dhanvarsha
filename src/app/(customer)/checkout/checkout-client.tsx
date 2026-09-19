"use client";

import { Check, Loader2, Plus } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AddressForm } from "@/components/checkout/address-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ApiError, requestJson } from "@/lib/api-client";
import type { CartView } from "@/lib/cart";
import { formatInr } from "@/lib/format";
import type { AddressView } from "@/lib/queries/address";
import type { OrderTotals } from "@/lib/queries/checkout";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Cash-on-delivery checkout.
 *
 * Card and UPI payment (Razorpay) is not wired up yet, so COD is the only
 * method offered rather than showing a option that cannot complete.
 *
 * Before the order is placed, a code is emailed and must be entered. That is
 * spec section 7's COD confirmation step — it exists because an unconfirmed
 * COD order commits real stock to someone who may never have ordered it.
 */
export function CheckoutClient({
  addresses,
  cart,
  totals,
}: {
  addresses: AddressView[];
  cart: CartView;
  totals: OrderTotals;
}) {
  const router = useRouter();
  const refreshCart = useCartStore((state) => state.refresh);

  const [list, setList] = useState(addresses);
  const [selectedId, setSelectedId] = useState(
    addresses.find((address) => address.isDefault)?.id ?? addresses[0]?.id ?? "",
  );
  const [showForm, setShowForm] = useState(addresses.length === 0);

  const [codeSent, setCodeSent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (!selectedId) {
      setError("Choose a delivery address first.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await requestJson<{ message: string; sentTo: string }>(
        "/api/otp/send",
        "POST",
        { identifier: "cod", purpose: "COD_CONFIRMATION" },
      );
      setCodeSent(true);
      setSentTo(result.sentTo);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const order = await requestJson<{ orderNumber: string; total: string }>(
        "/api/checkout/cod",
        "POST",
        { addressId: selectedId, code: code.trim() },
      );

      // The bag is now an order; keep the badge honest.
      void refreshCart();
      router.push(`/account/orders/${order.orderNumber}?placed=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not place that order.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {/* ------------------------- address ------------------------- */}
        <section className="space-y-4 rounded-lg border bg-background p-5">
          <h2 className="text-lg font-medium">Delivery address</h2>

          {list.length > 0 ? (
            <ul className="space-y-2">
              {list.map((address) => (
                <li key={address.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-md border p-3 text-sm transition",
                      selectedId === address.id
                        ? "border-foreground bg-muted/50"
                        : "hover:border-foreground/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mt-1"
                      checked={selectedId === address.id}
                      onChange={() => setSelectedId(address.id)}
                    />
                    <span>
                      <span className="font-medium">{address.fullName}</span>
                      {address.isDefault ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                          Default
                        </span>
                      ) : null}
                      <br />
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                      <br />
                      {address.city}, {address.state} {address.pincode}
                      <br />
                      <span className="text-muted-foreground">
                        Phone {address.phone}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}

          {showForm ? (
            <div className="rounded-md border p-4">
              <h3 className="mb-3 text-sm font-medium">New address</h3>
              <AddressForm
                onSaved={(saved) => {
                  setList((current) => {
                    // A saved default demotes the others in the list too.
                    const others = current
                      .filter((a) => a.id !== saved.id)
                      .map((a) => (saved.isDefault ? { ...a, isDefault: false } : a));
                    return [...others, saved];
                  });
                  setSelectedId(saved.id);
                  setShowForm(false);
                }}
                onCancel={list.length > 0 ? () => setShowForm(false) : undefined}
              />
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="size-4" aria-hidden />
              Add a new address
            </Button>
          )}
        </section>

        {/* ------------------------- payment ------------------------- */}
        <section className="space-y-3 rounded-lg border bg-background p-5">
          <h2 className="text-lg font-medium">Payment</h2>

          <div className="rounded-md border border-foreground bg-muted/50 p-3 text-sm">
            <p className="font-medium">Cash on delivery</p>
            <p className="text-muted-foreground">
              Pay the courier when your order arrives.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Card, UPI and netbanking will appear here once online payment is set
            up.
          </p>
        </section>

        {/* ---------------------- confirmation ----------------------- */}
        <section className="space-y-4 rounded-lg border bg-background p-5">
          <h2 className="text-lg font-medium">Confirm your order</h2>

          {!codeSent ? (
            <>
              <p className="text-sm text-muted-foreground">
                We will email you a 6-digit code to confirm this cash-on-delivery
                order.
              </p>
              <Button
                type="button"
                disabled={busy || !selectedId}
                onClick={() => void sendCode()}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  "Email me a confirmation code"
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="cod-code">6-digit code</Label>
                <Input
                  id="cod-code"
                  value={code}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="max-w-40 text-center text-lg tracking-[0.4em]"
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Sent to {sentTo}. The code expires in 10 minutes.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={busy || code.length !== 6}
                  onClick={() => void placeOrder()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Placing order…
                    </>
                  ) : (
                    <>
                      <Check className="size-4" aria-hidden />
                      Place order · {totals.totalFormatted}
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || cooldown > 0}
                  onClick={() => void sendCode()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </Button>
              </div>
            </>
          )}

          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </section>
      </div>

      {/* ------------------------- summary ------------------------- */}
      <aside className="space-y-4 self-start rounded-lg border bg-background p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-medium">Your order</h2>

        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li key={item.variantId} className="flex gap-3 text-sm">
              <div className="relative size-14 shrink-0 overflow-hidden rounded bg-muted">
                {item.product.image ? (
                  <Image
                    src={item.product.image.url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.size ? `Size ${item.size} · ` : ""}Qty {item.quantity}
                </p>
              </div>
              <p className="shrink-0 tabular-nums">{formatInr(item.lineTotal)}</p>
            </li>
          ))}
        </ul>

        <Separator />

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{totals.subtotalFormatted}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Delivery
              {totals.shippingRuleName ? (
                <span className="block text-xs">{totals.shippingRuleName}</span>
              ) : null}
            </dt>
            <dd className="tabular-nums">{totals.shippingFormatted}</dd>
          </div>
          {totals.codFeeFormatted ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Cash-on-delivery fee
                <span className="block text-xs">Handling charge for paying in cash</span>
              </dt>
              <dd className="tabular-nums">{totals.codFeeFormatted}</dd>
            </div>
          ) : null}
        </dl>

        {totals.freeShippingGap ? (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Spend {totals.freeShippingGap.amountFormatted} more for{" "}
            {totals.freeShippingGap.ruleName.toLowerCase()}.
          </p>
        ) : null}

        <Separator />

        <div className="flex items-baseline justify-between">
          <p className="font-medium">Total</p>
          <p className="text-xl font-semibold tabular-nums">{totals.totalFormatted}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Prices include GST. Payable in cash on delivery.
        </p>
      </aside>
    </div>
  );
}
