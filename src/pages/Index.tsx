import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Editions from "@/components/Editions";
import Concept from "@/components/Concept";
import ProductGrid from "@/components/ProductGrid";

import heroHoodie from "@/assets/hero-hoodie.png";

const heroFacts = [
  { value: "02", label: "Active editions" },
  { value: "01", label: "QR per hoodie" },
  { value: "0", label: "Inventory held" },
];

// ... (audience array)

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main>
        <section className="relative overflow-hidden px-5 pb-24 pt-16 md:px-12 md:pb-32 md:pt-24">
          <div aria-hidden className="hero-grid" />
          <div aria-hidden className="hero-orb hero-orb-tech opacity-20" />
          <div aria-hidden className="hero-orb hero-orb-medicine opacity-20" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-16 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="max-w-3xl">
                <p className="eyebrow inline-flex rounded-full border border-border/70 bg-background/55 px-4 py-2 backdrop-blur">
                  QONNECT / Drop 01 / 2026
                </p>

                <h1 className="display-xl mt-8 max-w-4xl tracking-tighter">
                  Wear the <br /> <em className="italic font-serif">conversation.</em>
                </h1>

                <p className="section-intro mt-10 max-w-2xl text-xl leading-relaxed">
                  A premium heavyweight hoodie that turns your back print into a living
                  entry point for your professional world.
                </p>

                <div className="mt-12 flex flex-wrap gap-4">
                  <a href="#shop" className="btn-filled !px-10">
                    Shop the Drop
                  </a>
                  <a href="#editions" className="btn-transparent">
                    Explore Editions
                  </a>
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

              <div className="relative lg:translate-y-6">
                <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full" />
                <div className="relative group overflow-hidden rounded-[2rem] border border-border/50 bg-background/40 backdrop-blur-sm p-4">
                  <img 
                    src={heroHoodie} 
                    alt="QONNECT Signature Hoodie with QR ritual back print"
                    className="w-full h-auto object-cover rounded-[1.5rem] transition-transform duration-1000 group-hover:scale-[1.03]"
                  />
                  <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
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

        <Editions />
        <Concept />
        <ProductGrid />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
