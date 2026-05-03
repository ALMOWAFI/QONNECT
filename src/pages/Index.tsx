import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Editions from "@/components/Editions";
import Concept from "@/components/Concept";
import ProductGrid from "@/components/ProductGrid";

const heroFacts = [
  { value: "03", label: "Edition worlds" },
  { value: "01", label: "QR per hoodie" },
  { value: "0", label: "Inventory held" },
];

const serviceTiers = [
  {
    name: "Basic",
    note: "You bring the link.",
    body: "We generate the QR and build the hoodie around your destination.",
  },
  {
    name: "Standard",
    note: "You bring the story.",
    body: "We create a polished profile page, then wire the scan to it.",
  },
  {
    name: "Premium",
    note: "You bring the ambition.",
    body: "We build the landing page, shape the flow, and point the QR at your own world.",
  },
];

const audience = ["Builders", "Clinicians", "Founders", "Operators", "Creators"];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main>
        <section className="relative overflow-hidden px-5 pb-24 pt-16 md:px-12 md:pb-32 md:pt-24">
          <div aria-hidden className="hero-grid" />
          <div aria-hidden className="hero-orb hero-orb-tech" />
          <div aria-hidden className="hero-orb hero-orb-medicine" />
          <div aria-hidden className="hero-orb hero-orb-business" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
              <div className="max-w-3xl">
                <p className="eyebrow inline-flex rounded-full border border-border/70 bg-background/55 px-4 py-2 backdrop-blur">
                  QONNECT / Drop 01 / 2026
                </p>

                <h1 className="display-xl mt-8 max-w-4xl">
                  Wear the conversation.
                </h1>

                <p className="section-intro mt-8 max-w-2xl">
                  A premium hoodie that turns your back print into a living
                  entry point for your LinkedIn, portfolio, or custom landing
                  page.
                </p>

                <div className="mt-10 flex flex-wrap gap-4">
                  <a href="#shop" className="btn-filled">
                    Shop the first drop
                  </a>
                  <a href="#editions" className="btn-transparent">
                    Explore editions
                  </a>
                </div>

                <div className="mt-12 grid gap-4 sm:grid-cols-3">
                  {heroFacts.map((fact) => (
                    <div key={fact.label} className="surface-panel p-5 md:p-6">
                      <p className="display text-4xl font-light">{fact.value}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {fact.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-panel p-6 md:p-8 lg:translate-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-md">
                    <p className="eyebrow text-left">Signal stack</p>
                    <h2 className="display-md mt-4">
                      One hoodie, three ways to land the scan.
                    </h2>
                  </div>
                  <span className="signal-chip">Made to order</span>
                </div>

                <div className="mt-8 space-y-3">
                  {serviceTiers.map((tier) => (
                    <article
                      key={tier.name}
                      className="rounded-[1.35rem] border border-border/70 bg-background/65 p-5 transition-transform duration-500 hover:-translate-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="nav-text text-foreground">{tier.name}</p>
                        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                          {tier.note}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {tier.body}
                      </p>
                    </article>
                  ))}
                </div>

                <div className="mt-8 border-t border-border/70 pt-5 text-sm leading-7 text-muted-foreground">
                  Heavyweight silhouette. Quiet front. QR-led back graphic.
                  Built for people who want the first question to be, "What
                  does that open?"
                </div>
              </div>
            </div>

            <div className="mt-16 flex flex-wrap items-center gap-3 border-t border-border/70 pt-6">
              {audience.map((label) => (
                <span key={label} className="signal-chip">
                  {label}
                </span>
              ))}
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
