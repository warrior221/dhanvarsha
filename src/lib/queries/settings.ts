import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatInr } from "@/lib/format";
import { DEFAULT_TAX_SETTINGS, STORE_SETTING_ID, type TaxSettings } from "@/lib/tax";
import type { ShippingRuleInput, TaxSettingsInput } from "@/lib/validations/settings";

/**
 * Shop-wide settings the owner can change without a developer: what delivery
 * costs, and how GST is handled.
 *
 * Reading is public (checkout needs both). Writing is admin-only and every
 * caller must already have passed requireAdmin().
 */

/* ------------------------------------------------------------------ */
/* Tax                                                                 */
/* ------------------------------------------------------------------ */

/** Never throws for a missing row — an unconfigured shop simply charges 0%. */
export async function getTaxSettings(): Promise<TaxSettings> {
  const row = await db.storeSetting.findUnique({
    where: { id: STORE_SETTING_ID },
    select: {
      gstRate: true,
      pricesIncludeTax: true,
      gstin: true,
      legalName: true,
    },
  });

  if (!row) return DEFAULT_TAX_SETTINGS;

  return {
    gstRate: row.gstRate.toString(),
    pricesIncludeTax: row.pricesIncludeTax,
    gstin: row.gstin,
    legalName: row.legalName,
  };
}

export async function updateTaxSettings(input: TaxSettingsInput): Promise<TaxSettings> {
  const data = {
    gstRate: input.gstRate,
    pricesIncludeTax: input.pricesIncludeTax,
    gstin: input.gstin?.trim() || null,
    legalName: input.legalName?.trim() || null,
  };

  const row = await db.storeSetting.upsert({
    where: { id: STORE_SETTING_ID },
    create: { id: STORE_SETTING_ID, ...data },
    update: data,
    select: {
      gstRate: true,
      pricesIncludeTax: true,
      gstin: true,
      legalName: true,
    },
  });

  return {
    gstRate: row.gstRate.toString(),
    pricesIncludeTax: row.pricesIncludeTax,
    gstin: row.gstin,
    legalName: row.legalName,
  };
}

/* ------------------------------------------------------------------ */
/* Delivery charges                                                    */
/* ------------------------------------------------------------------ */

export type ShippingRuleRow = {
  id: string;
  name: string;
  minSubtotal: string;
  charge: string;
  codExtraCharge: string;
  isActive: boolean;
  minSubtotalFormatted: string;
  chargeFormatted: string;
  codExtraChargeFormatted: string;
};

/** Ordered the way checkout reads them: lowest threshold first. */
export async function listShippingRules(): Promise<ShippingRuleRow[]> {
  const rules = await db.shippingRule.findMany({ orderBy: { minSubtotal: "asc" } });

  return rules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    minSubtotal: rule.minSubtotal.toString(),
    charge: rule.charge.toString(),
    codExtraCharge: rule.codExtraCharge.toString(),
    isActive: rule.isActive,
    minSubtotalFormatted: formatInr(rule.minSubtotal.toString()),
    chargeFormatted:
      rule.charge.toString() === "0" || Number(rule.charge) === 0
        ? "Free"
        : formatInr(rule.charge.toString()),
    codExtraChargeFormatted:
      Number(rule.codExtraCharge) === 0
        ? "—"
        : formatInr(rule.codExtraCharge.toString()),
  }));
}

export async function createShippingRule(input: ShippingRuleInput): Promise<void> {
  await assertThresholdIsFree(input.minSubtotal, null);

  await db.shippingRule.create({
    data: {
      name: input.name,
      minSubtotal: input.minSubtotal,
      charge: input.charge,
      codExtraCharge: input.codExtraCharge,
      isActive: input.isActive,
    },
  });
}

export async function updateShippingRule(
  id: string,
  input: ShippingRuleInput,
): Promise<void> {
  await assertThresholdIsFree(input.minSubtotal, id);

  const updated = await db.shippingRule.updateMany({
    where: { id },
    data: {
      name: input.name,
      minSubtotal: input.minSubtotal,
      charge: input.charge,
      codExtraCharge: input.codExtraCharge,
      isActive: input.isActive,
    },
  });

  if (updated.count === 0) {
    throw new AppError("RULE_NOT_FOUND", "That delivery rule no longer exists.", 404);
  }
}

export async function deleteShippingRule(id: string): Promise<void> {
  const deleted = await db.shippingRule.deleteMany({ where: { id } });

  if (deleted.count === 0) {
    throw new AppError("RULE_NOT_FOUND", "That delivery rule no longer exists.", 404);
  }
}

/**
 * Two rules starting at the same subtotal would make the delivery charge
 * depend on row order, which is not something the owner can see or predict.
 * Refuse the clash instead.
 */
async function assertThresholdIsFree(
  minSubtotal: string,
  ignoreId: string | null,
): Promise<void> {
  const clash = await db.shippingRule.findFirst({
    where: {
      minSubtotal: new Prisma.Decimal(minSubtotal),
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { name: true },
  });

  if (clash) {
    throw new AppError(
      "THRESHOLD_TAKEN",
      `"${clash.name}" already starts at ${formatInr(minSubtotal)}. Two rules cannot share a starting amount.`,
      409,
    );
  }
}
