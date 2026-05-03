import editionsImage from "@/assets/qonnect-editions.png";

const editions = [
  {
    n: "01",
    name: "Tech",
    tagline: "Systems thinking, worn on the back.",
    accent: "text-tech",
    desc: "For builders and engineers who want the piece to feel precise, sharp, and quietly advanced.",
  },
  {
    n: "02",
    name: "Medicine",
    tagline: "Care, clarity, and pulse.",
    accent: "text-medicine",
    desc: "For clinicians, students, and researchers who want the signal to feel calm, trusted, and deeply human.",
  },
  {
    n: "03",
    name: "Business",
    tagline: "Quiet ambition, direct access.",
    accent: "text-business",
    desc: "For founders and operators who want the scan to open a sharper pitch than a business card ever could.",
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
            <h2 className="display-lg mt-6">Three circles, one signal.</h2>
          </div>
          <p className="section-intro max-w-xl">
            Each edition keeps the same silhouette and scan ritual, then
            changes the tone so the piece feels native to the world you move
            through.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="surface-panel p-4 md:p-5">
            <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/30">
              <img
                src={editionsImage}
                alt="QONNECT editions for technology, medicine, and business."
                className="block h-auto w-full transition-transform duration-700 hover:scale-[1.02]"
                loading="lazy"
              />
            </div>
          </div>

          <div className="grid gap-4">
            {editions.map((edition) => (
              <article key={edition.name} className="surface-panel p-6 md:p-7">
                <div className="flex items-center gap-3">
                  <span className={`nav-text ${edition.accent}`}>{edition.n}</span>
                  <span className={`nav-text ${edition.accent}`}>{edition.name}</span>
                </div>

                <p className="display mt-5 text-2xl font-light leading-tight md:text-3xl">
                  {edition.tagline}
                </p>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {edition.desc}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {principles.map((principle) => (
            <div key={principle} className="surface-panel p-5">
              <p className="text-sm leading-7 text-muted-foreground">{principle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Editions;
