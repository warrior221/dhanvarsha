import type { Metadata } from "next";
import { TagCodeList } from "@/components/admin/tag-code-list";
import { requireAdminPage } from "@/lib/auth-guards";
import { listTagCodes } from "@/lib/queries/tag-codes";

export const metadata: Metadata = {
  title: "Tag codes",
  robots: { index: false, follow: false },
};

/**
 * The tag codes as plain text.
 *
 * The owner prints labels with their own barcode converter, so this screen
 * deliberately draws no barcode, makes no PDF and talks to no printer. It hands
 * over the codes and stops there.
 *
 * A code is issued once and never changes, because a barcode is ink on a tag —
 * reissuing one would invalidate every label already printed. So a code copied
 * from here stays correct forever.
 */
export default async function TagCodesPage() {
  await requireAdminPage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tag codes</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The code printed on each tag, as plain text to copy into your barcode
          converter. A code never changes once issued, so anything you print from
          here keeps working — including labels you print again later.
        </p>
      </div>

      <TagCodeList rows={await listTagCodes()} />
    </div>
  );
}
