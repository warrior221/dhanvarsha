import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/shop/policy-page";
import { SHOP } from "@/lib/shop-details";

export const metadata: Metadata = {
  title: "Refunds and cancellations",
  description:
    "When Dhanvarsha replaces or refunds an order, and how to cancel before dispatch.",
};

/**
 * Stated plainly, and early.
 *
 * This shop does not take change-of-mind returns. A customer is entitled to
 * know that BEFORE they pay, not to discover it in small print afterwards, so
 * the summary line says it outright.
 */
export default function RefundPolicyPage() {
  return (
    <PolicyPage
      title="Refunds and cancellations"
      summary="We replace or refund a piece that arrives damaged or is not what you ordered. We do not accept returns for change of mind."
    >
      <PolicySection heading="What we will put right">
        <p>We will replace or refund your order if:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>the piece arrives torn, stained or otherwise damaged</li>
          <li>you receive a different piece from the one you ordered</li>
          <li>the parcel is short of something listed on your receipt</li>
        </ul>
        <p>
          In each case you get the choice: the same piece again if we still
          have it, or your money back in full, including what you paid for
          delivery.
        </p>
      </PolicySection>

      <PolicySection heading="What we cannot take back">
        <p>
          We do not accept returns because a piece was not what you hoped for —
          a colour that looked different on screen, a fabric that felt
          different in hand, or a change of plan.
        </p>
        <p>
          This is not meanness. Each design is held in one or two pieces, and a
          saree that has been unfolded, worn to a function and sent back cannot
          be sold to anyone else. Keeping this rule is what lets us price the
          way we do.
        </p>
        <p>
          Please read the description and look at every photograph before
          ordering, and write to {SHOP.supportEmail} if you want more pictures
          or a closer look at the weave. We would far rather answer questions
          first than disappoint you later.
        </p>
      </PolicySection>

      <PolicySection heading="Handloom is not a factory product">
        <p>
          Slight irregularities in weave, small variations in zari, and minor
          differences in shade between one piece and the photograph are normal
          in handloom silk. They are marks of how the cloth was made, not
          faults, and are not grounds for a refund.
        </p>
        <p>
          A tear, a stain or a genuine defect is a different matter, and is
          covered above.
        </p>
      </PolicySection>

      <PolicySection heading="How to report a problem">
        <p>
          Write to {SHOP.supportEmail} within{" "}
          <strong className="text-foreground">{SHOP.reportProblemHours} hours</strong>{" "}
          of delivery, with:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>your order number</li>
          <li>photographs showing the damage or the wrong item</li>
          <li>a photograph of the parcel and its label, if it arrived damaged</li>
        </ul>
        <p>
          Please keep the piece, its packaging and any tags until the matter is
          settled. We may ask you to send it back, and we pay the return
          postage when the fault is ours.
        </p>
      </PolicySection>

      <PolicySection heading="Cancelling an order">
        <p>
          You can cancel free of charge any time before your order is
          dispatched — write to {SHOP.supportEmail} with your order number, or
          ask from{" "}
          <Link
            href="/account/orders"
            className="font-medium text-foreground underline underline-offset-4"
          >
            your orders
          </Link>
          . If you paid online, the full amount goes back to you.
        </p>
        <p>
          Once a parcel has left us it cannot be cancelled. Refusing delivery
          is not a cancellation; the piece comes back to us having travelled
          twice, and the sections above still apply.
        </p>
      </PolicySection>

      <PolicySection heading="When you get your money">
        <p>
          Approved refunds are sent within {SHOP.refundBusinessDaysMin}–
          {SHOP.refundBusinessDaysMax} business days of us agreeing them.
        </p>
        <p>
          Money paid online goes back to the card, UPI app or account you paid
          from. Your bank may take a few days more to show it. For a cash on
          delivery order there is nothing to reverse, so we ask for your bank
          details and transfer it.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
