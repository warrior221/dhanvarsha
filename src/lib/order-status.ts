import { OrderStatus } from "@prisma/client";

/**
 * Which status an order may move to next (spec section 7).
 *
 *   PENDING   -> CONFIRMED | CANCELLED
 *   CONFIRMED -> SHIPPED   | CANCELLED
 *   SHIPPED   -> DELIVERED | RETURNED
 *   DELIVERED -> RETURNED
 *   CANCELLED -> (terminal)
 *   RETURNED  -> (terminal)
 *
 * Pure module with no database import, so the admin UI can grey out the
 * impossible buttons using exactly the rules the server enforces.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  DELIVERED: [OrderStatus.RETURNED],
  CANCELLED: [],
  RETURNED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Statuses that end the order's life. */
export function isTerminal(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

/** Marking an order shipped is meaningless without these. */
export function requiresTracking(to: OrderStatus): boolean {
  return to === OrderStatus.SHIPPED;
}

/**
 * Cancelling puts the goods back on the shelf.
 *
 * A RETURN deliberately does NOT: the pieces are physically back but may be
 * damaged, stained or unsellable, so the admin decides what goes back into
 * stock from the inventory screen rather than the system assuming.
 */
export function restoresStock(to: OrderStatus): boolean {
  return to === OrderStatus.CANCELLED;
}

/** Verbs for the admin buttons. */
export const TRANSITION_LABEL: Record<OrderStatus, string> = {
  PENDING: "Reopen",
  CONFIRMED: "Confirm order",
  SHIPPED: "Mark shipped",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel order",
  RETURNED: "Mark returned",
};
