import { useState } from "react";
import { Loader2, ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Login = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/claim-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!res.ok) throw new Error("Could not send magic link.");

      setIsSent(true);
      toast.success("Identity link sent! Check your inbox.");
    } catch (error) {
      toast.error("Authentication service unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center px-5 py-20">
        <div className="max-w-md w-full space-y-12 animate-in fade-in duration-1000">
          <div className="text-center">
            <p className="eyebrow mb-4">Member Access</p>
            <h1 className="display-md">
              Secure your <br /> <em className="italic font-serif text-primary/80">digital identity.</em>
            </h1>
          </div>

          {isSent ? (
            <div className="surface-panel p-10 text-center space-y-6 border-primary/20">
              <Mail className="w-10 h-10 mx-auto text-primary animate-pulse" />
              <p className="text-muted-foreground leading-relaxed italic font-serif">
                We've sent a secure access link to <span className="text-foreground font-sans not-italic">{email}</span>.
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-40">
                The link expires in 15 minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-8">
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-transparent border-b border-border py-6 text-2xl font-serif focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/10"
                  required
                />
                <label className="absolute -top-6 left-0 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Email Address</label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-filled w-full group py-5 active:scale-[0.98] transition-all duration-300"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send Access Link <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em] leading-relaxed max-w-[280px] mx-auto opacity-40">
                New here? Purchase a hoodie first to initialize your bridge.
              </p>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Login;
