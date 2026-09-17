import { create } from "zustand";
import { ApiError, requestJson } from "@/lib/api-client";
import { EMPTY_WISHLIST, type WishlistView } from "@/lib/cart";

/**
 * Client-side mirror of the server wishlist, on the same rules as the cart
 * store: the server answers, this only reflects it.
 */

type WishlistStore = {
  wishlist: WishlistView;
  hydrated: boolean;
  pending: Record<string, boolean>;
  error: string | null;

  hydrate: (wishlist: WishlistView) => void;
  refresh: () => Promise<void>;
  add: (productId: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  toggle: (productId: string) => Promise<void>;
  has: (productId: string) => boolean;
  dismissError: () => void;
};

function messageFor(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

export const useWishlistStore = create<WishlistStore>((set, get) => {
  async function mutate(productId: string, run: () => Promise<WishlistView>) {
    set((state) => ({
      pending: { ...state.pending, [productId]: true },
      error: null,
    }));

    try {
      const wishlist = await run();
      set({ wishlist, hydrated: true });
    } catch (error) {
      set({ error: messageFor(error) });
    } finally {
      set((state) => {
        const pending = { ...state.pending };
        delete pending[productId];
        return { pending };
      });
    }
  }

  return {
    wishlist: EMPTY_WISHLIST,
    hydrated: false,
    pending: {},
    error: null,

    hydrate: (wishlist) => set({ wishlist, hydrated: true }),

    refresh: async () => {
      try {
        const wishlist = await requestJson<WishlistView>("/api/wishlist", "GET");
        set({ wishlist, hydrated: true });
      } catch (error) {
        set({ error: messageFor(error) });
      }
    },

    add: (productId) =>
      mutate(productId, () =>
        requestJson<WishlistView>("/api/wishlist", "POST", { productId }),
      ),

    remove: (productId) =>
      mutate(productId, () =>
        requestJson<WishlistView>("/api/wishlist", "DELETE", { productId }),
      ),

    toggle: (productId) =>
      get().has(productId) ? get().remove(productId) : get().add(productId),

    has: (productId) => get().wishlist.productIds.includes(productId),

    dismissError: () => set({ error: null }),
  };
});
