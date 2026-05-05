import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, Mail, Sparkles, QrCode, Check } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

const Claim = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const slug = searchParams.get("slug");
  const s    = searchParams.get("s");

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { navigate("/"); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setLoggedInEmail(session.user.email);
    });
  }, [slug, navigate]);

  // Already-logged-in: claim directly without email step
  const handleDirectClaim = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session.");
      const res = await fetch(`/api/members/bridges/${slug}/claim?s=${encodeURIComponent(s || '')}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Identity secured.");
      navigate("/members");
    } catch (err: any) {
      toast.error(err.message || "Could not claim bridge.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const s = searchParams.get("s");
      // 1. Send magic link to secure the account
      const res = await fetch('/api/auth/claim-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          redirectTo: `${window.location.origin}/members?claim_slug=${slug}&s=${s}`
        })
      });

      if (!res.ok) throw new Error("Authentication service error.");

      setIsSent(true);
      toast.success("Identity link sent! Follow the link to claim your bridge.");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center px-5 py-20">
        <div className="max-w-xl w-full space-y-12 animate-in fade-in duration-1000">
          
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] uppercase tracking-[0.2em] mb-4">
              <Sparkles className="w-3 h-3" /> Unclaimed Garment Detected
            </div>
            <h1 className="display-md leading-tight">
              Claim your <br /> <em className="italic font-serif text-primary/80">digital identity.</em>
            </h1>
            <p className="text-muted-foreground font-serif italic max-w-sm mx-auto">
              This QONNECT garment is ready to be linked to your world.
            </p>
          </div>

          <div className="surface-panel p-10 border-primary/20 bg-primary/[0.02] space-y-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <QrCode className="w-32 h-32" />
            </div>

            {loggedInEmail ? (
              // Already signed in — one-tap claim
              <div className="space-y-8 relative z-10">
                <div className="space-y-2 border-b border-border/50 pb-6">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Signed in as</p>
                  <p className="text-lg font-mono text-foreground">{loggedInEmail}</p>
                </div>
                <p className="text-sm text-muted-foreground font-serif leading-relaxed">
                  You're already signed in. Tap below to permanently link this garment to your account.
                </p>
                <button
                  onClick={handleDirectClaim}
                  disabled={isLoading}
                  className="btn-filled w-full py-6 group flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <><Check className="w-5 h-5" /> Claim Identity</>
                  )}
                </button>
              </div>
            ) : isSent ? (
              <div className="text-center space-y-6 py-4 relative z-10">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-serif">Check your inbox.</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We've sent a secure connection link to <br/>
                    <span className="text-foreground font-sans font-medium">{email}</span>
                  </p>
                </div>
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-40">
                  Follow the link to finalize your bridge settings.
                </p>
              </div>
            ) : (
              <form onSubmit={handleClaimRequest} className="space-y-10 relative z-10">
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-border/50 pb-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Assigned Slug</span>
                    <span className="text-sm font-mono text-primary">qonnect.work/b/{slug}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Enter your email to claim</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="architect@yourworld.com"
                    className="w-full bg-transparent border-b border-border py-4 text-2xl font-serif focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/10"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic opacity-60">
                    We will send a magic link to this address. Once you sign in, this bridge will be permanently tied to your account.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-filled w-full py-6 group flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Initialize Connection <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.3em] opacity-40 leading-relaxed">
            QONNECT Identity Engine <br /> Secure Protocol v2.4
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Claim;