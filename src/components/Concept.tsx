const pillars = [
  {
    n: "01",
    title: "Identity",
    body: "Your QR is your world. Wear it, own it.",
  },
  {
    n: "02",
    title: "Niche pride",
    body: "Tech. Medicine. Business. You pick your tribe.",
  },
  {
    n: "03",
    title: "Premium feel",
    body: "Heavy fabric. Dark palette. No loud logos.",
  },
];

const Concept = () => {
  return (
    <section id="concept" className="px-5 md:px-12 py-24 md:py-32 border-t border-border">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
        <div className="md:col-span-5">
          <p className="eyebrow">The Concept</p>
          <h2 className="display-lg mt-6">
            The <em className="italic">Bridge.</em>
          </h2>
        </div>
        <div className="md:col-span-7">
          <p className="tagline">
            QONNECT is for people who build, heal, or create. The hoodie is a
            living business card — a conversation before the handshake.
          </p>
          <p className="text-muted-foreground mt-8 text-base leading-relaxed">
            Two hands. One connection. Infinite opportunities. Your QR code is
            the bridge to your world. Start a conversation. Open doors. Create
            impact.
          </p>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-px bg-border max-w-5xl mx-auto">
        {pillars.map((p) => (
          <div key={p.title} className="bg-background p-8 md:p-10">
            <span className="nav-text text-muted-foreground">{p.n}</span>
            <h3 className="display font-medium text-2xl mt-4">{p.title}</h3>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Concept;
