import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";

interface Props {
  product: ShopifyProduct;
}

export const ProductCard = ({ product }: Props) => {
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const node = product.node;
  const variant = node.variants.edges[0]?.node;
  const image = node.images.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!variant) return;
    await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      selectedOptions: variant.selectedOptions || [],
    });
  };

  return (
    <Link
      to={`/product/${node.handle}`}
      className="group block border border-border bg-background transition-all duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:border-foreground/50 active:scale-[0.98]"
    >
      <div className="aspect-[4/5] overflow-hidden bg-muted">
        {image ? (
          <img
            src={image.url}
            alt={image.altText || node.title}
            className="h-full w-full object-cover transition-transform duration-700 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest">
            No image
          </div>
        )}
      </div>
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="display text-xl font-medium truncate group-hover:text-primary transition-colors duration-300">{node.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {price.currencyCode} {parseFloat(price.amount).toFixed(2)}
          </p>
        </div>
        <button
          onClick={handleAdd}
          disabled={isLoading || !variant?.availableForSale}
          className="btn-transparent !py-2 !px-4 text-[10px] disabled:opacity-50 shrink-0"
          aria-label={`Add ${node.title} to cart`}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
        </button>
      </div>
    </Link>
  );
};
