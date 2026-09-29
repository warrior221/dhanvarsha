import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/shop/policy-page";
import { getTaxSettings } from "@/lib/queries/settings";
import { SHOP } from "@/lib/shop-details";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "The terms on which Dhanvarsha sells.",
};

export default async function TermsPage() {
  // The registered name and GSTIN are set in Settings once the business is
  // registered. Naming the trading name alone until then is honest; inventing
  // a registration number would not be.
  const tax = await getTaxSettings();

  return (
    <PolicyPage
      title="Terms and conditions"
      summary={`The terms on which ${SHOP.name} sells. By placing an order you accept them.`}
    >
      <PolicySection heading="Who you are buying from">
        <p>
          {SHOP.name} {SHOP.tagline}
          {tax.legalName ? `, trading as ${tax.legalName}` : ""}, based in{" "}
          {SHOP.jurisdictionCity}, {SHOP.jurisdictionState}, India.
        </p>
        {tax.gstin ? <p>GSTIN {tax.gstin}</p> : null}
        <p>Contact: {SHOP.supportEmail}</p>
      </PolicySection>

      <PolicySection heading="Placing an order">
        <p>
          Adding a piece to your bag and paying is an offer to buy. The sale is
          made when we confirm your order — not at the moment of payment.
        </p>
        <p>
          We may decline an order. The usual reason is that the last piece of a
          design has just sold, or that a delivery address is one we cannot
          reach. If we decline after you have paid, you get your money back in
          full.
        </p>
      </PolicySection>

      <PolicySection heading="Stock">
        <p>
          Most designs here are held in one or two pieces. The shop shows what
          is left, but two people can reach the last saree within moments of
          each other. If that happens we will tell you at once and refund you.
        </p>
      </PolicySection>

      <PolicySection heading="Prices">
        <p>
          All prices are in Indian Rupees.{" "}
          {Number(tax.gstRate) > 0
            ? tax.pricesIncludeTax
              ? `GST at ${tax.gstRate}% is already included in the price shown.`
              : `GST at ${tax.gstRate}% is added at checkout.`
            : "Tax, where it applies, is shown at checkout."}{" "}
          Delivery is charged separately and is shown before you confirm
          anything — see our{" "}
          <Link
            href="/shipping"
            className="font-medium text-foreground underline underline-offset-4"
          >
            shipping policy
          </Link>
          .
        </p>
        <p>
          Prices can change, but never after you have placed an order. What you
          were charged is what stands.
        </p>
      </PolicySection>

      <PolicySection heading="How the goods will look">
        <p>
          We photograph every piece ourselves and describe it as accurately as
          we can. Even so, colour on a screen is not colour in daylight, and
          handloom silk carries small irregularities in weave and zari that a
          machine would not.
        </p>
        <p>
          These variations are part of the cloth. What we will put right, and
          what we will not, is set out in our{" "}
          <Link
            href="/refunds"
            className="font-medium text-foreground underline underline-offset-4"
          >
            refunds policy
          </Link>
          , which you should read before ordering.
        </p>
      </PolicySection>

      <PolicySection heading="Payment">
        <p>
          You can pay online, or in cash when the courier arrives. Cash on
          delivery carries an extra charge, shown at checkout.
        </p>
        <p>
          Online payments are handled by our payment company. We never see or
          store your card details.
        </p>
      </PolicySection>

      <PolicySection heading="Your account">
        <p>
          Keep your password to yourself. You are responsible for what is done
          through your account. Tell us at once if you think someone else has
          got into it.
        </p>
        <p>
          We may close an account that is being used fraudulently, or to abuse
          cash on delivery by repeatedly refusing parcels.
        </p>
      </PolicySection>

      <PolicySection heading="Our photographs and designs">
        <p>
          The photographs, text and design of this website belong to{" "}
          {SHOP.name}. Please do not copy them for another shop or listing.
        </p>
      </PolicySection>

      <PolicySection heading="If something goes wrong">
        <p>
          Where the law allows us to limit what we owe you, our liability for
          an order is limited to what you paid for it. Nothing here removes
          rights you have under the Consumer Protection Act, 2019, or any other
          Indian law that cannot be signed away.
        </p>
      </PolicySection>

      <PolicySection heading="Law and disputes">
        <p>
          These terms are governed by Indian law. Any dispute goes to the
          courts of {SHOP.jurisdictionCity}, {SHOP.jurisdictionState}.
        </p>
        <p>
          Before it comes to that, please write to {SHOP.supportEmail}. Almost
          everything is settled faster that way.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
