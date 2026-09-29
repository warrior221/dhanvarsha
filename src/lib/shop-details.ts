/**
 * The shop's own particulars, in one place.
 *
 * The policy pages, the receipt and anything else that has to name the
 * business all read from here, so there is one thing to correct rather than
 * four pages that quietly disagree with each other.
 *
 * The legal name and GSTIN deliberately live in Settings (StoreSetting) and
 * not here: they change when the business registers, and that should not need
 * a developer.
 */

export const SHOP = {
  /** Trading name, as shown to customers. */
  name: "Dhanvarsha",
  tagline: "Banarasi Silks",

  /** Where a customer writes for help. Also the sender on order emails. */
  supportEmail: "orders@dhanvarshasilk.in",

  /**
   * The city whose courts hear any dispute. Ordinary for an Indian business
   * to name its own; change it if the registered address is elsewhere.
   */
  jurisdictionCity: "Varanasi",
  jurisdictionState: "Uttar Pradesh",

  /** How long after an order is placed it is handed to the courier. */
  dispatchBusinessDays: 7,

  /** Typical courier transit once dispatched. */
  deliveryBusinessDaysMin: 3,
  deliveryBusinessDaysMax: 7,

  /** How long a customer has to report a damaged or incorrect piece. */
  reportProblemHours: 48,

  /** How long a refund takes to reach the customer once approved. */
  refundBusinessDaysMin: 5,
  refundBusinessDaysMax: 7,
} as const;

/**
 * When the policies were last revised.
 *
 * Shown on every policy page. A policy with no date is one a customer cannot
 * tell has changed since they ordered.
 */
export const POLICIES_UPDATED = new Date("2026-09-29T00:00:00+05:30");
