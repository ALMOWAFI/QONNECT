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

function EditForm({ bridge, onSaved }: { bridge: Bridge; onSaved: (url: string) => void }) {
  const [url, setUrl]         = useState(bridge.targetUrl);
  const [saving, setSaving]   = useState(false);
  const session_ref           = bridge.order?.sessionId;

  const save = async () => {
    try { new URL(url); } catch { toast.error("Enter a valid URL."); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/members/bridges/${bridge.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ targetUrl: url }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved(url);
      toast.success("Bridge updated. Your QR now points to the new destination.");
    } catch (err: any) {
      toast.error(err.message || "Could not update bridge.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="flex-1 bg-transparent border-b border-primary/50 py-3 text-base font-serif focus:outline-none focus:border-primary transition-all"
        placeholder="https://newdestination.com"
        autoFocus
      />
      <button
        onClick={save}
        disabled={saving}
        className="flex h-9 w-9 items-center justify-center border border-primary/30 bg-primary/5 text-primary transition-all duration-200 hover:bg-primary/10 active:scale-95"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      </button>
    </div>
  );
}

type ArtStatus = "pending" | "ready" | "unavailable";

function QrPanel({ slug }: { slug: string }) {
  const [artStatus, setArtStatus] = useState<ArtStatus>("pending");
  const [artUrl, setArtUrl]       = useState<string | null>(null);
  const [showArt, setShowArt]     = useState(false);
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

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
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "unavailable") {
          setArtStatus("unavailable");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* network hiccup — keep polling */ }
    };

    check();
    pollRef.current = setInterval(check, 8000); // poll every 8s while pending

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [slug]);

  const active = showArt && artStatus === "ready" && artUrl;
  const imgSrc  = active ? artUrl! : `/api/qr/${slug}.png?size=160`;

  return (
    <div className="border border-border/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-1.5">
          <QrCode className="w-3 h-3" /> Your QR
        </p>
        {artStatus === "ready" && (
          <button
            onClick={() => setShowArt(v => !v)}
            className={`flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] px-2 py-1 border transition-all duration-200 ${
              showArt
                ? "border-primary/40 text-primary bg-primary/5"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            {showArt ? "Standard" : "Art"}
          </button>
        )}
        {artStatus === "pending" && (
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Generating art…
          </span>
        )}
      </div>

      {/* QR image */}
      <img
        key={imgSrc}
        src={imgSrc}
        alt={`QR code for ${slug}`}
        width={80}
        height={80}
        className="w-20 h-20 mx-auto block transition-opacity duration-300"
        loading="lazy"
      />

      {/* Download buttons */}
      <div className="flex gap-2">
        {active ? (
          <a
            href={artUrl!}
            download={`qonnect-${slug}-art.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 border border-border py-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 active:scale-[0.97]"
          >
            <Download className="w-2.5 h-2.5" /> Art PNG
          </a>
        ) : (
          <>
            <a
              href={`/api/qr/${slug}.png?size=1024`}
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
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Active
            </span>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Your bridge</p>
            <h2 className="text-3xl font-light tracking-tight break-all">
              qonnect.ai/b/<span className="font-medium">{bridge.slug}</span>
            </h2>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Current destination</p>
            <div className="flex items-center gap-3 group/link">
              <p className="text-muted-foreground font-serif text-lg truncate max-w-md">{bridge.targetUrl}</p>
              <a href={bridge.targetUrl} target="_blank" rel="noopener noreferrer"
                className="text-primary opacity-0 group-hover/link:opacity-100 transition-opacity duration-200">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {editing ? (
            <EditForm bridge={bridge} onSaved={handleSaved} />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground border border-border px-4 py-2.5 transition-all duration-200 hover:border-foreground/30 hover:text-foreground active:scale-[0.97]"
            >
              <Edit2 className="w-3 h-3" /> Update destination
            </button>
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

const Members = () => {
  const [bridges, setBridges]   = useState<Bridge[]>([]);
  const [loading, setLoading]   = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchBridges = useCallback(async (token: string) => {
    const res = await fetch("/api/members/bridges", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Could not load bridges.");
    return res.json() as Promise<Bridge[]>;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Pick up session — works both on direct load and after magic link redirect
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          navigate("/login");
          return;
        }

        setUserEmail(session.user.email ?? null);
        const data = await fetchBridges(session.access_token);
        setBridges(data);
      } catch (err: any) {
        toast.error(err.message || "Could not load your identity hub.");
      } finally {
        setLoading(false);
      }
    })();
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
          ) : bridges.length === 0 ? (
            <div className="border border-border p-20 text-center space-y-6">
              <Globe className="w-10 h-10 mx-auto text-muted-foreground/20" />
              <p className="text-2xl font-light">No bridges found.</p>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                Your bridges appear here once you complete the intake form after purchasing a hoodie.
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
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Members;
