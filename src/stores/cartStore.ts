import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CART_QUERY,
  ShopifyProduct,
  formatCheckoutUrl,
  storefrontApiRequest,
} from "@/lib/shopify";

type CartOption = { name: string; value: string };

export interface CartItem {
  itemKey: string;
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: CartOption[];
  brief?: string;
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, "lineId" | "itemKey">) => Promise<void>;
  updateQuantity: (itemKey: string, quantity: number) => Promise<void>;
  removeItem: (itemKey: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  getCheckoutUrl: () => string | null;
}

function normalizeOptions(options: CartOption[]) {
  return [...options]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((option) => `${option.name}:${option.value}`);
}

function buildItemKey(item: { variantId: string; selectedOptions: CartOption[] }) {
  return `${item.variantId}::${normalizeOptions(item.selectedOptions).join("|")}`;
}

function resolveItemKey(item: { itemKey?: string; variantId: string; selectedOptions: CartOption[] }) {
  return item.itemKey || buildItemKey(item);
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (item) => {
        const { items } = get();
        const itemKey = buildItemKey(item);
        const existingItemIndex = items.findIndex((existing) => resolveItemKey(existing) === itemKey);

        set({ isLoading: true });
        
        try {
          // LOCAL-FIRST LOGIC:
          // We update the local state immediately. 
          // We don't wait for Shopify because we are using a custom Stripe checkout.
          
          let newItems = [...items];
          if (existingItemIndex > -1) {
            newItems[existingItemIndex].quantity += item.quantity;
          } else {
            newItems.push({ ...item, itemKey, lineId: null });
          }

          set({ items: newItems });
          
          // Note: In a pure headless setup with Stripe, we don't necessarily 
          // need to create a Shopify cart object unless we are using Shopify's checkout.
          // Since we use /api/create-checkout-session (Stripe), local state is sufficient.
          
        } catch (error) {
          console.error("Failed to add item:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (itemKey, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(itemKey);
          return;
        }

        const { items } = get();
        set({
          items: items.map((item) =>
            resolveItemKey(item) === itemKey ? { ...item, quantity } : item
          ),
        });
      },

      removeItem: async (itemKey) => {
        const { items } = get();
        const newItems = items.filter((item) => resolveItemKey(item) !== itemKey);
        set({ items: newItems });
        if (newItems.length === 0) get().clearCart();
      },

      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),
      
      getCheckoutUrl: () => get().checkoutUrl,

      syncCart: async () => {
        // No-op for local-first Stripe setup
        return;
      },
    }),
    {
      name: "qonnect-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);
