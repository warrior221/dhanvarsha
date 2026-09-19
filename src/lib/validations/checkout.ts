import { z } from "zod";
import { phoneSchema } from "@/lib/validations/auth";

/**
 * Address and checkout schemas, shared by the forms and the API routes.
 */

/** Indian PIN code: six digits, never starting with 0. */
export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code.");

/** States and union territories, so a typo cannot break courier routing. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const addressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the recipient's name.")
    .max(80, "That name is too long."),
  line1: z
    .string()
    .trim()
    .min(5, "Enter the house or flat number and street.")
    .max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter the city or town.").max(80),
  state: z.enum(INDIAN_STATES, { message: "Choose a state." }),
  pincode: pincodeSchema,
  phone: phoneSchema,
  isDefault: z.boolean().default(false),
});

export const addressUpdateSchema = addressSchema.extend({
  id: z.string().trim().min(1).max(64),
});

export type AddressInput = z.infer<typeof addressSchema>;

/**
 * Placing a cash-on-delivery order.
 *
 * Note there is no amount here. The total is recomputed on the server from the
 * cart and the shipping rules — a total sent by the client is never trusted
 * (spec 8.4).
 */
export const codOrderSchema = z.object({
  addressId: z.string().trim().min(1).max(64),
  /** The 6-digit code sent to confirm the order is genuine. */
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit confirmation code."),
});

export type CodOrderInput = z.infer<typeof codOrderSchema>;
