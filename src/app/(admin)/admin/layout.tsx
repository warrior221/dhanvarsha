import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";

/**
 * Server-side admin gate. This is the real check for admin PAGES — src/proxy.ts
 * only makes an optimistic cookie check and cannot be trusted, and every
 * /api/admin/* route guards itself independently with requireAdmin().
 *
 * The role is read from the session, which the jwt callback refreshes from the
 * `role` column on every request. It is never inferred from the email address
 * (spec 1.7).
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fadmin");
  }

  if (session.user.role !== Role.ADMIN) {
    // Next 16 only exposes forbidden() behind the experimental `authInterrupts`
    // flag, which is not worth enabling on a production shop. The equivalent
    // 403 on the API surface is a real status code.
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm font-semibold tracking-widest text-muted-foreground">
          403 — FORBIDDEN
        </p>
        <h1 className="text-2xl font-semibold">Admin access required</h1>
        <p className="text-muted-foreground">
          You are signed in as a customer, so this area is not available to you.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to the shop</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="text-sm font-bold tracking-[0.18em] text-primary">
            DHANVARSHA ADMIN
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.user.email}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
