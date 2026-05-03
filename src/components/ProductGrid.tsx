import { useEffect, useState } from "react";
import {
  ShopifyProduct,
  PRODUCTS_QUERY,
  storefrontApiRequest,
} from "@/lib/shopify";
import { ProductCard } from "./ProductCard";
import { Loader2 } from "lucide-react";

const ProductGrid = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await storefrontApiRequest(PRODUCTS_QUERY, {
          first: 24,
          query: null,
        });
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
    <section id="shop" className="px-5 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">The Drop</p>
            <h2 className="display-lg mt-4">Shop the first signal.</h2>
          </div>
          <p className="section-intro max-w-md md:text-right">
            Premium heavyweight fabric, oversized unisex fit, and a QR-led back
            print designed to start the right conversation.
          </p>
        </div>

        {loading ? (
          <div className="surface-panel flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="surface-panel py-24 text-center">
            <p className="display text-2xl">No products found.</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Add the next drop in Shopify, then this storefront will pull it
              into the grid automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 md:gap-8">
            {products.map((product) => (
              <ProductCard key={product.node.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductGrid;
