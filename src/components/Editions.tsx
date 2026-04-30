import editionsImage from "@/assets/qonnect-editions.png";

const editions = [
  {
    n: "01",
    name: "Tech",
    tagline: "Scan to connect.",
    accent: "text-tech",
    ring: "ring-tech",
    desc: "For builders and engineers. Circuitry meets the handshake.",
  },
  {
    n: "02",
    name: "Medicine",
    tagline: "Scan to heal. Impact. Inspire.",
    accent: "text-medicine",
    ring: "ring-medicine",
    desc: "For those who care for others. The pulse beneath the print.",
  },
  {
    n: "03",
    name: "Business",
    tagline: "Scan to build the future.",
    accent: "text-business",
    ring: "ring-business",
    desc: "For founders and operators. Quiet ambition, loud results.",
  },
];

const Editions = () => {
  return (
    <section id="editions" className="px-5 md:px-12 py-24 md:py-32 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <p className="eyebrow text-center">The Editions</p>
        <h2 className="display-lg text-center mt-6">
          Pick your <em className="italic">tribe.</em>
        </h2>
        <p className="tagline text-center mt-6 max-w-2xl mx-auto">
          Three worlds. One bridge. The QR is your handshake.
        </p>
      </div>

      <div className="mt-16 max-w-7xl mx-auto">
        <div className="rounded-sm overflow-hidden border border-border">
          <img
            src={editionsImage}
            alt="QONNECT three editions: Tech, Medicine, Business hoodies with QR codes on the back"
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-border max-w-7xl mx-auto">
        {editions.map((e) => (
          <article key={e.name} className="bg-background p-8 md:p-10">
            <div className="flex items-baseline gap-3 mb-4">
              <span className={`nav-text ${e.accent}`}>{e.n}.</span>
              <span className={`nav-text ${e.accent}`}>{e.name}</span>
            </div>
            <p className="display font-light italic text-2xl md:text-3xl leading-tight">
              {e.tagline}
            </p>
            <p className="text-sm text-muted-foreground mt-6 leading-relaxed">{e.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Editions;
