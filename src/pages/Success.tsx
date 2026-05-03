import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { IntakeForm } from "@/components/IntakeForm";
import { OrderSummary, fetchOrderSummary } from "@/lib/orders";

const stepCopy = [
  {
    n: "01",
    title: "Order verified",
    body: "We bind the paid order to the garment, selected service tier, and intake record.",
  },
  {
    n: "02",
    title: "Destination attached",
    body: "Your link or build brief becomes the source for the QR destination attached to this hoodie.",
  },
  {
    n: "03",
    title: "QR to fulfillment",
    body: "The asset moves into QR generation, edition artwork composition, and supplier handoff.",
  },
];

const Success = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError("Missing checkout session. Open this page from the Stripe success link.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const summary = await fetchOrderSummary(sessionId);
        if (!cancelled) {
          setOrder(summary);
          setError(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "We could not load your order details.";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="relative">
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-full max-w-4xl -translate-x-1/2 bg-primary/5 blur-[120px]" />

        <section className="px-5 py-20 md:px-12 md:py-32">
          <div className="mx-auto max-w-5xl">
            <div className="mb-16 text-center md:mb-24">
              <p className="eyebrow mb-6">Payment successful</p>
              <h1 className="display-lg">Your order now needs its destination.</h1>
              <p className="tagline mx-auto mt-8 max-w-2xl">
                The payment is only step one. QONNECT becomes real when each
                garment is attached to the digital place it is meant to open.
              </p>
            </div>

            <div className="relative z-10 border border-border bg-background shadow-2xl p-8 md:p-12 lg:p-20">
              {loading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="mx-auto max-w-2xl text-center">
                  <p className="display text-3xl">We need your order link.</p>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    {error}
                  </p>
                </div>
              ) : order ? (
                <IntakeForm order={order} onSubmitted={setOrder} />
              ) : null}
            </div>

            <div className="mt-20 grid grid-cols-1 gap-12 border-t border-border pt-16 text-center md:grid-cols-3 md:text-left">
              {stepCopy.map((step) => (
                <div key={step.title}>
                  <p className="nav-text mb-4 text-primary">{step.n}. {step.title}</p>
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Success;
