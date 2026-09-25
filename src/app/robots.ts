import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * What a crawler may read.
 *
 * The shop and its products are open. Everything that belongs to one person
 * — their bag, their orders, their addresses — is closed, as is the admin.
 *
 * This is not a security control. It is a request, and a well-behaved crawler
 * honours it while a hostile one ignores it; those routes are protected by
 * the session checks behind them. What it does buy is that a customer's order
 * page cannot turn up in someone else's search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/cart",
        "/checkout",
        "/wishlist",
        "/login",
        "/register",
        "/verify",
        "/forgot-password",
        "/reset-password",
        "/set-password",
        "/api/",
      ],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
