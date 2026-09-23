"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

const INITIAL: LoginState = {};

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {state.error}
            {state.unverifiedEmail ? (
              <>
                {" "}
                <Link
                  href={`/verify?email=${encodeURIComponent(state.unverifiedEmail)}`}
                  className="font-medium underline underline-offset-4"
                >
                  Verify now
                </Link>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email or mobile number</Label>
        <Input
          id="email"
          name="email"
          // Deliberately type="text", not "email": a mobile number is just as
          // valid here, and the browser would refuse to submit one.
          type="text"
          autoComplete="username"
          required
          disabled={isPending}
          placeholder="you@example.com or 9876543210"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
