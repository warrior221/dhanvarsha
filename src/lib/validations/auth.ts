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

export const loginSchema = z.object({
  email: emailSchema,
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
