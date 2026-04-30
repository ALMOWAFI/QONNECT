import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PRODUCT_BY_HANDLE_QUERY, storefrontApiRequest } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";

interface ProductDetail {
  id: string;
  title: string;
  description: string;
  handle: string;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: { amount: string; currencyCode: string };
        availableForSale: boolean;
        selectedOptions: Array<{ name: string; value: string }>;
      };
    }>;
  };
  options: Array<{ name: string; values: string[] }>;
}

const Product = () => {
  const { handle } = useParams<{ handle: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
        if (!cancelled && data) {
          const p = data?.data?.product;
          setProduct(p);
          setSelectedVariantId(p?.variants?.edges?.[0]?.node?.id || null);
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
  }, [handle]);

  const selectedVariant = product?.variants.edges.find((v) => v.node.id === selectedVariantId)?.node;

  const handleAdd = async () => {
    if (!product || !selectedVariant) return;
    await addItem({
      product: {
        node: {
          ...product,
        },
      },
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      quantity: 1,
      selectedOptions: selectedVariant.selectedOptions || [],
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="px-5 md:px-12 py-12 md:py-20">
        <div className="max-w-6xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 nav-text text-muted-foreground hover:text-foreground mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>

          {loading ? (
            <div className="py-32 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !product ? (
            <div className="py-32 text-center">
              <p className="display text-3xl">Not found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
              <div className="space-y-4">
                {product.images.edges.length > 0 ? (
                  product.images.edges.map((img, i) => (
                    <div key={i} className="bg-muted aspect-[4/5] overflow-hidden">
                      <img
                        src={img.node.url}
                        alt={img.node.altText || product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))
                ) : (
                  <div className="bg-muted aspect-[4/5] flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest">
                    No image
                  </div>
                )}
              </div>

              <div className="md:sticky md:top-28 md:self-start">
                <h1 className="display-md font-medium">{product.title}</h1>
                <p className="mt-3 text-lg text-muted-foreground">
                  {product.priceRange.minVariantPrice.currencyCode}{" "}
                  {parseFloat(product.priceRange.minVariantPrice.amount).toFixed(2)}
                </p>

                {product.description && (
                  <p className="mt-8 text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                    {product.description}
                  </p>
                )}

                {product.variants.edges.length > 1 && (
                  <div className="mt-8">
                    <p className="nav-text mb-3">Variant</p>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.edges.map((v) => (
                        <button
                          key={v.node.id}
                          onClick={() => setSelectedVariantId(v.node.id)}
                          disabled={!v.node.availableForSale}
                          className={`px-4 py-2 text-xs uppercase tracking-widest border transition-colors ${
                            selectedVariantId === v.node.id
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {v.node.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={isLoading || !selectedVariant?.availableForSale}
                  className="btn-filled w-full mt-10 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : !selectedVariant?.availableForSale ? (
                    "Sold out"
                  ) : (
                    "Add to cart"
                  )}
                </button>

                <div className="mt-10 pt-8 border-t border-border space-y-3 text-sm text-muted-foreground">
                  <p>· Premium heavyweight fabric</p>
                  <p>· Oversized fit · Unisex</p>
                  <p>· QR print on the back</p>
                  <p>· High quality print</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Product;
