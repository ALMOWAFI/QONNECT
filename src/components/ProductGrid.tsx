import { useEffect, useState } from "react";
import { ShopifyProduct, PRODUCTS_QUERY, storefrontApiRequest } from "@/lib/shopify";
import { ProductCard } from "./ProductCard";
import { Loader2 } from "lucide-react";

const ProductGrid = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await storefrontApiRequest(PRODUCTS_QUERY, { first: 24, query: null });
        if (!cancelled && data) {
          setProducts(data?.data?.products?.edges || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="shop" className="px-5 md:px-12 py-24 md:py-32 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="eyebrow">The Drop</p>
            <h2 className="display-lg mt-4">Shop.</h2>
          </div>
          <p className="hidden md:block text-sm text-muted-foreground max-w-xs text-right">
            Premium heavyweight fabric. Oversized fit. Unisex.
          </p>
        </div>

        {loading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-border">
            <p className="display text-2xl">No products found</p>
            <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
              Tell the chat what to drop next — name, edition, and price.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {products.map((p) => (
              <ProductCard key={p.node.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductGrid;
