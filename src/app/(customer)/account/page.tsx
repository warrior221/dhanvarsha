import { Heart, MapPin, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await requireUser();

  const [orderCount, addressCount, savedCount] = await Promise.all([
    db.order.count({ where: { userId: user.id } }),
    db.address.count({ where: { userId: user.id, isArchived: false } }),
    db.wishlist.count({ where: { userId: user.id } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Your account</h1>
      <p className="text-muted-foreground">
        {user.name ? `${user.name} · ` : ""}
        {user.email}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tile
          href="/account/orders"
          icon={<Package className="size-5" aria-hidden />}
          label="Orders"
          value={orderCount}
        />
        <Tile
          href="/account/addresses"
          icon={<MapPin className="size-5" aria-hidden />}
          label="Addresses"
          value={addressCount}
        />
        <Tile
          href="/wishlist"
          icon={<Heart className="size-5" aria-hidden />}
          label="Wishlist"
          value={savedCount}
        />
      </div>
    </main>
  );
}

function Tile({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-background p-5 transition hover:border-foreground/40"
    >
      <span className="text-muted-foreground">{icon}</span>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Link>
  );
}
