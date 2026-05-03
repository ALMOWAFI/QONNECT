import techImage from "@/assets/tech-edition.png";
import medImage from "@/assets/med-edition.png";

const editions = [
  {
    n: "01",
    name: "Tech",
    tagline: "Systems thinking, worn on the back.",
    accent: "text-tech",
    image: techImage,
    desc: "For builders and engineers who want the piece to feel precise, sharp, and quietly advanced.",
  },
  {
    n: "02",
    name: "Medicine",
    tagline: "Care, clarity, and pulse.",
    accent: "text-medicine",
    image: medImage,
    desc: "For clinicians, students, and researchers who want the signal to feel calm, trusted, and deeply human.",
  },
];

const principles = [
  "One silhouette, tuned by edition tone instead of loud graphic noise.",
  "Accent color shifts by world, while the base palette stays dark and premium.",
  "The QR stays the ritual. The edition changes what the ritual feels like.",
];

const Editions = () => {
  return (
    <section id="editions" className="px-5 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Editions</p>
            <h2 className="display-lg mt-6">Two circles, one signal.</h2>
          </div>
          <p className="section-intro max-w-xl">
            Each edition keeps the same silhouette and scan ritual, then
            changes the tone so the piece feels native to the world you move
            through.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {editions.map((edition) => (
            <article key={edition.name} className="group relative surface-panel overflow-hidden p-0 transition-all duration-700 hover:border-primary/40 active:scale-[0.99]">
              <div className="aspect-[4/5] overflow-hidden bg-muted/20">
                <img
                  src={edition.image}
                  alt={`QONNECT ${edition.name} edition hoodie`}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.05]"
                  loading="lazy"
                />
              </div>
              
              <div className="p-8 md:p-10 border-t border-border/50 bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className={`nav-text ${edition.accent}`}>{edition.n}</span>
                  <span className={`nav-text ${edition.accent}`}>{edition.name}</span>
                </div>

                <p className="display mt-6 text-3xl font-light leading-tight">
                  {edition.tagline}
                </p>
                <p className="mt-5 text-base leading-relaxed text-muted-foreground italic font-serif">
                  {edition.desc}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {principles.map((principle) => (
            <div key={principle} className="surface-panel p-6 border-border/30">
              <p className="text-sm leading-relaxed text-muted-foreground opacity-70">{principle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Editions;
