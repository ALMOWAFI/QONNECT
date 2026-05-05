import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Globe, TrendingUp, ExternalLink,
  Edit2, Check, X, ArrowUpRight, Scan, MapPin, Smartphone,
  Download, QrCode, Sparkles,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { supabase, signOut } from "@/lib/supabase";

interface BridgeAnalytics {
  total_scans:    number;
  unique_scans:   number;
  scans_7d:       number;
  scans_30d:      number;
  last_scanned_at:string | null;
  top_country:    string | null;
  top_device:     string | null;
}

interface Bridge {
  slug:            string;
  targetUrl:       string;
  destinationType: string;
  mode:            string;
  isActive:        boolean;
  createdAt:       string;
  template_data?: {
    links?: { title: string; url: string }[];
    brief?: string;
  };
  order: {
    sessionId:     string;
    status:        string;
    paymentStatus: string;
    items:         any[];
  } | null;
  analytics: BridgeAnalytics;
}

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function trendSign(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function AdvancedManagement({ 
  bridge, 
  onSaved, 
  onCancel 
}: { 
  bridge: Bridge; 
  onSaved: (updates: Partial<Bridge>) => void;
  onCancel: () => void;
}) {
  const [targetUrl, setTargetUrl] = useState(bridge.targetUrl);
  const [links, setLinks]         = useState<{title: string, url: string}[]>(
    bridge.template_data?.links || []
  );
  const [saving, setSaving] = useState(false);

  const isLinktree = bridge.destinationType === 'linktree';

  const handleSave = async () => {
    if (!isLinktree) {
      try { new URL(targetUrl); } catch { toast.error("Enter a valid URL."); return; }
    }
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/members/bridges/${bridge.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          targetUrl: isLinktree ? "" : targetUrl,
          links: isLinktree ? links : undefined
        }),
      });
      if (!res.ok) throw new Error("Sync failed.");
      
      onSaved({ targetUrl: isLinktree ? "" : targetUrl, template_data: { ...bridge.template_data, links } });
      toast.success("Identity synchronized with the cloud.");
    } catch {
      toast.error("Cloud synchronization failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 space-y-8 p-6 border border-primary/10 bg-primary/[0.01] animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex justify-between items-center border-b border-border/40 pb-4">
        <h3 className="display text-[10px] font-medium uppercase tracking-[0.3em] text-primary/60">Digital Configuration</h3>
        <button onClick={onCancel} className="text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Discard</button>
      </div>

      {!isLinktree ? (
        <div className="space-y-4">
          <label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground block">Primary Resolution</label>
          <input
            type="url"
            value={targetUrl}
            onChange={e => setTargetUrl(e.target.value)}
            className="w-full bg-transparent border-b border-border py-4 font-serif text-xl focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/10"
            placeholder="https://yourworld.com"
            autoFocus
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Network Directory</label>
            <button 
              onClick={() => setLinks([...links, {title: "", url: ""}])}
              className="text-[9px] uppercase tracking-[0.2em] text-primary hover:text-primary/70 transition-colors flex items-center gap-1.5"
            ><Plus className="w-3 h-3"/> Add Resource</button>
          </div>
          <div className="space-y-4">
            {links.map((link, idx) => (
              <div key={idx} className="flex gap-3 items-center group animate-in fade-in duration-300">
                <input
                  placeholder="Label"
                  value={link.title}
                  onChange={e => {
                    const nl = [...links];
                    nl[idx].title = e.target.value;
                    setLinks(nl);
                  }}
                  className="w-1/3 bg-background/50 border border-border/60 px-4 py-3 text-xs focus:outline-none focus:border-primary/30 transition-colors"
                />
                <input
                  placeholder="https://"
                  value={link.url}
                  onChange={e => {
                    const nl = [...links];
                    nl[idx].url = e.target.value;
                    setLinks(nl);
                  }}
                  className="flex-1 bg-background/50 border border-border/60 px-4 py-3 text-xs focus:outline-none focus:border-primary/30 transition-colors"
                />
                <button 
                  onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                  className="text-muted-foreground/30 hover:text-destructive transition-colors"
                ><X className="w-4 h-4" /></button>
              </div>
            ))}
            {links.length === 0 && <p className="text-[10px] text-muted-foreground italic text-center py-4">No links assigned yet.</p>}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full btn-filled !py-5 flex items-center justify-center gap-2 group transition-all"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <>Secure Identity <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
        )}
      </button>
    </div>
  );
}

