import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdminPage } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getAdminProduct } from "@/lib/queries/admin-products";

export const metadata: Metadata = {
  title: "Edit product",
  robots: { index: false, follow: false },
};

export default async function EditProductPage(
  props: PageProps<"/admin/products/[id]/edit">,
) {
  await requireAdminPage();

  // params is a Promise in Next.js 16.
  const { id } = await props.params;

  const [product, categories, attributes] = await Promise.all([
    getAdminProduct(id),
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    db.attribute.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        values: { orderBy: { position: "asc" }, select: { id: true, value: true } },
      },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{product.name}</h1>
        <p className="text-sm text-muted-foreground">SKU {product.sku}</p>
      </div>

      <ProductForm
        categories={categories}
        attributes={attributes}
        initial={product}
      />
    </div>
  );
}
