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
      className="group reveal-on-scroll block bg-background border border-border/50 hover:border-primary/40 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-2 active:scale-[0.98] hover:shadow-[0_20px_50px_-20px_rgba(232,224,200,0.15)]"
    >
      <div className="aspect-[4/5] overflow-hidden bg-muted relative">
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        {image ? (
          <img
            src={image.url}
            alt={image.altText || node.title}
            className="w-full h-full object-cover transition-transform duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.1]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px] uppercase tracking-[0.2em] opacity-40">
            No image
          </div>
        )}
      </div>
      <div className="p-6 flex items-start justify-between gap-3 bg-background relative z-10">
        <div className="min-w-0">
          <h3 className="display text-xl font-medium truncate transition-colors duration-300 group-hover:text-primary">{node.title}</h3>
          <p className="text-xs text-muted-foreground mt-2 uppercase tracking-[0.1em] font-sans">
            {price.currencyCode} {parseFloat(price.amount).toFixed(2)}
          </p>
        </div>
        <button
          onClick={handleAdd}
          disabled={isLoading || !variant?.availableForSale}
          className="btn-transparent !py-2.5 !px-5 text-[9px] disabled:opacity-50 shrink-0 border-border/50 hover:border-primary/50"
          aria-label={`Add ${node.title} to cart`}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "ADD"}
        </button>
      </div>
    </Link>
  );
};
