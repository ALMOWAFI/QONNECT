import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PRODUCT_BY_HANDLE_QUERY, storefrontApiRequest } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";

import techImage from "@/assets/dmts.png";
import medImage from "@/assets/b7e9.png";
import heroImage from "@/assets/8d7s.png";

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

// Local Registry (Matches ProductGrid fallback)
const FLAGSHIP_REGISTRY: Record<string, ProductDetail> = {
  "robotics-edition": {
    id: "gid://shopify/Product/flagship-tech",
    title: "QONNECT Hoodie: Robotics Edition",
    handle: "robotics-edition",
    description: "A heavyweight hoodie designed for builders. Features the 'Digital Bridge' back print with technical-luxury aesthetics.\n\n· 450 GSM Heavyweight Cotton\n· Oversized unisex fit\n· Custom QR print on the back\n· High quality print",
    priceRange: { minVariantPrice: { amount: "160.00", currencyCode: "USD" } },
    images: { edges: [{ node: { url: techImage, altText: "Robotics Edition Hoodie" } }] },
    variants: {
      edges: [{
        node: {
          id: "gid://shopify/ProductVariant/v-tech",
          title: "Default Title",
          price: { amount: "160.00", currencyCode: "USD" },
          availableForSale: true,
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      }]
    },
    options: [{ name: "Size", values: ["S", "M", "L", "XL"] }]
  },
  "medicine-edition": {
    id: "gid://shopify/Product/flagship-med",
    title: "QONNECT Hoodie: Medicine Edition",
    handle: "medicine-edition",
    description: "Created for those who care. The Medicine edition features a pulse-inspired back print and a calming high-end finish.\n\n· 450 GSM Heavyweight Cotton\n· Oversized unisex fit\n· Custom QR print on the back\n· High quality print",
    priceRange: { minVariantPrice: { amount: "150.00", currencyCode: "USD" } },
    images: { edges: [{ node: { url: medImage, altText: "Medicine Edition Hoodie" } }] },
    variants: {
      edges: [{
        node: {
          id: "gid://shopify/ProductVariant/v-med",
          title: "Default Title",
          price: { amount: "150.00", currencyCode: "USD" },
          availableForSale: true,
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      }]
    },
    options: [{ name: "Size", values: ["S", "M", "L", "XL"] }]
  },
  "business-edition": {
    id: "gid://shopify/Product/flagship-business",
    title: "QONNECT Hoodie: Business Edition",
    handle: "business-edition",
    description: "Quiet ambition, direct access. The Business edition is for founders who want their scan to open a sharper pitch than a business card.\n\n· 450 GSM Heavyweight Cotton\n· Oversized unisex fit\n· Custom QR print on the back\n· High quality print",
    priceRange: { minVariantPrice: { amount: "165.00", currencyCode: "USD" } },
    images: { edges: [{ node: { url: heroImage, altText: "Business Edition Hoodie" } }] },
    variants: {
      edges: [{
        node: {
          id: "gid://shopify/ProductVariant/v-biz",
          title: "Default Title",
          price: { amount: "165.00", currencyCode: "USD" },
          availableForSale: true,
          selectedOptions: [{ name: "Title", value: "Default Title" }]
        }
      }]
    },
    options: [{ name: "Size", values: ["S", "M", "L", "XL"] }]
  }
};

const Product = () => {
  const { handle } = useParams<{ handle: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [selectedTier, setSelectedTier] = useState<
    "basic" | "standard" | "premium"
  >("basic");
  const [brief, setBrief] = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);

  const tiers = [
    { id: "basic",    name: "Basic",    price: 0,  desc: "QR links to your provided URL. Set your destination after checkout. Active immediately." },
    { id: "standard", name: "Standard", price: 20, desc: "We build your Linktree-style page from your brief. Live within 24 hours of intake." },
    { id: "premium",  name: "Premium",  price: 50, desc: "Full custom landing page built by our architects. Live within 48 hours of intake." },
  ] as const;

  const tierBriefConfig = {
    basic:    { show: false, label: "", placeholder: "" },
    standard: {
      show: true,
      label: "What should your page include?",
      placeholder: "e.g. Links to my GitHub, LinkedIn, portfolio site, and a short bio. Keep the tone minimal and technical.",
    },
    premium: {
      show: true,
      label: "Tell us about your world.",
      placeholder: "Who are you, what do you do, who should be impressed when they scan your hoodie? Include your tone, goals, and any assets we should use. Our architects will take it from here.",
    },
  } as const;

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, {
          handle,
        });
        if (!cancelled && data?.data?.product) {
          const fetchedProduct = data?.data?.product;
          setProduct(fetchedProduct);
          setSelectedVariantId(fetchedProduct?.variants?.edges?.[0]?.node?.id || null);
        } else if (!cancelled && handle && FLAGSHIP_REGISTRY[handle]) {
          const fetchedProduct = FLAGSHIP_REGISTRY[handle];
          setProduct(fetchedProduct);
          setSelectedVariantId(fetchedProduct?.variants?.edges?.[0]?.node?.id || null);
        }
      } catch (err) {
        console.error("Shopify fetch failed, checking local registry.", err);
        if (!cancelled && handle && FLAGSHIP_REGISTRY[handle]) {
          const fetchedProduct = FLAGSHIP_REGISTRY[handle];
          setProduct(fetchedProduct);
          setSelectedVariantId(fetchedProduct?.variants?.edges?.[0]?.node?.id || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const selectedVariant = product?.variants?.edges?.find(
    (variant) => variant.node?.id === selectedVariantId,
  )?.node;

  const handleAdd = async () => {
    if (!product || !selectedVariant) return;

    await addItem({
      product: { node: { ...product } },
      variantId: selectedVariant.id,
      variantTitle: `${selectedVariant.title} (${selectedTier.toUpperCase()})`,
      price: {
        ...selectedVariant.price,
        amount: (
          parseFloat(selectedVariant.price.amount) +
          (tiers.find((tier) => tier.id === selectedTier)?.price || 0)
        ).toString(),
      },
      quantity: 1,
      selectedOptions: [
        ...(selectedVariant.selectedOptions || []),
        { name: "Service Tier", value: selectedTier },
        ...(selectedSize ? [{ name: "Size", value: selectedSize }] : []),
      ],
      brief: brief.trim() || undefined,
    });

    setBrief("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="px-5 py-12 md:px-12 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/"
            className="mb-10 inline-flex items-center gap-2 nav-text text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to drop
          </Link>

          {loading ? (
            <div className="flex justify-center py-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !product ? (
            <div className="py-32 text-center">
              <p className="display text-3xl">Not found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
              <div className="space-y-4">
                {product.images?.edges?.length && product.images.edges.length > 0 ? (
                  product.images.edges.map((image, index) => (
                    <div key={index} className="aspect-[4/5] overflow-hidden bg-muted">
                      {image.node?.url ? (
                        <img
                          src={image.node.url}
                          alt={image.node.altText || product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground">No image</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center bg-muted text-xs uppercase tracking-widest text-muted-foreground">
                    No image
                  </div>
                )}
              </div>

              <div className="md:sticky md:top-28 md:self-start">
                <h1 className="display-md font-medium">{product.title}</h1>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-lg text-muted-foreground">
                    {product.priceRange?.minVariantPrice?.currencyCode || "USD"}{" "}
                    {(
                      parseFloat(product.priceRange?.minVariantPrice?.amount || "0") +
                      (tiers.find((tier) => tier.id === selectedTier)?.price || 0)
                    ).toFixed(2)}
                  </p>
                  {selectedTier !== "basic" && (
                    <span className="text-xs uppercase tracking-tighter text-primary">
                      + Tier Upgrade
                    </span>
                  )}
                </div>

                {product.description && (
                  <p className="mt-8 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                )}

                {/* Size Selection */}
                {product.options?.find(o => o.name === 'Size') && (
                  <div className="mt-10 border-t border-border pt-10">
                    <div className="mb-4 flex items-center gap-2">
                      <p className="nav-text">Select Size</p>
                      <span className="text-[9px] uppercase tracking-[0.2em] text-destructive">Required</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.options.find(o => o.name === 'Size')?.values.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`flex h-12 w-12 items-center justify-center border transition-all duration-300 ${
                            selectedSize === size
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground/50"
                          }`}
                        >
                          <span className="text-xs font-medium">{size}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-10 border-t border-border pt-10">
                  <p className="mb-4 nav-text">Service Tier</p>
                  <div className="grid grid-cols-1 gap-3">
                    {tiers.map((tier) => (
                      <button
                        key={tier.id}
                        onClick={() => setSelectedTier(tier.id)}
                        className={`border p-4 text-left transition-all ${
                          selectedTier === tier.id
                            ? "border-foreground bg-foreground/5 shadow-sm"
                            : "border-border hover:border-foreground/50"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium uppercase tracking-widest">
                            {tier.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tier.price > 0 ? `+$${tier.price}` : "Included"}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {tier.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    Standard and Premium add the page-building service on top
                    of the garment itself.
                  </p>
                </div>

                {/* Tier-contextual brief — shown for Standard + Premium */}
                {tierBriefConfig[selectedTier]?.show && (
                  <div className="mt-8 border-t border-border pt-8 animate-in fade-in slide-in-from-top-2 duration-500">
                    {selectedTier === "premium" && (
                      <div className="mb-4 border border-primary/20 bg-primary/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Briefing Session</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          You're paying for a custom page — not a URL. Share your world and our architects will build it in 48 hours.
                        </p>
                      </div>
                    )}
                    <label className="mb-3 block text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {tierBriefConfig[selectedTier].label}
                    </label>
                    <textarea
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder={tierBriefConfig[selectedTier].placeholder}
                      rows={selectedTier === "premium" ? 6 : 4}
                      className="w-full border border-border bg-background/50 px-5 py-4 text-sm leading-7 focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/20 italic resize-none transition-all"
                    />
                    <p className="mt-2 text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
                      {brief.length > 0 ? `${brief.length} chars` : "Saved to your cart — pre-fills the intake form after checkout"}
                    </p>
                  </div>
                )}

                {product.variants?.edges?.length > 1 && (
                  <div className="mt-8">
                    <p className="mb-3 nav-text">Variant</p>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.edges.map((variant) => (
                        <button
                          key={variant.node?.id}
                          onClick={() => setSelectedVariantId(variant.node?.id)}
                          disabled={!variant.node?.availableForSale}
                          className={`border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                            selectedVariantId === variant.node?.id
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {variant.node?.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={isLoading || !selectedVariant?.availableForSale || (!!product.options?.find(o => o.name === 'Size') && !selectedSize)}
                  className="btn-filled mt-10 w-full disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !selectedVariant?.availableForSale ? (
                    "Sold out"
                  ) : (product.options?.find(o => o.name === 'Size') && !selectedSize) ? (
                    "Select a size"
                  ) : (
                    "Add to cart"
                  )}
                </button>

                <div className="mt-10 space-y-3 border-t border-border pt-8 text-sm text-muted-foreground">
                  <p>- Premium heavyweight fabric</p>
                  <p>- Oversized fit, unisex cut</p>
                  <p>- QR print on the back</p>
                  <p>- High-resolution print finish</p>
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
