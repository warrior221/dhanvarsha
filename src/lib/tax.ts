/**
 * GST arithmetic.
 *
 * PURE MODULE — no database import, so client components can use these values.
 * See the client/server split note in lib/cart.ts.
 *
 * Every figure is integer paise. The rate is carried as BASIS POINTS (one
 * hundredth of a percent) for the same reason money is carried as paise: 5% of
 * ₹2,199 is not representable in binary floating point, and an invoice that is
 * one paisa out is an invoice an auditor can question.
 */

/** The settings row is a singleton. */
export const STORE_SETTING_ID = "store";

export type TaxSettings = {
  /** Percentage as a decimal string, e.g. "5.00". */
  gstRate: string;
  /** True when the shelf price already contains GST. */
  pricesIncludeTax: boolean;
  gstin: string | null;
  legalName: string | null;
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  gstRate: "0.00",
  pricesIncludeTax: true,
  gstin: null,
  legalName: null,
};

/** "5.00" -> 500. Rejects nothing; callers validate with the Zod schema. */
export function toBasisPoints(ratePercent: string): number {
  const [whole, fraction = ""] = ratePercent.trim().split(".");
  const paddedFraction = `${fraction}00`.slice(0, 2);

  return Number(whole) * 100 + Number(paddedFraction);
}

/** 500 -> "5.00", for display and for storing back as a Decimal string. */
export function basisPointsToPercent(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2);
}

export type TaxBreakdown = {
  /** The tax contained in, or added to, the goods. */
  taxPaise: number;
  /** Goods excluding tax. */
  netPaise: number;
  /** Goods including tax — what the customer is charged for the products. */
  grossPaise: number;
  /** True when the tax was already inside the displayed price. */
  inclusive: boolean;
};

/**
 * Splits GST out of, or adds it on to, a goods subtotal.
 *
 * INCLUSIVE (the Indian retail norm) does NOT change what the customer pays.
 * The price on the tag is the price at the till; this only works out how much
 * of that money is tax, so it can be recorded and printed on the invoice.
 *
 * EXCLUSIVE adds the tax as a genuine extra line, raising the total.
 */
export function computeTax(
  subtotalPaise: number,
  basisPoints: number,
  inclusive: boolean,
): TaxBreakdown {
  if (basisPoints <= 0 || subtotalPaise <= 0) {
    return {
      taxPaise: 0,
      netPaise: subtotalPaise,
      grossPaise: subtotalPaise,
      inclusive,
    };
  }

  if (inclusive) {
    // net = gross * 10000 / (10000 + bp), rounded to the nearest paisa. The
    // tax is then the remainder, so net + tax === gross exactly. Deriving the
    // tax independently could leave the two a paisa apart.
    const netPaise = Math.round((subtotalPaise * 10_000) / (10_000 + basisPoints));

    return {
      taxPaise: subtotalPaise - netPaise,
      netPaise,
      grossPaise: subtotalPaise,
      inclusive: true,
    };
  }

  const taxPaise = Math.round((subtotalPaise * basisPoints) / 10_000);

  return {
    taxPaise,
    netPaise: subtotalPaise,
    grossPaise: subtotalPaise + taxPaise,
    inclusive: false,
  };
}

/**
 * "Includes GST (5%)" / "GST (12.5%)", for a totals line.
 *
 * Trailing zeros are dropped, so a rate stored as "12.50" reads the way a
 * shopkeeper would say it.
 */
export function taxLineLabel(ratePercent: string, inclusive: boolean): string {
  const trimmed = ratePercent.includes(".")
    ? ratePercent.replace(/0+$/, "").replace(/\.$/, "")
    : ratePercent;

  return inclusive ? `Includes GST (${trimmed}%)` : `GST (${trimmed}%)`;
}
