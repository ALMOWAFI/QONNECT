import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, Globe, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  OrderSummary,
  OrderIntakeSummary,
  submitOrderIntake,
} from "@/lib/orders";

interface IntakeFormProps {
  order: OrderSummary;
  onSubmitted?: (order: OrderSummary) => void;
}

interface EntryState {
  itemKey: string;
  targetUrl: string;
  destinationType: string;
  brief: string;
}

function buildInitialEntries(
  order: OrderSummary,
  existingIntake: OrderIntakeSummary | null
) {
  const byItemKey = new Map(
    (existingIntake?.entries || []).map((entry) => [entry.itemKey, entry])
  );

  return order.items.map((item) => {
    const existing = byItemKey.get(item.itemKey);
    return {
      itemKey: item.itemKey,
      targetUrl: existing?.targetUrl || "",
      destinationType: existing?.destinationType || "linkedin",
      brief: existing?.brief || "",
    };
  });
}

function formatTierLabel(tier: string) {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function renderSubmittedState(
  order: OrderSummary,
  intake: OrderIntakeSummary,
  displayOrderId: string
) {
  return (
    <div className="border border-foreground/10 bg-foreground/5 p-10 text-center animate-in fade-in zoom-in duration-700 md:p-16">
      <CheckCircle2 className="mx-auto mb-6 h-12 w-12 text-primary" />
      <h3 className="display mb-4 text-3xl font-medium">Identity secured.</h3>
      <p className="mx-auto max-w-xl leading-relaxed text-muted-foreground">
        Intake is attached to order{" "}
        <span className="text-foreground">#{displayOrderId}</span>. We now have
        the destination data needed to move your garment into QR generation and
        print preparation.
      </p>

      <div className="mt-8 space-y-4 text-left">
        {order.items.map((item) => {
          const entry = intake.entries.find(
            (candidate) => candidate.itemKey === item.itemKey
          );

          return (
            <div
              key={item.itemKey}
              className="rounded-[1.35rem] border border-border bg-background/70 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="nav-text text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {formatTierLabel(item.tier)} tier
                  </p>
                </div>
                <span className="signal-chip">
                  {entry?.destinationType || "destination"}
                </span>
              </div>

              <p className="mt-4 break-all text-sm leading-7 text-muted-foreground">
                {entry?.targetUrl}
              </p>

              {entry?.brief ? (
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {entry.brief}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const IntakeForm = ({ order, onSubmitted }: IntakeFormProps) => {
  const displayOrderId = useMemo(
    () => order.shortOrderId || order.sessionId.slice(-6).toUpperCase(),
    [order.sessionId, order.shortOrderId]
  );
  const [contactEmail, setContactEmail] = useState(order.customerEmail || "");
  const [entries, setEntries] = useState<EntryState[]>(
    buildInitialEntries(order, order.intake)
  );
  const [savedOrder, setSavedOrder] = useState<OrderSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeOrder = savedOrder || order;
  const activeIntake = activeOrder.intake;

  const updateEntry = (
    itemKey: string,
    field: keyof Omit<EntryState, "itemKey">,
    value: string
  ) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.itemKey === itemKey ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactEmail) {
      toast.error("Please confirm the email for order follow-up.");
      return;
    }

    for (const item of order.items) {
      const entry = entries.find((candidate) => candidate.itemKey === item.itemKey);
      if (!entry?.targetUrl) {
        toast.error(`Add a destination URL for ${item.title}.`);
        return;
      }

      if (item.tier !== "basic" && entry.brief.trim().length < 20) {
        toast.error(
          `Add a clearer build brief for ${item.title}. Standard and Premium need more context.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const updatedOrder = await submitOrderIntake(order.sessionId, {
        contactEmail,
        entries,
      });

      setSavedOrder(updatedOrder);
      onSubmitted?.(updatedOrder);
      toast.success("Identity secured. We are building your bridge.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "We could not save your intake right now."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activeIntake) {
    return renderSubmittedState(activeOrder, activeIntake, displayOrderId);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10 text-center">
        <p className="eyebrow mb-4">Step 2: Connect Your World</p>
        <h2 className="display-md">
          The scannable <em className="italic">identity.</em>
        </h2>
        <p className="mt-4 text-lg italic text-muted-foreground">
          Order #{displayOrderId} is paid. Now attach the actual destination
          that each garment should open.
        </p>
      </div>

      <div className="mb-8 rounded-[1.35rem] border border-border bg-card/75 p-5">
        <p className="nav-text">Order contact</p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          We use this email for intake follow-up and fulfillment communication.
        </p>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-4 w-full border border-border bg-background px-4 py-4 text-sm focus:outline-none focus:border-foreground"
          disabled={isSubmitting}
          required
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {order.items.map((item) => {
          const entry = entries.find((candidate) => candidate.itemKey === item.itemKey);
          if (!entry) return null;

          const requiresBrief = item.tier !== "basic";

          return (
            <section
              key={item.itemKey}
              className="rounded-[1.5rem] border border-border bg-background/75 p-6 md:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="nav-text text-foreground">{item.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {item.variantTitle} / {formatTierLabel(item.tier)} tier / Qty{" "}
                    {item.quantity}
                  </p>
                </div>
                <span className="signal-chip">
                  {requiresBrief ? "Build brief required" : "Direct link"}
                </span>
              </div>

              <div className="mt-6 space-y-5">
                <div className="relative group">
                  <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-muted-foreground transition-colors group-focus-within:text-foreground">
                    <Globe className="h-4 w-4" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://yourworld.com"
                    value={entry.targetUrl}
                    onChange={(e) =>
                      updateEntry(item.itemKey, "targetUrl", e.target.value)
                    }
                    className="w-full border border-border bg-background py-5 pl-14 pr-5 text-lg focus:outline-none focus:border-foreground placeholder:text-muted-foreground/40"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                  <div>
                    <label className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      Destination type
                    </label>
                    <select
                      value={entry.destinationType}
                      onChange={(e) =>
                        updateEntry(item.itemKey, "destinationType", e.target.value)
                      }
                      className="w-full border border-border bg-background px-4 py-4 text-sm focus:outline-none focus:border-foreground"
                      disabled={isSubmitting}
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="portfolio">Portfolio</option>
                      <option value="linktree">Linktree</option>
                      <option value="custom-page">Custom page</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      {requiresBrief ? "Build brief" : "Optional notes"}
                    </label>
                    <textarea
                      value={entry.brief}
                      onChange={(e) =>
                        updateEntry(item.itemKey, "brief", e.target.value)
                      }
                      placeholder={
                        requiresBrief
                          ? "Describe what the page should communicate, include tone, sections, assets, and any references."
                          : "Optional context for this QR destination."
                      }
                      className="min-h-32 w-full border border-border bg-background px-4 py-4 text-sm leading-7 focus:outline-none focus:border-foreground placeholder:text-muted-foreground/40"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-filled w-full group transition-all duration-300 active:scale-[0.98]"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Save intake and continue{" "}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          You can update these details later by reopening the same success link.
        </p>
      </form>
    </div>
  );
};
