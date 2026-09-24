import { orderStatusLabel } from "@/components/shared/order-status-badge";
import type { OrderStatus } from "@prisma/client";
import type { Receipt } from "@/lib/queries/receipt";

/**
 * A printable receipt for one order.
 *
 * ONE component, used by both the customer and the admin, on purpose. The
 * shopkeeper's copy has to be the same document the customer holds, or the
 * two cannot be reconciled over the phone. It carries no cost price and no
 * margin — those belong on the order screen, not on a piece of paper going
 * into a parcel.
 *
 * Printing is the browser's own: every phone and desktop can already save a
 * page as PDF, which is a better answer than generating one server-side and
 * far better than a library that has to be kept alive for years.
 */
export function OrderReceipt({ receipt }: { receipt: Receipt }) {
  const placed = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(receipt.placedAt));

  return (
    <article className="mx-auto max-w-2xl rounded-lg border bg-background p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-primary">
            {receipt.shop.name.toUpperCase()}
          </p>
          {receipt.shop.legalName ? (
            <p className="text-sm text-muted-foreground">{receipt.shop.legalName}</p>
          ) : null}
          {receipt.shop.gstin ? (
            <p className="text-xs text-muted-foreground">GSTIN {receipt.shop.gstin}</p>
          ) : null}
        </div>

        <div className="text-right">
          <h1 className="text-lg font-semibold">Receipt</h1>
          <p className="font-mono text-sm">{receipt.orderNumber}</p>
          <p className="text-xs text-muted-foreground">{placed}</p>
        </div>
      </header>

      <div className="grid gap-6 border-b py-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Billed to
          </h2>
          <p className="text-sm font-medium">{receipt.customer.name}</p>
          {receipt.customer.email ? (
            <p className="text-sm text-muted-foreground">{receipt.customer.email}</p>
          ) : null}
          {receipt.customer.phone ? (
            <p className="text-sm text-muted-foreground">{receipt.customer.phone}</p>
          ) : null}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Delivered to
          </h2>
          <address className="text-sm not-italic">
            {receipt.address.fullName}
            <br />
            {receipt.address.line1}
            {receipt.address.line2 ? (
              <>
                <br />
                {receipt.address.line2}
              </>
            ) : null}
            <br />
            {receipt.address.city}, {receipt.address.state} {receipt.address.pincode}
            <br />
            Phone {receipt.address.phone}
          </address>
        </section>
      </div>

      <table className="w-full border-b py-6 text-sm">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 font-medium">
              Item
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Price
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Qty
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((line, index) => (
            <tr key={index} className="border-b last:border-0">
              <td className="py-3 pr-2">
                {line.productName}
                {line.size ? (
                  <span className="block text-xs text-muted-foreground">
                    Size {line.size}
                  </span>
                ) : null}
              </td>
              <td className="py-3 text-right tabular-nums">{line.unitFormatted}</td>
              <td className="py-3 text-right tabular-nums">{line.quantity}</td>
              <td className="py-3 text-right tabular-nums">{line.lineTotalFormatted}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-6 max-w-xs space-y-2 text-sm">
        <Row label="Subtotal" value={receipt.subtotalFormatted} />
        <Row label="Delivery" value={receipt.shippingFormatted} />
        {receipt.taxFormatted ? (
          <Row
            label={receipt.taxIncluded ? "Includes GST" : "GST"}
            value={receipt.taxFormatted}
          />
        ) : null}
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{receipt.totalFormatted}</dd>
        </div>
      </dl>

      <footer className="mt-8 border-t pt-6 text-sm text-muted-foreground">
        <p>
          {receipt.paymentMethod === "COD"
            ? "Paid in cash on delivery."
            : "Paid online."}{" "}
          Status: {orderStatusLabel(receipt.status as OrderStatus)}.
        </p>

        {receipt.courierName && receipt.trackingNumber ? (
          <p className="mt-1">
            Shipped with {receipt.courierName} · tracking{" "}
            <span className="font-mono">{receipt.trackingNumber}</span>
          </p>
        ) : null}

        <p className="mt-4">Thank you for shopping with {receipt.shop.name}.</p>
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
