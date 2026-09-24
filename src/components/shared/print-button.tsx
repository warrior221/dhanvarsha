"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Opens the browser's own print dialog.
 *
 * Which is also "Save as PDF" on every desktop and phone — so a customer can
 * keep a copy and the shop can put one in the parcel, without a PDF library
 * to maintain or a server round trip.
 */
export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
