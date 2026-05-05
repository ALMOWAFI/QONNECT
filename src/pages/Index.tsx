import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Editions from "@/components/Editions";
import Concept from "@/components/Concept";
import ProductGrid from "@/components/ProductGrid";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { QrCode, Package } from "lucide-react";

import heroHoodie from "@/assets/hero-hoodie.png";

const heroFacts = [
  { value: "02", label: "Active editions" },
  { value: "01", label: "QR per hoodie" },
  { value: "0", label: "Inventory held" },
];

const Index = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth - 0.5) * 20;
    const y = (clientY / innerHeight - 0.5) * 20;
    setMousePos({ x, y });
  };

  return (
    <div className="min-h-screen bg-background text-foreground" onMouseMove={handleMouseMove}>
      <Header />

      <main>
        <section className="relative overflow-hidden px-5 pb-24 pt-16 md:px-12 md:pb-32 md:pt-24">
          <div aria-hidden className="hero-grid" />
          <div aria-hidden className="hero-orb hero-orb-tech opacity-30" />
          <div aria-hidden className="hero-orb hero-orb-medicine opacity-30" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-16 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="max-w-3xl reveal-on-scroll">
                <p className="eyebrow inline-flex rounded-full border border-border/70 bg-background/55 px-4 py-2 backdrop-blur">
                  QONNECT / Drop 01 / 2026
                </p>

                <h1 className="display-xl mt-8 max-w-4xl tracking-tighter leading-[0.9]">
                  Closer than a business card, <br /> <em className="italic font-serif text-primary/80">quieter than a pitch.</em>
                </h1>

                <p className="section-intro mt-10 max-w-2xl text-xl leading-relaxed opacity-80 italic font-serif">
                  A premium garment that turns high-fidelity silhouettes into a living 
                  gateway for your professional world.
                </p>

                <div className="mt-12 flex flex-wrap gap-4">
                  {user ? (
                    <>
                      <div className="w-full mb-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-primary/80 font-medium">Welcome back, {user.email?.split('@')[0]}</p>
                      </div>
                      <Link to="/members" className="btn-filled !px-8 hover:shadow-[0_0_30px_-5px_rgba(232,224,200,0.3)] flex items-center gap-2">
                        <QrCode className="w-4 h-4" /> Manage Your Bridge
                      </Link>
                      <Link to="/members" className="btn-transparent flex items-center gap-2">
                        <Package className="w-4 h-4" /> Track Orders
                      </Link>
                    </>
                  ) : (
                    <>
                      <a href="#shop" className="btn-filled !px-10 hover:shadow-[0_0_30px_-5px_rgba(232,224,200,0.3)]">
                        Shop the Drop
                      </a>
                      <a href="#editions" className="btn-transparent">
                        Explore Editions
                      </a>
                    </>
                  )}
                </div>

                <div className="mt-16 grid gap-4 grid-cols-3 max-w-md">
                  {heroFacts.map((fact) => (
                    <div key={fact.label} className="border-l border-border/50 pl-5">
                      <p className="display text-3xl font-light">{fact.value}</p>
                      <p className="mt-2 text-[9px] uppercase tracking-[0.24em] text-muted-foreground whitespace-nowrap">
                        {fact.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative lg:translate-y-6 reveal-on-scroll perspective-1000">
                <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full" />
                <div 
                  className="relative group overflow-hidden rounded-[2.5rem] border border-border/50 bg-background/40 backdrop-blur-sm p-4 transition-transform duration-200 ease-out preserve-3d"
                  style={{
                    transform: `rotateX(${-mousePos.y}deg) rotateY(${mousePos.x}deg)`,
                  }}
                >
                  <img 
                    src={heroHoodie} 
                    alt="QONNECT Signature Hoodie with QR ritual back print"
                    className="w-full h-auto object-cover rounded-[2rem] transition-transform duration-1000 group-hover:scale-[1.05]"
                    style={{
                      transform: 'translateZ(50px)',
                    }}
                  />
                  <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end" style={{ transform: 'translateZ(80px)' }}>
                    <div>
                      <p className="eyebrow text-white/60 mb-2">Back View</p>
                      <p className="display text-white text-2xl font-light">The Ritual Print</p>
                    </div>
                    <span className="signal-chip bg-white/10 text-white border-white/20 backdrop-blur-md">
                      Scan Enabled
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="reveal-on-scroll">
          <Editions />
        </div>
        <div className="reveal-on-scroll">
          <Concept />
        </div>
        <div className="reveal-on-scroll">
          <ProductGrid />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
