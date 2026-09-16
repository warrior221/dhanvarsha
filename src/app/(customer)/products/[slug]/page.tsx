import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product/product-gallery";
import { VariantPicker } from "@/components/product/variant-picker";
import { Price } from "@/components/shared/price";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";
import { publicProductSelect, toProductView } from "@/lib/queries/product";

async function getProduct(slug: string) {
  const product = await db.product.findFirst({
    where: { slug, isActive: true },
    select: publicProductSelect,
  });

  return product ? toProductView(product) : null;
}

export async function generateMetadata(
  props: PageProps<"/products/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);

  if (!product) return { title: "Product not found" };

  const description = product.description.slice(0, 160);

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      type: "website",
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductDetailPage(
  props: PageProps<"/products/[slug]">,
) {
  // params is a Promise in Next.js 16.
  const { slug } = await props.params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const inStock = product.variants.some((variant) => variant.stockQty > 0);

  // Group attribute values under their attribute for display.
  const grouped = new Map<string, { name: string; values: string[] }>();
  for (const item of product.attributes) {
    const entry = grouped.get(item.attribute.id) ?? {
      name: item.attribute.name,
      values: [],
    };
    entry.values.push(item.value);
    grouped.set(item.attribute.id, entry);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images.map((image) => image.url),
    category: product.category.name,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.sellingPrice,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/*
        JSON.stringify does not escape HTML, so "<" is replaced with its unicode
        form to close off script injection through a product name or
        description — exactly as the Next.js JSON-LD guide instructs.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <Link href="/products" className="hover:underline">
          Shop
        </Link>
        <span aria-hidden> / </span>
        <Link
          href={`/products?category=${product.category.slug}`}
          className="hover:underline"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} />

        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {product.category.name}
              {product.isReadymade ? " · Readymade" : ""}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{product.name}</h1>
            <p className="text-xs text-muted-foreground">SKU {product.sku}</p>
          </div>

          <Price mrp={product.mrp} sellingPrice={product.sellingPrice} size="lg" />

          <Separator />

          <VariantPicker variants={product.variants} />

          <Separator />

          <div className="space-y-2">
            <h2 className="text-sm font-medium">Description</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          </div>

          {grouped.size > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Details</h2>
              <dl className="space-y-2">
                {[...grouped.entries()].map(([id, group]) => (
                  <div key={id} className="flex flex-wrap items-center gap-2">
                    <dt className="text-sm text-muted-foreground">{group.name}:</dt>
                    <dd className="flex flex-wrap gap-1">
                      {group.values.map((value) => (
                        <Badge key={value} variant="secondary">
                          {value}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {product.careInstructions ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Care</h2>
              <p className="text-sm text-muted-foreground">{product.careInstructions}</p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
