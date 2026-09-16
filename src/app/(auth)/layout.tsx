import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <Link
        href="/"
        className="mb-8 text-sm font-bold tracking-[0.18em] text-primary"
      >
        DHANVARSHA
      </Link>

      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
