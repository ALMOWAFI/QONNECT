import { useEffect, useState } from "react";
import {
  ShopifyProduct,
  PRODUCTS_QUERY,
  storefrontApiRequest,
} from "@/lib/shopify";
import { ProductCard } from "./ProductCard";
import { Loader2 } from "lucide-react";

import techImage from "@/assets/tech-edition.png";
import medImage from "@/assets/med-edition.png";
import heroImage from "@/assets/hero-hoodie.png";

// Flagship Products (Hard-coded fallback)
const FLAGSHIP_PRODUCTS: ShopifyProduct[] = [
  {
    node: {
      id: "gid://shopify/Product/flagship-tech",
      title: "QONNECT Hoodie: Robotics Edition",
      handle: "robotics-edition",
      description: "A heavyweight hoodie designed for builders. Features the 'Digital Bridge' back print with technical-luxury aesthetics.",
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
    }
  },
  {
    node: {
      id: "gid://shopify/Product/flagship-med",
      title: "QONNECT Hoodie: Medicine Edition",
      handle: "medicine-edition",
      description: "Created for those who care. The Medicine edition features a pulse-inspired back print and a calming high-end finish.",
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
    }
  },
  {
    node: {
      id: "gid://shopify/Product/flagship-business",
      title: "QONNECT Hoodie: Business Edition",
      handle: "business-edition",
      description: "Quiet ambition, direct access. The Business edition is for founders who want their scan to open a sharper pitch than a business card.",
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
  }
];

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
        if (!cancelled) {
          const shopifyProducts = data?.data?.products?.edges || [];
          // Merge Shopify products with flagship products, removing duplicates by handle
          const allProducts = [...FLAGSHIP_PRODUCTS];
          shopifyProducts.forEach((sp: ShopifyProduct) => {
            if (!allProducts.find(p => p.node.handle === sp.node.handle)) {
              allProducts.push(sp);
            }
          });
          setProducts(allProducts);
        }
      } catch (err) {
        console.error("Shopify fetch failed, using flagship fallbacks only.", err);
        if (!cancelled) setProducts(FLAGSHIP_PRODUCTS);
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
