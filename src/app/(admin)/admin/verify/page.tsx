import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminMfaState, requireAdminForSetup } from "@/lib/auth-guards";
import { auth } from "@/lib/auth";
import { getChallengeState } from "@/lib/queries/admin-mfa";
import { VerifyLadder } from "./verify-ladder";

export const metadata: Metadata = {
  title: "Sign-in checks",
  robots: { index: false, follow: false },
};

/**
 * The three-step ladder.
 *
 * Uses requireAdminForSetup(), NOT requireAdminPage(): this is the page that
 * gets an admin through the gate, so gating it would lock the key inside.
 */
export default async function AdminVerifyPage() {
  await requireAdminForSetup();

  const state = await adminMfaState();

  // Nothing to prove — either already passed, or not set up yet.
  if (state === "PASSED") redirect("/admin");
  if (state === "NOT_ENROLLED") redirect("/admin/security");

  const session = await auth();
  const initial = await getChallengeState(session!.sessionId!, session!.user.id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign-in checks</h1>
        <p className="text-sm text-muted-foreground">
          Your password alone does not open the admin area. Cost prices,
          supplier names and profit live behind these checks.
        </p>
      </div>

      <VerifyLadder initial={initial} />
    </div>
  );
}
