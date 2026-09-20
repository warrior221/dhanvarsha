import type { OrderStatus } from "@prisma/client";

/**
 * Order lifecycle rules.
 *
 * PURE MODULE — nothing here reaches the database or the Prisma runtime, so
 * the admin UI can grey out impossible buttons using exactly the rules the
 * server enforces.
 *
 * The status values are declared HERE as plain strings rather than imported
 * from @prisma/client. A Prisma enum is a runtime value, so importing one
 * into a browser component drags Prisma's browser library in with it — 53 KB
 * of library to spell six words. `import type` above costs nothing: it is
 * erased when the code is built.
 */
export const ORDER_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  RETURNED: "RETURNED",
} as const satisfies Record<OrderStatus, OrderStatus>;

/**
 * Which status an order may move to next (spec section 7).
 *
 *   PENDING   -> CONFIRMED | CANCELLED
 *   CONFIRMED -> SHIPPED   | CANCELLED
 *   SHIPPED   -> DELIVERED | RETURNED
 *   DELIVERED -> RETURNED
 *   CANCELLED -> (terminal)
 *   RETURNED  -> (terminal)
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  CONFIRMED: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  SHIPPED: [ORDER_STATUS.DELIVERED, ORDER_STATUS.RETURNED],
  DELIVERED: [ORDER_STATUS.RETURNED],
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
  return to === ORDER_STATUS.SHIPPED;
}

/**
 * Cancelling puts the goods back on the shelf.
 *
 * A RETURN deliberately does NOT: the pieces are physically back but may be
 * damaged, stained or unsellable, so the admin decides what goes back into
 * stock from the inventory screen rather than the system assuming.
 */
export function restoresStock(to: OrderStatus): boolean {
  return to === ORDER_STATUS.CANCELLED;
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
