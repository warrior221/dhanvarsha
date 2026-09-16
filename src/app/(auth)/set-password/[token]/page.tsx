import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage(
  props: PageProps<"/set-password/[token]">,
) {
  // params is a Promise in Next.js 16.
  const { token } = await props.params;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set your password</CardTitle>
        <CardDescription>
          Choose a password for your Dhanvarsha admin account. This link works once.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* The token is validated server-side when the form is submitted;
            checking it here as well would leak whether it is valid to anyone
            who merely opens the page. */}
        <SetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
