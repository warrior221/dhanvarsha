import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export default async function VerifyPage(props: PageProps<"/verify">) {
  const { email } = await props.searchParams;
  const address = typeof email === "string" ? email : "";

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            We need to know which account to verify.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Open the link from your verification email, or{" "}
            <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
              create an account
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          Enter the 6-digit code we sent you to finish setting up your account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <VerifyForm email={address} />
      </CardContent>
    </Card>
  );
}
