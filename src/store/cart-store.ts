import { create } from "zustand";
import { ApiError, requestJson } from "@/lib/api-client";
import { EMPTY_CART, type CartView } from "@/lib/cart";

/**
 * Client-side MIRROR of the server cart.
 *
 * The database is the source of truth (spec 12). Every mutation posts to
 * /api/cart and replaces this state with whatever the server returns, so the
 * quantities and stock shown are always the server's answer rather than an
 * optimistic guess that could disagree with real stock.
 *
 * Nothing is persisted to localStorage: the cart must survive a different
 * browser, and the guest cookie already ties the shopper to their server-side
 * cart.
 */

type CartStore = {
  cart: CartView;
  /** True once real data has arrived, so the badge does not flash a stale 0. */
  hydrated: boolean;
  /** Per-variant in-flight flags, for spinners on individual lines. */
  pending: Record<string, boolean>;
  error: string | null;

  hydrate: (cart: CartView) => void;
  refresh: () => Promise<void>;
  add: (variantId: string, quantity?: number) => Promise<boolean>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  dismissError: () => void;
};

function messageFor(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

export const useCartStore = create<CartStore>((set, get) => {
  /** Runs an API call with the per-variant pending flag set. */
  async function mutate(variantId: string, run: () => Promise<CartView>): Promise<boolean> {
    set((state) => ({
      pending: { ...state.pending, [variantId]: true },
      error: null,
    }));

    try {
      const cart = await run();
      set({ cart, hydrated: true });
      return true;
    } catch (error) {
      set({ error: messageFor(error) });
      // The server refused — re-read so the UI shows the real state rather
      // than whatever the shopper just tried to do.
      void get().refresh();
      return false;
    } finally {
      set((state) => {
        const pending = { ...state.pending };
        delete pending[variantId];
        return { pending };
      });
    }
  }

  return {
    cart: EMPTY_CART,
    hydrated: false,
    pending: {},
    error: null,

    hydrate: (cart) => set({ cart, hydrated: true }),

    refresh: async () => {
      try {
        const cart = await requestJson<CartView>("/api/cart", "GET");
        set({ cart, hydrated: true });
      } catch (error) {
        set({ error: messageFor(error) });
      }
    },

    add: (variantId, quantity = 1) =>
      mutate(variantId, () =>
        requestJson<CartView>("/api/cart", "POST", { variantId, quantity }),
      ),

    setQuantity: async (variantId, quantity) => {
      await mutate(variantId, () =>
        requestJson<CartView>("/api/cart", "PATCH", { variantId, quantity }),
      );
    },

    remove: async (variantId) => {
      await mutate(variantId, () =>
        requestJson<CartView>("/api/cart", "DELETE", { variantId }),
      );
    },

    dismissError: () => set({ error: null }),
  };
});
