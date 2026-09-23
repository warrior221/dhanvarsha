import { z } from "zod";

/**
 * Shared between the client forms and the API routes. The form gives fast
 * feedback; the server enforces. Never trust the client copy.
 */

/**
 * bcrypt silently truncates anything past 72 BYTES. Capping the length here
 * means a long passphrase is rejected loudly instead of being quietly cut
 * short, which would let a shorter prefix unlock the account.
 */
const MAX_PASSWORD_BYTES = 72;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES,
    `Password must be at most ${MAX_PASSWORD_BYTES} bytes (about ${MAX_PASSWORD_BYTES} characters).`,
  )
  .refine(
    (value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value),
    "Password must contain at least one letter and one number.",
  );

export const emailSchema = z
  .email("Enter a valid email address.")
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.");

/** Indian mobile: 10 digits starting 6-9, with optional +91 / 0 prefix. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(?:\+91|91|0)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  )
  .transform((value) => value.replace(/^(?:\+91|91|0)/, ""));

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(80, "That name is too long."),
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Sign in with EITHER an email address or a mobile number.
 *
 * Kept as one free-text field rather than a toggle: people type whichever
 * they remember, and asking them to first declare which kind it is adds a
 * decision for no benefit. Which one it is falls out of the shape.
 */
export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address or mobile number.")
  .max(254);

export type LoginIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string };

/** Decides what the customer typed. Returns null when it is neither. */
export function classifyIdentifier(raw: string): LoginIdentifier | null {
  const value = raw.trim();

  // Anything with an @ can only have been meant as an email.
  if (value.includes("@")) {
    const email = emailSchema.safeParse(value);
    return email.success ? { kind: "email", email: email.data } : null;
  }

  const phone = phoneSchema.safeParse(value);
  return phone.success ? { kind: "phone", phone: phone.data } : null;
}

export const loginSchema = z.object({
  /** An email address or a 10-digit Indian mobile number. */
  email: loginIdentifierSchema,
  password: z.string().min(1, "Please enter your password."),
});

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * Resetting a forgotten password.
 *
 * The code proves control of the mailbox, so it stands in for the old
 * password — which by definition the person does not have.
 */
export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const otpSendSchema = z.object({
  identifier: z.string().trim().min(1, "Missing identifier."),
  /**
   * COD_CONFIRMATION is deliberately absent. Checkout no longer sends a
   * per-order code, and leaving the purpose callable would keep an endpoint
   * that mails any registered address on request. The database enum still
   * has the value so historical OtpCode rows stay readable.
   */
  purpose: z.enum(["EMAIL_VERIFICATION", "PHONE_VERIFICATION", "PASSWORD_RESET"]),
});

export const otpVerifySchema = otpSendSchema.extend({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type OtpSendInput = z.infer<typeof otpSendSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
