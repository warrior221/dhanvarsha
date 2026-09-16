import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/login">) {
  // searchParams is a Promise in Next.js 16.
  const { callbackUrl } = await props.searchParams;

  const target =
    typeof callbackUrl === "string" && callbackUrl.startsWith("/") ? callbackUrl : "/";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Sign in to check out and see your orders.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <LoginForm callbackUrl={target} />
      </CardContent>

      <CardFooter>
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
