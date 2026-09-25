import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl, absoluteUrl } from "@/lib/site";

/**
 * The map Google reads to find the catalogue.
 *
 * Rebuilt hourly rather than frozen at build time, because a saree added on
 * Tuesday should not wait for the next deploy to become findable.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        slug: true,
        updatedAt: true,
        images: { orderBy: { position: "asc" }, select: { url: true } },
      },
    }),
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { slug: true },
    }),
  ]);

  const newest = products[0]?.updatedAt ?? new Date();

  return [
    { url: siteUrl(), lastModified: newest, changeFrequency: "daily", priority: 1 },
    {
      url: siteUrl("/products"),
      lastModified: newest,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: siteUrl("/reviews"),
      changeFrequency: "monthly",
      priority: 0.3,
    },

    // Browse pages. Real pages with their own listings, so worth indexing,
    // but below the products themselves — a shopper searching for "green
    // Banarasi saree" wants the piece, not the aisle.
    ...categories.map((category) => ({
      url: siteUrl(`/products?category=${category.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),

    ...products.map((product) => ({
      url: siteUrl(`/products/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      // Clothing sells through Google Images as much as through search, so
      // the photos are listed rather than left for the crawler to find.
      images: product.images
        .map((image) => absoluteUrl(image.url))
        .filter((url): url is string => url !== null),
    })),
  ];
}
