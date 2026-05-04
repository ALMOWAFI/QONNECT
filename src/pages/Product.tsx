import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PRODUCT_BY_HANDLE_QUERY, storefrontApiRequest } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";

import techImage from "@/assets/tech-edition.png";
import medImage from "@/assets/med-edition.png";
import heroImage from "@/assets/hero-hoodie.png";

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
    priceRange: { minVariantPrice: { amount: "0.50", currencyCode: "EUR" } },
    images: { edges: [{ node: { url: techImage, altText: "Robotics Edition Hoodie" } }] },
    variants: {
      edges: [{
        node: {
          id: "gid://shopify/ProductVariant/v-tech",
          title: "Default Title",
          price: { amount: "0.50", currencyCode: "EUR" },
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
        const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, {
          handle,
        });
        if (!cancelled && data?.data?.product) {
          const fetchedProduct = data?.data?.product;
          setProduct(fetchedProduct);
          setSelectedVariantId(fetchedProduct?.variants?.edges?.[0]?.node?.id || null);
        } else if (!cancelled && FLAGSHIP_REGISTRY[handle]) {
          const fetchedProduct = FLAGSHIP_REGISTRY[handle];
          setProduct(fetchedProduct);
          setSelectedVariantId(fetchedProduct.variants.edges[0].node.id);
        }
      } catch (err) {
        console.error("Shopify fetch failed, checking local registry.", err);
        if (!cancelled && FLAGSHIP_REGISTRY[handle]) {
          const fetchedProduct = FLAGSHIP_REGISTRY[handle];
          setProduct(fetchedProduct);
          setSelectedVariantId(fetchedProduct.variants.edges[0].node.id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const selectedVariant = product?.variants.edges.find(
    (variant) => variant.node.id === selectedVariantId,
  )?.node;

  const handleAdd = async () => {
    if (!product || !selectedVariant) return;

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
        amount: (
          parseFloat(selectedVariant.price.amount) +
          tiers.find((tier) => tier.id === selectedTier)!.price
        ).toString(),
      },
      quantity: 1,
      selectedOptions: [
        ...(selectedVariant.selectedOptions || []),
        { name: "Service Tier", value: selectedTier },
      ],
    });
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
                {product.images.edges.length > 0 ? (
                  product.images.edges.map((image, index) => (
                    <div key={index} className="aspect-[4/5] overflow-hidden bg-muted">
                      <img
                        src={image.node.url}
                        alt={image.node.altText || product.title}
                        className="h-full w-full object-cover"
                      />
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
                    {product.priceRange.minVariantPrice.currencyCode}{" "}
                    {(
                      parseFloat(product.priceRange.minVariantPrice.amount) +
                      tiers.find((tier) => tier.id === selectedTier)!.price
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

                {product.variants.edges.length > 1 && (
                  <div className="mt-8">
                    <p className="mb-3 nav-text">Variant</p>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.edges.map((variant) => (
                        <button
                          key={variant.node.id}
                          onClick={() => setSelectedVariantId(variant.node.id)}
                          disabled={!variant.node.availableForSale}
                          className={`border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                            selectedVariantId === variant.node.id
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {variant.node.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={isLoading || !selectedVariant?.availableForSale}
                  className="btn-filled mt-10 w-full disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !selectedVariant?.availableForSale ? (
                    "Sold out"
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
