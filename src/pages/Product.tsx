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
  const [selectedTier, setSelectedTier] = useState<"basic" | "standard" | "premium">("basic");
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  const tiers = [
    { id: "basic", name: "Basic", price: 0, desc: "QR links to your provided URL." },
    { id: "standard", name: "Standard", price: 20, desc: "We build your Linktree-style page." },
    { id: "premium", name: "Premium", price: 50, desc: "Full custom landing page + domain." },
  ] as const;

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
    
    // In a real Stripe implementation, we would handle the tier upcharge here or in the cart
    await addItem({
      product: {
        node: {
          ...product,
        },
      },
      variantId: selectedVariant.id,
      variantTitle: `${selectedVariant.title} (${selectedTier.toUpperCase()})`,
      price: {
        ...selectedVariant.price,
        amount: (parseFloat(selectedVariant.price.amount) + tiers.find(t => t.id === selectedTier)!.price).toString()
      },
      quantity: 1,
      selectedOptions: [
        ...(selectedVariant.selectedOptions || []),
        { name: "Service Tier", value: selectedTier }
      ],
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
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-lg text-muted-foreground">
                    {product.priceRange.minVariantPrice.currencyCode}{" "}
                    {(parseFloat(product.priceRange.minVariantPrice.amount) + tiers.find(t => t.id === selectedTier)!.price).toFixed(2)}
                  </p>
                  {selectedTier !== "basic" && (
                    <span className="text-xs text-primary uppercase tracking-tighter">
                      + Tier Upgrade
                    </span>
                  )}
                </div>

                {product.description && (
                  <p className="mt-8 text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                    {product.description}
                  </p>
                )}

                {/* Tier Selection */}
                <div className="mt-10 pt-10 border-t border-border">
                  <p className="nav-text mb-4">Service Tier</p>
                  <div className="grid grid-cols-1 gap-3">
                    {tiers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTier(t.id as any)}
                        className={`p-4 text-left border transition-all ${
                          selectedTier === t.id
                            ? "border-foreground bg-foreground/5 shadow-sm"
                            : "border-border hover:border-foreground/50"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium uppercase tracking-widest text-xs">{t.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {t.price > 0 ? `+$${t.price}` : "Included"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

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
