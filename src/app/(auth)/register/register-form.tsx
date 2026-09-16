"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, postJson } from "@/lib/api-client";
import { registerSchema } from "@/lib/validations/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function RegisterForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const input = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    // Same schema the API route uses. This is only for fast feedback — the
    // server validates again and is the one that counts.
    const parsed = registerSchema.safeParse(input);

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "name" || key === "email" || key === "password") {
          next[key] ??= issue.message;
        }
      }
      setFieldErrors(next);
      return;
    }

    setIsPending(true);

    try {
      await postJson("/api/auth/register", parsed.data);
      router.push(`/verify?email=${encodeURIComponent(parsed.data.email)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) {
          const next: FieldErrors = {};
          for (const [key, messages] of Object.entries(error.fields)) {
            if (key === "name" || key === "email" || key === "password") {
              next[key] = messages[0];
            }
          }
          setFieldErrors(next);
        }
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Field
        id="name"
        label="Full name"
        type="text"
        autoComplete="name"
        error={fieldErrors.name}
        disabled={isPending}
      />
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={fieldErrors.email}
        disabled={isPending}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number."
        error={fieldErrors.password}
        disabled={isPending}
      />

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  placeholder,
  hint,
  error,
  disabled,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled: boolean;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
