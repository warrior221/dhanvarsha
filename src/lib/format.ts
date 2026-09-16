/**
 * Money and price display.
 *
 * Prices arrive as decimal STRINGS ("8999.00") from the query layer, never as
 * JS numbers. These helpers keep them that way as long as possible and do the
 * arithmetic in integer paise, so nothing rounds through float (spec 1.4).
 */

/** "8999.00" -> 899900 paise. Throws on anything that is not a decimal. */
export function toPaise(amount: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());

  if (!match) {
    throw new Error(`Not a valid money amount: "${amount}"`);
  }

  const [, sign, whole, fraction = "0"] = match;
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return sign === "-" ? -paise : paise;
}

const WHOLE_RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const WITH_PAISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "8999.00" -> "₹8,999"   (Indian digit grouping: 1,00,000 not 100,000)
 * "8999.50" -> "₹8,999.50"
 */
export function formatInr(amount: string): string {
  const paise = toPaise(amount);
  const rupees = paise / 100;

  return paise % 100 === 0 ? WHOLE_RUPEES.format(rupees) : WITH_PAISE.format(rupees);
}

/**
 * Whole-number discount percentage, or null when there is no saving.
 * Never stored — a stored copy would drift out of sync with the prices (spec 4).
 */
export function discountPercent(mrp: string, sellingPrice: string): number | null {
  const mrpPaise = toPaise(mrp);
  const sellingPaise = toPaise(sellingPrice);

  if (mrpPaise <= 0 || sellingPaise >= mrpPaise) return null;

  return Math.round(((mrpPaise - sellingPaise) / mrpPaise) * 100);
}
