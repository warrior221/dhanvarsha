import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { listAddresses } from "@/lib/queries/address";
import { AddressBook } from "./address-book";

export const metadata: Metadata = {
  title: "Your addresses",
  robots: { index: false, follow: false },
};

export default async function AddressesPage() {
  const user = await requireUser();
  const addresses = await listAddresses(user.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/account" className="text-sm text-muted-foreground hover:underline">
        ← Your account
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Your addresses</h1>

      <AddressBook initial={addresses} />
    </main>
  );
}
