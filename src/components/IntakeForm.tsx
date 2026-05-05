import { useMemo, useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, Globe, ArrowRight, Check, X } from "lucide-react";
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
  mode: "direct" | "bridge";
  targetUrl: string;
  slug: string;
  destinationType: string;
  brief: string;
  links: { title: string; url: string }[];
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
    const defaultMode = item.tier === "basic" ? "direct" : "bridge";

    return {
      itemKey: item.itemKey,
      mode: (existing as any)?.mode || defaultMode,
      // Premium: no URL from user — they're paying for a custom build
      targetUrl: item.tier === "premium"
        ? (existing?.targetUrl || "#pending-build")
        : (existing?.targetUrl || ""),
      slug: existing?.slug || "",
      destinationType: existing?.destinationType || "custom-page",
      // Pre-populate from cart brief if available
      brief: existing?.brief || item.brief || "",
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
                    {(entry as any)?.mode === 'bridge' ? 'QONNECT Bridge' : 'Direct Link'} · {formatTierLabel(item.tier)} tier · {item.selectedOptions?.find((o: any) => o.name === 'Size')?.value || 'N/A'}
                  </p>
                  </div>
                  <span className="signal-chip">
                  {entry?.destinationType || "destination"}
                  </span>
                  </div>

                  <p className="mt-4 break-all text-sm leading-7 text-muted-foreground">
                  {(entry as any)?.mode === 'bridge' ? `qonnect.work/b/${entry?.slug}` : entry?.targetUrl}       
                  </p>
              {entry?.brief ? (
                <p className="mt-4 text-sm leading-7 text-muted-foreground italic">
                  &ldquo;{entry.brief}&rdquo;
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Slug availability state per itemKey
type SlugStatus = "idle" | "checking" | "available" | "taken" | "short";

function useSlugAvailability(slug: string, sessionId: string, enabled: boolean) {
  const [status, setStatus] = useState<SlugStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !slug) { setStatus("idle"); return; }
    if (slug.length < 3) { setStatus("short"); return; }

    setStatus("checking");
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/slugs/${encodeURIComponent(slug)}/available?sessionId=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        setStatus(data.available ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [slug, sessionId, enabled]);

  return status;
}

function SlugStatusIcon({ status }: { status: SlugStatus }) {
  if (status === "checking") return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  if (status === "available") return <Check className="w-4 h-4 text-emerald-500" />;
  if (status === "taken")    return <X className="w-4 h-4 text-destructive" />;
  return null;
}

function SlugStatusText({ status }: { status: SlugStatus }) {
  if (status === "available") return <span className="text-[10px] text-emerald-500 uppercase tracking-[0.2em]">Available</span>;
  if (status === "taken")     return <span className="text-[10px] text-destructive uppercase tracking-[0.2em]">Already taken</span>;
  if (status === "short")     return <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Min 3 characters</span>;
  return null;
}

function SlugField({
  slug, sessionId, disabled, onChange,
}: {
  slug: string;
  sessionId: string;
  disabled: boolean;
  onChange: (val: string) => void;
}) {
  const status = useSlugAvailability(slug, sessionId, slug.length >= 3);

  return (
    <div className="relative group pt-4 animate-in slide-in-from-top-4 duration-700">
      <label className="absolute top-0 left-0 text-[10px] uppercase tracking-[0.22em] text-primary/60 font-medium">
        Choose your unique slug
      </label>
      <div className="flex items-end border-b border-border focus-within:border-primary/50 transition-all">
        <span className="pointer-events-none text-primary/40 font-mono text-lg pb-[1.35rem] pr-1 whitespace-nowrap">
          qonnect.ai/b/
        </span>
        <input
          type="text"
          placeholder="username"
          value={slug}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          className="flex-1 bg-transparent py-6 pr-10 text-2xl font-serif focus:outline-none placeholder:text-muted-foreground/10"
          required
          disabled={disabled}
        />
        {/* Status icon — right side of input */}
        <span className="absolute right-0 bottom-[1.6rem]">
          <SlugStatusIcon status={status} />
        </span>
      </div>
      {/* Status text below */}
      <div className="mt-2 h-4">
        <SlugStatusText status={status} />
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

  const addLink = (itemKey: string) => {
    setEntries(current => current.map(entry => {
      if (entry.itemKey !== itemKey) return entry;
      return { ...entry, links: [...entry.links, { title: "", url: "" }] };
    }));
  };

  const updateLink = (itemKey: string, linkIndex: number, field: 'title' | 'url', value: string) => {
    setEntries(current => current.map(entry => {
      if (entry.itemKey !== itemKey) return entry;
      const newLinks = [...entry.links];
      newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
      return { ...entry, links: newLinks };
    }));
  };

  const removeLink = (itemKey: string, linkIndex: number) => {
    setEntries(current => current.map(entry => {
      if (entry.itemKey !== itemKey) return entry;
      return { ...entry, links: entry.links.filter((_, idx) => idx !== linkIndex) };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactEmail) {
      toast.error("Please confirm the email for order follow-up.");
      return;
    }

    for (const item of order.items) {
      const entry = entries.find((candidate) => candidate.itemKey === item.itemKey);

      if (item.tier === "premium") {
        // Premium: brief is mandatory, no URL needed
        if (!entry?.brief || entry.brief.trim().length < 30) {
          toast.error(`Give us more detail in your brief for ${item.title}. The more you share, the better your page.`);
          return;
        }
      } else {
        // Basic / Standard: URL required
        if (!entry?.targetUrl) {
          toast.error(`Add a destination URL for ${item.title}.`);
          return;
        }
        if (entry.mode === "bridge" && !entry.slug) {
          toast.error(`Choose a slug for your ${item.title} bridge.`);
          return;
        }
        if (item.tier === "standard" && entry.brief.trim().length < 20) {
          toast.error(`Add a build brief for ${item.title} — Standard tier needs context to build your page.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const updatedOrder = await submitOrderIntake(order.sessionId, {
        contactEmail,
        entries: entries as any,
      });

      setSavedOrder(updatedOrder);
      onSubmitted?.(updatedOrder);
      toast.success("Identity secured. We are building your bridge.");

      // Auto-send magic link so user can access their bridge dashboard later
      try {
        await fetch('/api/auth/claim-bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: contactEmail }),
        });
        toast.success(`Access link sent to ${contactEmail} — check your inbox to manage your bridge.`, { duration: 6000 });
      } catch {
        // Non-fatal — user can still request it manually from /login
      }
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
      <div className="mb-12 text-center">
        <p className="eyebrow mb-4">Step 2: Identity Selection</p>
        <h2 className="display-md">
          Define the <em className="italic">connection.</em>
        </h2>
        <p className="mt-4 text-lg italic text-muted-foreground">
          Order #{displayOrderId} is paid. Now choose how you want to be discovered.
        </p>
      </div>

      <div className="mb-16 rounded-[1.35rem] border border-border bg-card/75 p-5">
        <p className="nav-text text-[10px]">Order contact</p>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-4 w-full border-b border-border bg-transparent py-4 text-lg font-serif focus:outline-none focus:border-foreground transition-all"
          disabled={isSubmitting}
          required
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-20">
        {order.items.map((item) => {
          const entry = entries.find((candidate) => candidate.itemKey === item.itemKey);
          if (!entry) return null;

          const isPremium  = item.tier === "premium";
          const isStandard = item.tier === "standard";

          return (
            <section key={item.itemKey} className="space-y-10 animate-in fade-in duration-700">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <p className="nav-text text-foreground">
                  {item.title} <span className="opacity-40 ml-2">/ {item.variantTitle}</span>
                </p>
                <span className="signal-chip">{formatTierLabel(item.tier)} Tier</span>
              </div>

              {/* ── PREMIUM: Briefing Session only, no URL ── */}
              {isPremium ? (
                <div className="bg-foreground/[0.02] border border-primary/20 p-8 md:p-12 space-y-8">
                  <div>
                    <p className="eyebrow text-primary mb-2">Briefing Session</p>
                    <h3 className="display text-2xl font-medium">Tell us about your world.</h3>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      You've paid for a custom page — our architects will build it in 48 hours.
                      No URL needed. The more detail you give, the better the result.
                    </p>
                  </div>

                  <div>
                    <label className="mb-3 block text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      Your brief <span className="text-primary">*</span>
                    </label>
                    <textarea
                      value={entry.brief}
                      onChange={(e) => updateEntry(item.itemKey, "brief", e.target.value)}
                      placeholder="Who are you, what do you do, and who should be impressed when they scan your hoodie? Include your tone, key sections, any links or assets we should reference, and what feeling the page should leave."
                      rows={8}
                      className="w-full border border-border bg-background/50 px-6 py-5 text-base leading-7 focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/20 italic resize-none"
                      disabled={isSubmitting}
                    />
                    <p className="mt-2 text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
                      {entry.brief.length < 30
                        ? `${30 - entry.brief.length} more characters needed`
                        : `${entry.brief.length} chars · Looking good`}
                    </p>
                  </div>

                  {/* Still need a slug for the bridge URL */}
                  <SlugField
                    slug={entry.slug}
                    sessionId={order.sessionId}
                    disabled={isSubmitting}
                    onChange={(val) => updateEntry(item.itemKey, "slug", val)}
                  />
                </div>
              ) : (
                /* ── BASIC / STANDARD: URL + optional mode + brief ── */
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => updateEntry(item.itemKey, "mode", "direct")}
                      className={`p-8 text-left border transition-all duration-500 ${
                        entry.mode === "direct"
                          ? "border-foreground bg-foreground/5"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <p className="nav-text text-[10px] mb-3 opacity-40">Option 01</p>
                      <h4 className="display text-2xl mb-3 font-medium">Direct Link</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        QR points directly to your URL. Fast and permanent.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateEntry(item.itemKey, "mode", "bridge")}
                      className={`p-8 text-left border transition-all duration-500 relative overflow-hidden ${
                        entry.mode === "bridge"
                          ? "border-foreground bg-foreground/5 shadow-[0_0_40px_-15px_rgba(232,224,200,0.2)]"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <p className="nav-text text-[10px] opacity-40">Option 02</p>
                        <span className="text-[9px] uppercase tracking-tighter text-primary bg-primary/10 px-2 py-0.5">Recommended</span>
                      </div>
                      <h4 className="display text-2xl mb-3 font-medium">QONNECT Bridge</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        A permanent slug (qonnect.ai/b/you) — swap your destination anytime. Includes scan analytics.
                      </p>
                    </button>
                  </div>

                  <div className="bg-foreground/[0.02] border border-border/50 p-8 md:p-12 space-y-10">
                    <div className="relative group">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-muted-foreground group-focus-within:text-foreground transition-colors">
                        <Globe className="w-5 h-5" />
                      </div>
                      <input
                        type="url"
                        placeholder="https://yourworld.com"
                        value={entry.targetUrl}
                        onChange={(e) => updateEntry(item.itemKey, "targetUrl", e.target.value)}
                        className="w-full bg-transparent border-b border-border py-6 pl-12 pr-4 text-2xl font-serif focus:outline-none focus:border-foreground transition-all placeholder:text-muted-foreground/10"
                        required
                      />
                      <label className="absolute -top-6 left-0 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Destination URL</label>
                    </div>

                    {entry.mode === "bridge" && (
                      <SlugField
                        slug={entry.slug}
                        sessionId={order.sessionId}
                        disabled={isSubmitting}
                        onChange={(val) => updateEntry(item.itemKey, "slug", val)}
                      />
                    )}

                    <div className="grid gap-10 md:grid-cols-[250px_1fr] pt-4">
                      <div>
                        <label className="mb-3 block text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          Destination type
                        </label>
                        <select
                          value={entry.destinationType}
                          onChange={(e) => updateEntry(item.itemKey, "destinationType", e.target.value)}
                          className="w-full border-b border-border bg-transparent py-4 text-sm focus:outline-none focus:border-foreground appearance-none cursor-pointer"
                          disabled={isSubmitting}
                        >
                          <option value="linkedin">LinkedIn Profile</option>
                          <option value="portfolio">Portfolio Site</option>
                          <option value="linktree">Linktree / Bio-link</option>
                          <option value="custom-page">Custom QONNECT Page</option>
                          <option value="other">Other Destination</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-3 block text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          {isStandard ? "Build brief *" : "Optional notes"}
                        </label>
                        <textarea
                          value={entry.brief}
                          onChange={(e) => updateEntry(item.itemKey, "brief", e.target.value)}
                          placeholder={
                            isStandard
                              ? "What links, sections, and tone should your page have? We'll build it from this."
                              : "Optional context for our fulfillment team."
                          }
                          className="min-h-32 w-full border border-border bg-background/50 px-6 py-6 text-base leading-7 focus:outline-none focus:border-foreground placeholder:text-muted-foreground/20 italic"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
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
              Confirm Identity & Start Fulfillment{" "}
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
