"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products", exact: true },
  { href: "/admin/products/unpriced", label: "Unpriced", badge: true },
  { href: "/admin/attributes", label: "Attributes" },
  { href: "/admin/check-in", label: "Check in" },
  { href: "/admin/scan-out", label: "Scan out" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/suppliers", label: "Weavers" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/security", label: "Security" },
] as const;

/**
 * @param unpricedCount pieces entered but not yet priced. Shown on the
 * Unpriced link so stock the shop owns but cannot sell stays visible rather
 * than waiting silently.
 */
export function AdminNav({ unpricedCount = 0 }: { unpricedCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2 print:hidden"
    >
      {LINKS.map((link) => {
        const active =
          "exact" in link && link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {link.label}
            {"badge" in link && link.badge && unpricedCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-amber-600 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
                {unpricedCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
