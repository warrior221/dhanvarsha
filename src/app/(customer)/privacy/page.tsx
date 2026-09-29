import type { Metadata } from "next";
import { PolicyPage, PolicySection } from "@/components/shop/policy-page";
import { SHOP } from "@/lib/shop-details";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Dhanvarsha collects about you, why, and who it is shared with.",
};

/**
 * Describes what the code ACTUALLY does.
 *
 * Every party named here is one the shop genuinely sends data to. A privacy
 * policy copied from a template names companies you do not use and omits the
 * ones you do, which is worse than having none: it is a false statement about
 * where a customer's address ends up.
 */
export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Privacy policy"
      summary="We collect what is needed to take payment and get a parcel to you, and nothing else. We do not sell your information."
    >
      <PolicySection heading="What we collect">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong className="text-foreground">Your name and email</strong>,
            when you create an account
          </li>
          <li>
            <strong className="text-foreground">Your mobile number</strong>,
            because the courier phones ahead on the day
          </li>
          <li>
            <strong className="text-foreground">Delivery addresses</strong> you
            save
          </li>
          <li>
            <strong className="text-foreground">Your orders</strong> — what you
            bought, when, and what you paid
          </li>
          <li>
            <strong className="text-foreground">A review</strong>, if you
            choose to leave one, under the name you give
          </li>
        </ul>
        <p>
          We never see your card number, UPI PIN or bank password. Those go
          straight to the payment company and never touch our systems.
        </p>
      </PolicySection>

      <PolicySection heading="Why we hold it">
        <p>
          To take your order, get it to your door, let you see your own order
          history afterwards, and answer you when you write to us. Indian tax
          law also requires us to keep records of sales.
        </p>
      </PolicySection>

      <PolicySection heading="Who else sees it">
        <p>Only the companies that make an order work, and only what they need:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong className="text-foreground">The courier</strong> — your
            name, address and phone number, so they can deliver and call ahead
          </li>
          <li>
            <strong className="text-foreground">Razorpay</strong>, our payment
            company, when you pay online
          </li>
          <li>
            <strong className="text-foreground">Resend</strong>, which sends
            our emails — your email address and what the message says
          </li>
          <li>
            <strong className="text-foreground">Neon</strong>, which hosts our
            database
          </li>
          <li>
            <strong className="text-foreground">ImageKit</strong>, which stores
            and serves our product photographs
          </li>
        </ul>
        <p>
          <strong className="text-foreground">
            We do not sell your information, and we do not pass it to anyone
            for advertising.
          </strong>{" "}
          We will hand over information if the law requires it of us.
        </p>
      </PolicySection>

      <PolicySection heading="Cookies">
        <p>
          We use cookies for two things: keeping you signed in, and remembering
          what is in your bag before you sign in. Both are necessary for the
          shop to work.
        </p>
        <p>
          We do not use advertising or tracking cookies, and we do not follow
          you around other websites.
        </p>
      </PolicySection>

      <PolicySection heading="How long we keep it">
        <p>
          Your account details stay until you ask us to delete them. Records of
          completed orders are kept for as long as tax law requires, even after
          an account closes — we are not permitted to erase a sales record on
          request.
        </p>
      </PolicySection>

      <PolicySection heading="What you can ask for">
        <p>
          Write to {SHOP.supportEmail} and you can ask us to show you what we
          hold about you, correct anything wrong, or delete your account. We
          answer within 30 days.
        </p>
      </PolicySection>

      <PolicySection heading="Children">
        <p>
          This shop is not intended for anyone under 18, and we do not
          knowingly collect information about children.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
