import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publicKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publicKey) {
      console.warn("Stripe Publishable Key is missing from environment variables.");
    }
    stripePromise = loadStripe(publicKey || "");
  }
  return stripePromise;
};

export async function createCheckoutSession(items: any[]) {
  // This would typically be a call to your backend
  // For now, we'll implement the backend logic in a separate 'server' directory
  // and point the frontend to it.
  
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  const session = await response.json();
  return session;
}
