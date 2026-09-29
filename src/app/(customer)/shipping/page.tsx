import type { Metadata } from "next";
import { PolicyPage, PolicySection } from "@/components/shop/policy-page";
import { db } from "@/lib/db";
import { formatInr, toPaise } from "@/lib/format";
import { SHOP } from "@/lib/shop-details";

export const metadata: Metadata = {
  title: "Shipping policy",
  description: "How and when Dhanvarsha dispatches and delivers orders in India.",
};

/**
 * The delivery charges are READ FROM THE SAME TABLE CHECKOUT USES.
 *
 * A shipping page with the numbers typed into it is a page that starts lying
 * the first time the shop changes a rate. Here, changing the charge in the
 * admin changes this page too.
 */
export default async function ShippingPolicyPage() {
  const rules = await db.shippingRule.findMany({ orderBy: { minSubtotal: "asc" } });

  return (
    <PolicyPage
      title="Shipping policy"
      summary={`We dispatch within ${SHOP.dispatchBusinessDays} business days and deliver across India.`}
    >
      <PolicySection heading="Where we deliver">
        <p>
          We deliver anywhere in India. We do not ship outside India at present.
        </p>
      </PolicySection>

      <PolicySection heading="When your order is dispatched">
        <p>
          Orders are handed to the courier within{" "}
          <strong className="text-foreground">
            {SHOP.dispatchBusinessDays} business days
          </strong>{" "}
          of being placed. Some pieces are finished to order — a fall and pico,
          or a blouse piece cut to match — which is why we allow that long
          rather than promise next-day and miss it.
        </p>
        <p>
          Business days do not include Sundays or public holidays. During
          wedding season and around festivals, dispatch can take the full
          window.
        </p>
      </PolicySection>

      <PolicySection heading="How long delivery takes">
        <p>
          Once dispatched, delivery usually takes{" "}
          {SHOP.deliveryBusinessDaysMin}–{SHOP.deliveryBusinessDaysMax} business
          days, depending on where you are. Metro cities are at the shorter end;
          smaller towns and hill or island addresses can take longer.
        </p>
        <p>
          We email you the courier&rsquo;s name and your tracking number as soon
          as the parcel leaves us.
        </p>
      </PolicySection>

      <PolicySection heading="Delivery charges">
        <ul className="ml-4 list-disc space-y-1.5">
          {rules.map((rule, index) => {
            // Each rule covers from its own minimum up to the next one's.
            // The last covers everything above it.
            const next = rules[index + 1];
            const band = next
              ? `Orders under ${formatInr(next.minSubtotal.toString())}`
              : `Orders of ${formatInr(rule.minSubtotal.toString())} and above`;
            const charge = toPaise(rule.charge.toString());
            const cod = toPaise(rule.codExtraCharge.toString());

            return (
              <li key={rule.id}>
                {band}:{" "}
                <strong className="text-foreground">
                  {charge === 0 ? "free delivery" : `${formatInr(rule.charge.toString())} delivery`}
                </strong>
                {cod > 0
                  ? `, plus ${formatInr(rule.codExtraCharge.toString())} if you pay cash on delivery`
                  : null}
              </li>
            );
          })}
        </ul>
        <p>
          The exact charge for your order is shown at checkout before you
          confirm anything.
        </p>
      </PolicySection>

      <PolicySection heading="If delivery fails">
        <p>
          The courier phones ahead, which is why we ask for a mobile number.
          Please make sure the address and number you give us are complete and
          correct — a wrong pincode or an unanswered phone is the most common
          reason a parcel comes back to us.
        </p>
        <p>
          If a parcel is returned to us undelivered, we will contact you to
          arrange re-delivery. Re-delivery is charged again at the rate above.
        </p>
      </PolicySection>

      <PolicySection heading="If your parcel is late or missing">
        <p>
          Write to {SHOP.supportEmail} with your order number and we will chase
          the courier on your behalf. Please allow the full delivery window
          above before treating a parcel as late.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