type ArtStatus = "pending" | "ready" | "unavailable" | "failed";

function QrPanel({ slug }: { slug: string }) {
  const [artStatus, setArtStatus] = useState<ArtStatus>("pending");
  const [artUrl, setArtUrl]       = useState<string | null>(null);
  // Art is the default view — toggle to standard on demand
  const [showStandard, setShowStandard] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res  = await fetch(`/api/qr/${slug}/art`);
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "ready") {
          setArtStatus("ready");
          setArtUrl(data.url);
          setRegenerating(false);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "unavailable") {
          setArtStatus("unavailable");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "failed") {
          setArtStatus("failed");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "pending") {
          setArtStatus("pending");
        }
      } catch { /* network hiccup — keep polling */ }
    };

    check();
    pollRef.current = setInterval(check, 8000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [slug]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setArtStatus("pending");
    setShowStandard(false);
    toast.success("AI Art Regeneration started. This takes about 30 seconds.");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/members/bridges/${slug}/regenerate-art`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      // The polling effect will automatically start picking up the "pending" state and then "ready"
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/qr/${slug}/art`);
          const data = await res.json();
          if (data.status === "ready") {
            setArtStatus("ready");
            setArtUrl(data.url);
            setRegenerating(false);
            clearInterval(pollRef.current!);
          }
        } catch { }
      }, 8000);
    } catch (err) {
      toast.error("Failed to start regeneration.");
      setRegenerating(false);
      setArtStatus("ready");
    }
  };

  const showingArt = artStatus === "ready" && artUrl && !showStandard;

  return (
    <div className="space-y-3">
      {/* Art QR — full-width hero display */}
      {showingArt ? (
        <div className="relative group">
          <img
            key={artUrl}
            src={artUrl!}
            alt={`AI art QR code for ${slug}`}
            className="w-full aspect-square object-cover block transition-opacity duration-500"
            loading="lazy"
          />
          {/* Subtle overlay label */}
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1">
            <Sparkles className="w-2.5 h-2.5 text-primary" />
            <span className="text-[8px] uppercase tracking-[0.2em] text-primary">AI Edition</span>
          </div>
        </div>
      ) : (
        <div className="border border-border/30 p-4 relative group">
          <img
            src={`/api/qr/${slug}.png?size=512`}
            alt={`QR code for ${slug}`}
            className={`w-full aspect-square object-contain block ${artStatus === "pending" ? 'opacity-50' : ''}`}
            loading="lazy"
          />
        </div>
      )}

      {/* Toggle + status row */}
      <div className="flex items-center justify-between">
        {artStatus === "ready" && (
          <button
            onClick={() => setShowStandard(v => !v)}
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <QrCode className="w-3 h-3" />
            {showStandard ? "Show art" : "Show standard"}
          </button>
        )}
        {artStatus === "ready" && showingArt && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-[9px] uppercase tracking-[0.2em] text-primary/70 hover:text-primary transition-colors disabled:opacity-50"
          >
            {regenerating ? 'Regenerating...' : 'Regenerate Art'}
          </button>
        )}
        {artStatus === "pending" && (
          <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating AI edition…
          </span>
        )}
        {artStatus === "unavailable" && (
          <span className="text-[9px] text-muted-foreground">Standard QR</span>
        )}
        {artStatus === "failed" && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="text-[9px] uppercase tracking-[0.2em] text-destructive/70 hover:text-destructive transition-colors disabled:opacity-50"
          >
            {regenerating ? "Retrying…" : "AI generation failed — retry"}
          </button>
        )}
      </div>

      {/* Download buttons */}
      <div className="flex gap-2">
        {showingArt ? (
          <a
            href={artUrl!}
            download={`qonnect-${slug}-art.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 border border-primary/30 bg-primary/5 py-2.5 text-[9px] uppercase tracking-[0.2em] text-primary hover:bg-primary/10 transition-all duration-200 active:scale-[0.97]"
          >
            <Download className="w-2.5 h-2.5" /> Download Art QR
          </a>
        ) : (
          <>
            <a
              href={`/api/qr/${slug}.png?size=1024`}
              download={`qonnect-${slug}.png`}
              className="flex-1 flex items-center justify-center gap-1.5 border border-border py-2.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 active:scale-[0.97]"
            >
              <Download className="w-2.5 h-2.5" /> PNG
            </a>
            <a
              href={`/api/qr/${slug}.svg`}
              download={`qonnect-${slug}.svg`}
              className="flex-1 flex items-center justify-center gap-1.5 border border-border py-2.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 active:scale-[0.97]"
            >
              <Download className="w-2.5 h-2.5" /> SVG
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function BridgeCard({ bridge: initial }: { bridge: Bridge }) {
  const [bridge, setBridge] = useState(initial);
  const [editing, setEditing] = useState(false);

  const handleSaved = (newUrl: string) => {
    // Note: ideally we'd refresh the whole bridge object from the server here
    // but for now we just update the targetUrl in the local state.
    setBridge(b => ({ ...b, targetUrl: newUrl }));
    setEditing(false);
  };

  const a = bridge.analytics;

  return (
    <article className="border border-border bg-background/60 p-8 md:p-12 transition-all duration-500 hover:border-primary/20">
      <div className="flex flex-col md:flex-row justify-between gap-10">

        {/* Left — identity */}
        <div className="space-y-7 flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px] uppercase tracking-[0.3em] border border-border px-3 py-1 text-muted-foreground">
              {bridge.order?.items?.[0]?.tier
                ? `${bridge.order.items[0].tier.charAt(0).toUpperCase() + bridge.order.items[0].tier.slice(1)} Tier`
                : bridge.destinationType}
            </span>
            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-primary">
              <span className={`h-1.5 w-1.5 rounded-full ${bridge.order?.status === 'shipped' || bridge.order?.status === 'delivered' ? 'bg-green-500' : 'bg-primary animate-pulse'}`} />
              {
                bridge.order?.status === 'pending_payment' ? 'Awaiting Payment' :
                bridge.order?.status === 'intake_required' ? 'Action Req: Setup Identity' :
                bridge.order?.status === 'ready_to_print' ? 'In the Atelier' :
                bridge.order?.status === 'printing' ? 'Production in Progress' :
                bridge.order?.status === 'shipped' ? 'In Transit' :
                bridge.order?.status === 'delivered' ? 'Active' : 'Active'
              }
            </span>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Your bridge</p>
            <h2 className="text-3xl font-light tracking-tight break-all">
              qonnect.work/b/<span className="font-medium">{bridge.slug}</span>
            </h2>
          </div>

          {!editing && (
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Current destination</p>
              <div className="flex items-center gap-3 group/link">
                <p className="text-muted-foreground font-serif text-lg truncate max-w-md">
                  {bridge.destinationType === 'linktree' ? 'Multi-Link Directory' : bridge.targetUrl}
                </p>
                {bridge.targetUrl && (
                  <a href={bridge.targetUrl} target="_blank" rel="noopener noreferrer"
                    className="text-primary opacity-0 group-hover/link:opacity-100 transition-opacity duration-200">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Shipment tracking */}
          {bridge.order?.shipment && (
            <div className="pt-4 border-t border-border/30">
              <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-3 flex items-center gap-2">
                <Package className="w-3 h-3 text-primary" /> Logistical Tracking
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-medium text-foreground">{bridge.order.shipment.carrier || 'Standard Shipping'}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{bridge.order.shipment.tracking_number || 'Processing...'}</p>
                </div>
                {bridge.order.shipment.tracking_url && (
                  <a 
                    href={bridge.order.shipment.tracking_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[9px] uppercase tracking-widest text-primary border border-primary/20 px-3 py-1.5 hover:bg-primary/5 transition-all"
                  >
                    Track Shipment
                  </a>
                )}
              </div>
            </div>
          )}

          {editing ? (
            <AdvancedManagement 
              bridge={bridge} 
              onSaved={handleSaved} 
              onCancel={() => setEditing(false)} 
            />
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground border border-border px-4 py-2.5 transition-all duration-200 hover:border-foreground/30 hover:text-foreground active:scale-[0.97]"
              >
                <Edit2 className="w-3 h-3" /> Configure Digital ID
              </button>
              {bridge.order?.sessionId && (
                <a
                  href={`/success?session_id=${bridge.order.sessionId}`}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground border border-border/50 px-4 py-2.5 transition-all duration-200 hover:border-foreground/30 hover:text-foreground active:scale-[0.97]"
                >
                  <Scan className="w-3 h-3" /> Fulfillment Log
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right — analytics */}
        <div className="md:w-56 flex-shrink-0 space-y-6 border-t md:border-t-0 md:border-l border-border/50 pt-8 md:pt-0 md:pl-10">

          {/* Total scans */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Total scans</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-light">{a.total_scans.toLocaleString()}</span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              {a.unique_scans} unique · {trendSign(a.scans_7d)} this week
            </p>
          </div>

          {/* Last seen */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Last scanned</p>
            <p className="text-sm font-light">{timeAgo(a.last_scanned_at)}</p>
          </div>

          {/* Top signals */}
          {(a.top_country || a.top_device) && (
            <div className="space-y-2">
              {a.top_country && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span>{a.top_country}</span>
                </div>
              )}
              {a.top_device && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Smartphone className="w-3 h-3 flex-shrink-0" />
                  <span className="capitalize">{a.top_device}</span>
                </div>
              )}
            </div>
          )}

          {/* QR code */}
          <QrPanel slug={bridge.slug} />

          {/* View live */}
          <a
            href={`/b/${bridge.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between border border-border px-4 py-3 text-[10px] uppercase tracking-[0.2em] transition-all duration-200 hover:border-foreground/30 active:scale-[0.97]"
          >
            Preview bridge
            <ArrowUpRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

interface DirectOrder {
  sessionId:     string;
  shortOrderId:  string;
  status:        string;
  paymentStatus: string;
  items:         any[];
  intake:        any | null;
  printAssetUrl: string | null;
  createdAt:     string;
}

const Members = () => {
  const [bridges, setBridges]         = useState<Bridge[]>([]);
  const [directOrders, setDirectOrders] = useState<DirectOrder[]>([]);
  const [loading, setLoading]         = useState(true);
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchBridges = useCallback(async (token: string) => {
    const res = await fetch("/api/members/bridges", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Could not load bridges.");
    return res.json() as Promise<Bridge[]>;
  }, []);

  const fetchDirectOrders = useCallback(async (token: string, bridgeSlugs: string[]) => {
    const res = await fetch("/api/members/orders", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const orders: DirectOrder[] = await res.json();
    // Only show orders that have NO bridge (direct-link mode) — bridge orders already show above
    return orders.filter(o => {
      const entry = o.intake?.entries?.[0];
      return entry?.mode === 'direct' || (!entry?.slug && !bridgeSlugs.includes(entry?.slug));
    });
  }, []);

  useEffect(() => {
    // When a user clicks a fresh magic link they land on /members#access_token=...
    // Supabase processes that hash ASYNC — so INITIAL_SESSION fires with null first,
    // then SIGNED_IN fires once the token exchange completes.
    // We must NOT redirect to /login on INITIAL_SESSION null if a hash token is present.
    const hasMagicLinkHash = window.location.hash.includes('access_token');
    let loaded = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && !loaded) {
        loaded = true;
        setUserEmail(session.user.email ?? null);
        try {
          const data = await fetchBridges(session.access_token);
          setBridges(data);
          const bridgeSlugs = data.map(b => b.slug);
          const direct = await fetchDirectOrders(session.access_token, bridgeSlugs);
          setDirectOrders(direct);

          // Gift Flow Claim Logic
          const params = new URLSearchParams(window.location.search);
          const claimSlug = params.get("claim_slug");
          const s = params.get("s");
          if (claimSlug && s) {
            toast.loading("Securing identity...");
            const claimRes = await fetch(`/api/members/bridges/${claimSlug}/claim?s=${encodeURIComponent(s)}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const claimData = await claimRes.json();
            toast.dismiss();
            if (claimRes.ok) {
              toast.success(claimData.message);
              const refreshed = await fetchBridges(session.access_token);
              setBridges(refreshed);
            } else {
              toast.error(claimData.error || "Claim failed.");
            }
            // Clear parameters to prevent double-claiming attempts on refresh
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (err: any) {
          toast.error(err.message || "Could not load your identity hub.");
        } finally {
          setLoading(false);
        }
      } else if (event === 'INITIAL_SESSION' && !session && !hasMagicLinkHash) {
        // Genuinely no session and no magic link in URL
        setLoading(false);
        navigate("/login");
      } else if (event === 'SIGNED_OUT') {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchBridges]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 px-5 py-20 md:px-12 md:py-32">
        <div className="max-w-5xl mx-auto">

          <header className="mb-16 border-b border-border/50 pb-10 flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-4">Identity Hub</p>
              <h1 className="display-lg">My <em className="italic font-serif">Bridges.</em></h1>
              {userEmail && (
                <p className="text-muted-foreground mt-4 text-sm font-mono">{userEmail}</p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors duration-200 flex-shrink-0"
            >
              Sign out
            </button>
          </header>

          {loading ? (
            <div className="py-32 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
            </div>
          ) : bridges.length === 0 && directOrders.length === 0 ? (
            <div className="border border-border p-20 text-center space-y-6">
              <Globe className="w-10 h-10 mx-auto text-muted-foreground/20" />
              <p className="text-2xl font-light">No orders found.</p>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                Your bridges and orders appear here after purchasing a QONNECT garment.
              </p>
              <a href="/" className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] border border-border px-6 py-3 hover:border-foreground/30 transition-all duration-200">
                Shop the drop <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-4 mb-12">
                {[
                  { label: "Bridges",      value: bridges.length },
                  { label: "Total scans",  value: bridges.reduce((s, b) => s + b.analytics.total_scans, 0).toLocaleString() },
                  { label: "This week",    value: bridges.reduce((s, b) => s + b.analytics.scans_7d, 0).toLocaleString() },
                ].map(stat => (
                  <div key={stat.label} className="border border-border/50 px-6 py-5">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-2">{stat.label}</p>
                    <p className="text-3xl font-light">{stat.value}</p>
                  </div>
                ))}
              </div>

              {bridges.map(bridge => (
                <BridgeCard key={bridge.slug} bridge={bridge} />
              ))}

              {/* Direct-link orders — QR points straight to a URL, no bridge analytics */}
              {directOrders.length > 0 && (
                <div className="mt-12 space-y-4">
                  <div className="border-t border-border/30 pt-10">
                    <p className="eyebrow text-[10px] mb-6">Direct Link Orders</p>
                    <p className="text-muted-foreground text-sm font-serif mb-8">
                      These garments have QR codes that redirect directly to your URL. Scan analytics are not available for direct links.
                    </p>
                  </div>
                  {directOrders.map(order => (
                    <article key={order.sessionId} className="border border-border/50 p-8 space-y-4">
                      <div className="flex justify-between items-start gap-4 flex-wrap">
                        <div className="space-y-1">
                          <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Order #{order.shortOrderId}</p>
                          <p className="text-lg font-light">{order.items[0]?.title || 'QONNECT Garment'}</p>
                          <p className="text-xs text-muted-foreground font-mono">{order.intake?.entries?.[0]?.targetUrl || 'URL not set'}</p>
                        </div>
                        <span className={`text-[9px] uppercase tracking-widest px-3 py-1 border ${
                          order.status === 'shipped' || order.status === 'delivered'
                            ? 'border-green-500/30 text-green-500'
                            : order.status === 'ready_to_print' || order.status === 'printing'
                            ? 'border-primary/30 text-primary'
                            : 'border-border text-muted-foreground'
                        }`}>
                          {order.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {!order.intake && (
                        <a
                          href={`/success?session_id=${order.sessionId}`}
                          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-primary border border-primary/30 px-4 py-2 hover:bg-primary/5 transition-all"
                        >
                          Complete Setup <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Members;
