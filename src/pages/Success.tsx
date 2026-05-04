import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, ArrowRight, Download, QrCode } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { IntakeForm } from "@/components/IntakeForm";
import {
  OrderStatusSummary,
  OrderSummary,
  fetchOrderSummary,
} from "@/lib/orders";

function statusTone(state: "complete" | "current" | "upcoming" | "warning") {
  if (state === "complete") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (state === "current") return "border-foreground/30 bg-foreground/10 text-foreground";
  if (state === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-border bg-background/60 text-muted-foreground";
}

function humanizePaymentStatus(status: OrderStatusSummary["payment"]) {
  if (status === "paid") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "expired") return "Expired";
  return "Pending";
}

function humanizeIntakeStatus(status: OrderStatusSummary["intake"]) {
  return status === "submitted" ? "Submitted" : "Pending";
}

function humanizeProductionStatus(status: OrderStatusSummary["production"]) {
  switch (status) {
    case "awaiting_payment":
      return "Awaiting payment";
    case "awaiting_intake":
      return "Awaiting intake";
    case "ready_for_qr":
      return "Ready for QR";
    case "ready_for_supplier":
      return "Ready for supplier";
    case "fulfilled":
      return "Fulfilled";
    case "on_hold":
      return "On hold";
    default:
      return status;
  }
}

function buildStageCards(status: OrderStatusSummary) {
  const paymentState =
    status.payment === "paid"
      ? "complete"
      : status.payment === "failed" || status.payment === "expired"
        ? "warning"
        : "current";

  const intakeState =
    status.intake === "submitted"
      ? "complete"
      : status.payment === "paid"
        ? "current"
        : "upcoming";

  let productionState: "complete" | "current" | "upcoming" | "warning" = "upcoming";
  if (status.production === "fulfilled") {
    productionState = "complete";
  } else if (
    status.production === "ready_for_qr" ||
    status.production === "ready_for_supplier"
  ) {
    productionState = "current";
  } else if (status.production === "on_hold") {
    productionState = "warning";
  }

  return [
    {
      label: "Payment",
      value: humanizePaymentStatus(status.payment),
      body: "Stripe confirms the order and unlocks the downstream handoff.",
      state: paymentState,
    },
    {
      label: "Intake",
      value: humanizeIntakeStatus(status.intake),
      body: "The destination link or page brief that the garment is meant to open.",
      state: intakeState,
    },
    {
      label: "Production",
      value: humanizeProductionStatus(status.production),
      body: "Where the order sits in QR preparation, artwork composition, and supplier handoff.",
      state: productionState,
    },
  ];
}

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

  const stageCards = useMemo(
    () => (order ? buildStageCards(order.status) : []),
    [order]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="relative">
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-full max-w-4xl -translate-x-1/2 bg-primary/5 blur-[120px]" />

        <section className="px-5 py-20 md:px-12 md:py-32">
          <div className="mx-auto max-w-5xl">
            <div className="mb-16 text-center md:mb-24">
              <p className="eyebrow mb-6">Order handoff</p>
              <h1 className="display-lg">Your order now needs its destination.</h1>
              <p className="tagline mx-auto mt-8 max-w-2xl">
                The payment is only step one. QONNECT becomes real when each
                garment is attached to the digital place it is meant to open.
              </p>
            </div>

            <div className="relative z-10 border border-border bg-background shadow-2xl p-8 md:p-12 lg:p-20">
              {loading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                </div>
              ) : error ? (
                <div className="mx-auto max-w-2xl text-center">
                  <p className="display text-3xl">We need your order link.</p>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    {error}
                  </p>
                </div>
              ) : order ? (
                <>
                  <IntakeForm order={order} onSubmitted={setOrder} />

                  {order.intake && (() => {
                    const bridgeSlugs = (order.intake.entries || [])
                      .filter((e: any) => e.mode === 'bridge' && e.slug)
                      .map((e: any) => e.slug as string);
                    return bridgeSlugs.length > 0 ? (
                      <div className="mt-12 border-t border-border/50 pt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-2 mb-8">
                          <QrCode className="w-4 h-4 text-primary" />
                          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your QR {bridgeSlugs.length > 1 ? 'Codes' : 'Code'}</p>
                        </div>
                        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                          {bridgeSlugs.map((slug) => (
                            <div key={slug} className="border border-border/50 p-6 text-center space-y-4">
                              <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-mono">{slug}</p>
                              <img
                                src={`/api/qr/${slug}.png?size=256`}
                                alt={`QR code for ${slug}`}
                                className="w-32 h-32 mx-auto block"
                                loading="lazy"
                              />
                              <p className="text-[9px] text-muted-foreground leading-relaxed">
                                This QR is printed on your hoodie. Scan it to visit your bridge.
                              </p>
                              <div className="flex gap-2">
                                <a
                                  href={`/api/qr/${slug}.png?size=2048`}
                                  download={`qonnect-${slug}.png`}
                                  className="flex-1 flex items-center justify-center gap-1.5 border border-border py-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 active:scale-[0.97]"
                                >
                                  <Download className="w-2.5 h-2.5" /> PNG
                                </a>
                                <a
                                  href={`/api/qr/${slug}.svg`}
                                  download={`qonnect-${slug}.svg`}
                                  className="flex-1 flex items-center justify-center gap-1.5 border border-border py-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 active:scale-[0.97]"
                                >
                                  <Download className="w-2.5 h-2.5" /> SVG
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {order.intake && (
                    <div className="mt-16 border-t border-border/50 pt-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                      <p className="eyebrow text-primary mb-4">You're all set</p>
                      <h3 className="display text-2xl mb-6">Check your email.</h3>
                      <p className="text-muted-foreground mb-10 max-w-md mx-auto italic font-serif text-lg">
                        We've sent an access link to your email. Click it anytime to manage your bridge, track scans, and update your destination URL.
                      </p>
                      <a href="/login" className="btn-transparent !px-12 group inline-flex items-center">
                        Go to My Bridge <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </a>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {order ? (
              <>
                <div className="mt-20 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {stageCards.map((card) => (
                    <article
                      key={card.label}
                      className={`rounded-[1.5rem] border p-6 ${statusTone(card.state)}`}
                    >
                      <p className="nav-text">{card.label}</p>
                      <h2 className="display mt-4 text-2xl font-medium">
                        {card.value}
                      </h2>
                      <p className="mt-3 text-sm leading-7">{card.body}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-10 rounded-[1.5rem] border border-border bg-card/70 p-6 md:p-8">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="eyebrow">Timeline</p>
                      <h2 className="display mt-4 text-3xl font-medium">
                        What the system believes right now.
                      </h2>
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground md:max-w-sm md:text-right">
                      This timeline is generated from the persisted order draft,
                      Stripe payment state, and the intake record attached to this
                      session.
                    </p>
                  </div>

                  <div className="mt-8 space-y-4">
                    {order.timeline.map((event) => (
                      <div
                        key={`${event.type}-${event.at}`}
                        className="grid gap-2 border-t border-border pt-4 md:grid-cols-[180px_1fr]"
                      >
                        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                          {new Date(event.at).toLocaleString()}
                        </div>
                        <div>
                          <p className="nav-text text-foreground">{event.label}</p>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Success;
