import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Add product",
  robots: { index: false, follow: false },
};

export default async function NewProductPage() {
  await requireAdmin();

  const [categories, attributes] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add product</h1>
      </div>

      <ProductForm categories={categories} attributes={attributes} />
    </div>
  );
}
