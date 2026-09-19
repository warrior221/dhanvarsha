import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage(
  props: PageProps<"/reset-password">,
) {
  // searchParams is a Promise in Next.js 16.
  const { email } = await props.searchParams;
  const address = typeof email === "string" ? email : "";

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            We need to know which account you are resetting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <Link
              href="/forgot-password"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Start again
            </Link>{" "}
            and we will email you a code.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Enter the code we emailed you, then choose a new password.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ResetPasswordForm email={address} />

        <p className="text-sm text-muted-foreground">
          Wrong address?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Start again
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
