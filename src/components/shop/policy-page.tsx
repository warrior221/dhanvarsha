import type { ReactNode } from "react";
import { POLICIES_UPDATED, SHOP } from "@/lib/shop-details";

const UPDATED = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/**
 * The shell every policy page sits in.
 *
 * Narrow on purpose. These are documents to be read, not a shop front, so the
 * measure stays near 70 characters however wide the screen is — the rest of
 * the site runs almost edge to edge, and that is wrong for prose.
 */
export function PolicyPage({
  title,
  summary,
  children,
}: {
  title: string;
  /** One line a customer can act on without reading the whole page. */
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-base text-muted-foreground">{summary}</p>

      <p className="mt-4 text-xs text-muted-foreground">
        Last updated {UPDATED.format(POLICIES_UPDATED)}
      </p>

      <div className="mt-8 space-y-8">{children}</div>

      <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
        <p>
          Questions about this page? Write to{" "}
          <a
            href={`mailto:${SHOP.supportEmail}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {SHOP.supportEmail}
          </a>
          .
        </p>
      </footer>
    </article>
  );
}

/** One titled section of a policy. */
export function PolicySection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
