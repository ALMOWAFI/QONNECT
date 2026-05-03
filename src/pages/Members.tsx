import { useEffect, useState } from "react";
import { Loader2, Globe, TrendingUp, ExternalLink, Edit2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

const Members = () => {
  const [bridges, setBridges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, we would fetch the user's bridges from Supabase
    // For now, we show a premium "Empty State" or mock the user's active hoodie
    setTimeout(() => {
      setBridges([
        { 
          slug: "ali-777", 
          targetUrl: "https://linkedin.com/in/almowafi",
          edition: "Robotics",
          scans: 124,
          status: "Active"
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 px-5 py-20 md:px-12 md:py-32">
        <div className="max-w-5xl mx-auto">
          <header className="mb-16 border-b border-border/50 pb-10">
            <p className="eyebrow mb-4">Identity Hub</p>
            <h1 className="display-lg">My <em className="italic font-serif">Bridges.</em></h1>
            <p className="text-muted-foreground mt-6 max-w-lg leading-relaxed font-serif text-lg">
              Manage your digital identity and see how your world is being discovered in the physical realm.
            </p>
          </header>

          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
            </div>
          ) : bridges.length === 0 ? (
            <div className="surface-panel p-20 text-center space-y-6">
              <Globe className="w-12 h-12 mx-auto text-muted-foreground/20" />
              <p className="display text-2xl font-light">No bridges found.</p>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                Purchase your first QONNECT hoodie to initialize your digital bridge.
              </p>
            </div>
          ) : (
            <div className="grid gap-8">
              {bridges.map((bridge) => (
                <article key={bridge.slug} className="surface-panel p-8 md:p-12 group transition-all duration-700 hover:border-primary/30">
                  <div className="flex flex-col md:flex-row justify-between gap-10">
                    <div className="space-y-6 flex-1">
                      <div className="flex items-center gap-4">
                        <span className="signal-chip">Edition: {bridge.edition}</span>
                        <span className="text-[10px] uppercase tracking-widest text-primary">● {bridge.status}</span>
                      </div>
                      
                      <div>
                        <p className="eyebrow text-[10px] mb-2 opacity-40">Your unique handle</p>
                        <h2 className="display text-4xl font-medium tracking-tight">qonnect.ai/b/{bridge.slug}</h2>
                      </div>

                      <div className="space-y-2">
                        <p className="eyebrow text-[10px] opacity-40">Current destination</p>
                        <div className="flex items-center gap-3 group/link">
                          <p className="text-muted-foreground font-serif text-xl truncate">{bridge.targetUrl}</p>
                          <a href={bridge.targetUrl} target="_blank" className="text-primary opacity-0 group-hover/link:opacity-100 transition-opacity">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="md:w-64 space-y-6 border-t md:border-t-0 md:border-l border-border/50 pt-10 md:pt-0 md:pl-10">
                      <div className="space-y-1">
                        <p className="eyebrow text-[10px] opacity-40">Scan Analytics</p>
                        <div className="flex items-baseline gap-2">
                          <span className="display text-4xl font-medium">{bridge.scans}</span>
                          <TrendingUp className="w-4 h-4 text-primary" />
                        </div>
                        <p className="text-[10px] uppercase tracking-tighter opacity-40">Discoveries</p>
                      </div>

                      <button 
                        onClick={() => toast.info("Bridge editing will be enabled once your order ships.")}
                        className="btn-transparent w-full text-[10px] py-3"
                      >
                        <Edit2 className="w-3 h-3 mr-2" /> Update Link
                      </button>
                    </div>
                  </div>
                </article>
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
