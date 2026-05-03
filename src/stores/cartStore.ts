import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
  ShopifyProduct,
  formatCheckoutUrl,
  isCartNotFoundError,
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

function buildLineAttributes(selectedOptions: CartOption[]) {
  return selectedOptions.map((option) => ({
    key: option.name,
    value: option.value,
  }));
}

function matchesLineAttributes(
  attributes: Array<{ key: string; value: string }>,
  selectedOptions: CartOption[]
) {
  const lineOptions = [...attributes]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((attribute) => `${attribute.key}:${attribute.value}`);

  return lineOptions.join("|") === normalizeOptions(selectedOptions).join("|");
}

async function createShopifyCart(item: CartItem) {
  const data = await storefrontApiRequest(CART_CREATE_MUTATION, {
    input: {
      lines: [
        {
          quantity: item.quantity,
          merchandiseId: item.variantId,
          attributes: buildLineAttributes(item.selectedOptions),
        },
      ],
    },
  });

  if (data?.data?.cartCreate?.userErrors?.length > 0) {
    console.error("Cart creation failed:", data.data.cartCreate.userErrors);
    return null;
  }

  const cart = data?.data?.cartCreate?.cart;
  if (!cart?.checkoutUrl) return null;

  const lineId = cart.lines.edges[0]?.node?.id;
  if (!lineId) return null;

  return {
    cartId: cart.id,
    checkoutUrl: formatCheckoutUrl(cart.checkoutUrl),
    lineId,
  };
}

async function addLineToShopifyCart(cartId: string, item: CartItem) {
  const data = await storefrontApiRequest(CART_LINES_ADD_MUTATION, {
    cartId,
    lines: [
      {
        quantity: item.quantity,
        merchandiseId: item.variantId,
        attributes: buildLineAttributes(item.selectedOptions),
      },
    ],
  });

  const userErrors = data?.data?.cartLinesAdd?.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };

  const lines = data?.data?.cartLinesAdd?.cart?.lines?.edges || [];
  const newLine = lines.find(
    (line: {
      node: {
        id: string;
        attributes: Array<{ key: string; value: string }>;
        merchandise: { id: string };
      };
    }) =>
      line.node.merchandise.id === item.variantId &&
      matchesLineAttributes(line.node.attributes || [], item.selectedOptions)
  );

  return { success: true, lineId: newLine?.node?.id };
}

async function updateShopifyCartLine(cartId: string, lineId: string, quantity: number) {
  const data = await storefrontApiRequest(
    `mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } userErrors { field message } }
    }`,
    { cartId, lines: [{ id: lineId, quantity }] }
  );

  const userErrors = data?.data?.cartLinesUpdate?.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };

  return { success: true };
}

async function removeLineFromShopifyCart(cartId: string, lineId: string) {
  const data = await storefrontApiRequest(CART_LINES_REMOVE_MUTATION, {
    cartId,
    lineIds: [lineId],
  });

  const userErrors = data?.data?.cartLinesRemove?.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };

  return { success: true };
}

void CART_LINES_UPDATE_MUTATION;

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (item) => {
        const { items, cartId, clearCart } = get();
        const itemKey = buildItemKey(item);
        const existingItem = items.find((existing) => resolveItemKey(existing) === itemKey);

        set({ isLoading: true });
        try {
          if (!cartId) {
            const result = await createShopifyCart({ ...item, itemKey, lineId: null });
            if (result) {
              set({
                cartId: result.cartId,
                checkoutUrl: result.checkoutUrl,
                items: [{ ...item, itemKey, lineId: result.lineId }],
              });
            }
          } else if (existingItem) {
            const newQuantity = existingItem.quantity + item.quantity;
            if (!existingItem.lineId) return;

            const result = await updateShopifyCartLine(cartId, existingItem.lineId, newQuantity);
            if (result.success) {
              const currentItems = get().items;
              set({
                items: currentItems.map((existing) =>
                  resolveItemKey(existing) === itemKey
                    ? { ...existing, itemKey, quantity: newQuantity }
                    : existing
                ),
              });
            } else if (result.cartNotFound) {
              clearCart();
            }
          } else {
            const result = await addLineToShopifyCart(cartId, {
              ...item,
              itemKey,
              lineId: null,
            });

            if (result.success) {
              const currentItems = get().items;
              set({
                items: [
                  ...currentItems,
                  { ...item, itemKey, lineId: result.lineId ?? null },
                ],
              });
            } else if (result.cartNotFound) {
              clearCart();
            }
          }
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

        const { items, cartId, clearCart } = get();
        const item = items.find((existing) => resolveItemKey(existing) === itemKey);
        if (!item?.lineId || !cartId) return;

        set({ isLoading: true });
        try {
          const result = await updateShopifyCartLine(cartId, item.lineId, quantity);
          if (result.success) {
            const currentItems = get().items;
            set({
              items: currentItems.map((existing) =>
                resolveItemKey(existing) === itemKey
                  ? { ...existing, itemKey, quantity }
                  : existing
              ),
            });
          } else if (result.cartNotFound) {
            clearCart();
          }
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (itemKey) => {
        const { items, cartId, clearCart } = get();
        const item = items.find((existing) => resolveItemKey(existing) === itemKey);
        if (!item?.lineId || !cartId) return;

        set({ isLoading: true });
        try {
          const result = await removeLineFromShopifyCart(cartId, item.lineId);
          if (result.success) {
            const currentItems = get().items;
            const newItems = currentItems.filter(
              (existing) => resolveItemKey(existing) !== itemKey
            );
            newItems.length === 0 ? clearCart() : set({ items: newItems });
          } else if (result.cartNotFound) {
            clearCart();
          }
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),
      getCheckoutUrl: () => get().checkoutUrl,

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;

        set({ isSyncing: true });
        try {
          const data = await storefrontApiRequest(CART_QUERY, { id: cartId });
          if (!data) return;

          const cart = data?.data?.cart;
          if (!cart || cart.totalQuantity === 0) clearCart();
        } catch (error) {
          console.error("Failed to sync cart:", error);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: "qonnect-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId,
        checkoutUrl: state.checkoutUrl,
      }),
    }
  )
);
