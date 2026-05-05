import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Globe } from "lucide-react";
import { TemplateRenderer, type TemplateData } from "@/components/templates/TemplateRenderer";

interface SlugResult {
  type: "redirect" | "template" | "claim";
  destination?: string;
  template?: TemplateData;
  slug?: string;
  s?: string;
}

const resolveSlug = async (slug: string): Promise<SlugResult | null> => {
  const s = new URLSearchParams(window.location.search).get('s');
  try {
    const url = s 
      ? `/api/resolve-slug/${encodeURIComponent(slug)}?s=${encodeURIComponent(s)}`
      : `/api/resolve-slug/${encodeURIComponent(slug)}`;
      
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Slug resolution failed:", err);
    return null;
  }
};

const Bridge = () => {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) {
      navigate("/");
      return;
    }

    let isCancelled = false;

    (async () => {
      try {
        const result = await resolveSlug(slug);

        if (isCancelled) return;

        if (!result) {
          setError("not_found");
          return;
        }

        if (result.type === "template" && result.template) {
          setTemplate(result.template);
          return;
        }

        if (result.type === "claim") {
          // Use ?s= from the scanned QR URL, fall back to server-computed sig
          const s = new URLSearchParams(window.location.search).get('s') || result.s;
          navigate(`/claim?slug=${result.slug || slug}${s ? `&s=${s}` : ''}`, { replace: true });
          return;
        }

        if (result.type === "redirect" && result.destination) {
          setTimeout(() => {
            if (!isCancelled) {
              window.location.href = result.destination!;
            }
          }, 800);
          return;
        }

        setError("not_found");
      } catch {
        if (!isCancelled) setError("connection_failed");
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [slug, navigate]);

  // Premium holding page — page is being built
  if (template && (template as any).type === 'pending-build') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5 text-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-1000">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full" />
            <div className="relative bg-background/50 border border-primary/20 p-12 rounded-[2rem] backdrop-blur-md shadow-2xl space-y-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border border-primary/20 animate-pulse" />
                </div>
                <Globe className="w-10 h-10 mx-auto text-primary relative z-10" />
              </div>
              <div>
                <p className="eyebrow text-[10px] text-primary/60 mb-3 tracking-[0.3em]">In the Atelier</p>
                <h1 className="display text-3xl font-light tracking-tight">Your page is being built.</h1>
                <p className="mt-4 text-sm text-muted-foreground font-serif leading-relaxed italic">
                  Our architects are crafting your digital identity. This page will be live within 48 hours.
                </p>
              </div>
              <div className="pt-6 border-t border-border/30 text-xs text-muted-foreground font-mono flex justify-between">
                <span>Bridge</span>
                <span className="text-foreground">/b/{slug}</span>
              </div>
            </div>
          </div>
          <p className="display text-sm font-light tracking-[0.4em] opacity-20 uppercase">QONNECT Identity Engine</p>
        </div>
      </div>
    );
  }

  // Render landing page template instead of redirecting
  if (template) {
    return <TemplateRenderer data={template} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5 text-center">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-1000">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full" />
          <div className="relative bg-background/50 border border-border/50 p-12 rounded-[2rem] backdrop-blur-md shadow-2xl">
            {error ? (
              <>
                <Globe className="w-12 h-12 mx-auto text-muted-foreground/30 mb-6" />
                {error === "not_found" ? (
                  <>
                    <h1 className="display text-2xl mb-4">Page not ready yet.</h1>
                    <p className="text-sm text-muted-foreground leading-relaxed font-serif">
                      This bridge hasn't been activated. If you ordered recently, your page will be live within 24–48 hours depending on your tier. Check your email for updates.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="display text-2xl mb-4">Connection failed.</h1>
                    <p className="text-sm text-muted-foreground leading-relaxed font-serif">
                      We couldn't reach the bridge server. Please try again in a moment.
                    </p>
                  </>
                )}
                <button onClick={() => navigate("/")} className="btn-transparent w-full mt-8">
                  Return Home
                </button>
              </>
            ) : (
              <div className="space-y-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full border border-primary/20 animate-ping" />
                  </div>
                  <Globe className="w-12 h-12 mx-auto text-primary relative z-10" />
                </div>
                
                <div>
                  <p className="eyebrow text-[10px] text-primary/60 mb-3 tracking-[0.3em]">Secure Connection</p>
                  <h1 className="display text-3xl font-light tracking-tight">Initializing...</h1>
                </div>

                <div className="pt-6 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span>Target:</span>
                    <span className="text-foreground">/b/{slug}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono mt-2">
                    <span>Status:</span>
                    <span className="text-primary flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Handshake
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="display text-sm font-light tracking-[0.4em] opacity-20 uppercase">QONNECT Identity Engine</p>
      </div>
    </div>
  );
};

export default Bridge;
