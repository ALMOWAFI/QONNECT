const process = [
  {
    n: "01",
    title: "Silhouette",
    body: "The garment leads with structure and form. It is a premium piece of tech-apparel that commands space before a word is spoken.",
  },
  {
    n: "02",
    title: "Connection",
    body: "The back print turns passive curiosity into active context. One scan bridges the physical presence to the digital identity.",
  },
  {
    n: "03",
    title: "Protocol",
    body: "LinkedIn, portfolio, or a bespoke Linktree. You control the narrative of the handoff, every time.",
  },
];

const pillars = [
  {
    title: "Signal over noise",
    body: "Designed for those who understand that true influence is quiet, intentional, and high-fidelity.",
  },
  {
    title: "Active Identity",
    body: "A hoodie that evolves. Your physical look stays timeless; your digital destination stays relevant.",
  },
  {
    title: "The Handshake",
    body: "Discard the friction of business cards. Let the garment initiate the protocol of discovery.",
  },
];

const Concept = () => {
  return (
    <section id="concept" className="px-5 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.84fr_1.16fr]">
          <div className="max-w-xl">
            <p className="eyebrow">The Protocol</p>
            <h2 className="display-lg mt-6">
              Sophistication <br/> <em className="italic font-serif text-primary/70 text-4xl md:text-5xl">by design.</em>
            </h2>
          </div>

          <div className="space-y-6">
            <p className="display-md max-w-2xl text-foreground/92 font-serif italic">
              QONNECT is a networking layer disguised as high-end fashion. 
              We build tools for the builders, the founders, and the visionaries.
            </p>
            <p className="section-intro max-w-2xl text-muted-foreground leading-loose">
              It sits at the intersection of craftsmanship and connectivity. 
              The garment carries the signature, the QR secures the identity, and 
              the architecture behind it finishes the story.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {process.map((step) => (
            <article key={step.title} className="surface-panel p-6 md:p-7">
              <span className="nav-text text-muted-foreground">{step.n}</span>
              <h3 className="display mt-5 text-2xl font-medium">{step.title}</h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {step.body}
              </p>
            </article>
          ))}
        </div>

        <div className="surface-panel mt-6 p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((pillar) => (
              <div key={pillar.title}>
                <p className="nav-text text-muted-foreground">{pillar.title}</p>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {pillar.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Concept;
