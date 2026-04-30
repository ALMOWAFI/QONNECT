import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Editions from "@/components/Editions";
import Concept from "@/components/Concept";
import ProductGrid from "@/components/ProductGrid";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main>
        {/* Hero */}
        <section className="relative px-5 md:px-12 pt-24 md:pt-40 pb-24 md:pb-32 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <p className="eyebrow text-center">QONNECT — V1.0 · 2026</p>
            <h1 className="display-xl text-center mt-8 font-light">
              Wear your <em className="italic font-light">world.</em>
            </h1>
            <p className="tagline text-center mt-10 max-w-2xl mx-auto">
              The hoodie as a living business card. A conversation before the
              handshake.
            </p>
            <div className="flex items-center justify-center gap-4 mt-12">
              <a href="#shop" className="btn-filled">
                Shop the drop
              </a>
              <a href="#concept" className="btn-transparent">
                The concept
              </a>
            </div>
          </div>

          {/* decorative line */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
          />
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
