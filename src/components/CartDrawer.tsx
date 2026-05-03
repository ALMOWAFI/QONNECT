import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  CreditCard,
  Loader2,
} from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { getStripe, createCheckoutSession } from "@/lib/stripe";
import { toast } from "sonner";

function buildFallbackItemKey(item: {
  itemKey?: string;
  variantId: string;
  selectedOptions: Array<{ name: string; value: string }>;
}) {
  if (item.itemKey) return item.itemKey;

  const selectedOptions = [...item.selectedOptions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((option) => `${option.name}:${option.value}`)
    .join("|");

  return `${item.variantId}::${selectedOptions}`;
}

export const CartDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { items, isLoading, updateQuantity, removeItem } = useCartStore();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
    0
  );

  useEffect(() => {
    if (searchParams.get("cart") !== "open") return;

    setIsOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("cart");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleCheckout = async () => {
    setIsCheckoutLoading(true);
    try {
      const stripe = await getStripe();
      if (!stripe) throw new Error("Stripe failed to load");

      const { id: sessionId } = await createCheckoutSession(items);
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        toast.error(error.message || "Checkout failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Checkout service unavailable. Please try again later.");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-muted"
          aria-label="Open cart"
        >
          <ShoppingBag className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground p-0 px-1 text-[10px] text-background">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex h-full w-full flex-col border-l border-border bg-background sm:max-w-lg">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="display text-2xl font-medium">Cart</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            {totalItems === 0
              ? "Your cart is empty."
              : `${totalItems} item${totalItems !== 1 ? "s" : ""}.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col pt-6">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <ShoppingBag className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-sm uppercase tracking-widest text-muted-foreground">
                  Nothing here yet.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                <div className="space-y-5">
                  {items.map((item) => {
                    const itemKey = buildFallbackItemKey(item);

                    return (
                      <div
                        key={item.lineId || itemKey}
                        className="flex gap-4 border-b border-border pb-5 last:border-b-0"
                      >
                        <div className="h-24 w-20 flex-shrink-0 overflow-hidden bg-muted">
                          {item.product.node.images?.edges?.[0]?.node && (
                            <img
                              src={item.product.node.images.edges[0].node.url}
                              alt={item.product.node.title}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="display truncate text-base font-medium">
                            {item.product.node.title}
                          </h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.selectedOptions.map((option) => option.value).join(" / ")}
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {item.price.currencyCode} {parseFloat(item.price.amount).toFixed(2)}
                          </p>

                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                              className="flex h-6 w-6 items-center justify-center border border-border transition-transform hover:border-foreground active:scale-90"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="tabular-nums text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                              className="flex h-6 w-6 items-center justify-center border border-border transition-transform hover:border-foreground active:scale-90"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => removeItem(itemKey)}
                          className="text-muted-foreground transition-transform hover:text-foreground active:scale-90"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex-shrink-0 space-y-4 border-t border-border pt-6">
                <div className="rounded-[1.25rem] border border-border bg-card/75 p-4">
                  <p className="nav-text">After checkout</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    <p>1. We confirm your order and service tier.</p>
                    <p>2. We collect your link or page-build assets.</p>
                    <p>3. We generate the QR and trigger print-on-demand fulfillment.</p>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="nav-text">Subtotal</span>
                  <span className="display text-2xl font-medium">
                    {items[0]?.price.currencyCode} {totalPrice.toFixed(2)}
                  </span>
                </div>

                <p className="text-xs leading-5 text-muted-foreground">
                  Secure checkout powered by Stripe. If you cancel, we return
                  you to the site with your cart preserved.
                </p>

                <button
                  onClick={handleCheckout}
                  className="btn-filled w-full"
                  disabled={items.length === 0 || isLoading || isCheckoutLoading}
                >
                  {isCheckoutLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Pay with Stripe <CreditCard className="ml-2 h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
