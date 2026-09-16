export function Footer() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-bold tracking-[0.18em] text-primary">DHANVARSHA</p>
        <p>© {new Date().getFullYear()} Dhanvarsha. All rights reserved.</p>
      </div>
    </footer>
  );
}
