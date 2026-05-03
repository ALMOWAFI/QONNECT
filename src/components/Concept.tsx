const process = [
  {
    n: "01",
    title: "Wear it",
    body: "The garment leads with silhouette first, then reveals the QR as the detail that matters.",
  },
  {
    n: "02",
    title: "They scan it",
    body: "The back print turns curiosity into context in one gesture, without breaking the conversation.",
  },
  {
    n: "03",
    title: "Your page opens",
    body: "LinkedIn, portfolio, or a fully custom landing page, depending on how deep you want the handoff to go.",
  },
];

const pillars = [
  {
    title: "Identity over merch",
    body: "This should feel like personal signaling, not generic branded apparel.",
  },
  {
    title: "Quiet front, active back",
    body: "The piece stays premium from the front, then becomes interactive once someone moves around it.",
  },
  {
    title: "Networking as ritual",
    body: "Business cards disappear in drawers. A scannable garment keeps the introduction alive.",
  },
];

const Concept = () => {
  return (
    <section id="concept" className="px-5 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.84fr_1.16fr]">
          <div className="max-w-xl">
            <p className="eyebrow">The Bridge</p>
            <h2 className="display-lg mt-6">
              Closer than a business card, quieter than a pitch.
            </h2>
          </div>

          <div className="space-y-6">
            <p className="display-md max-w-2xl text-foreground/92">
              QONNECT turns a hoodie into an introduction layer people can
              notice from across the room and open with one scan.
            </p>
            <p className="section-intro max-w-2xl">
              It sits between fashion, identity, and networking. The hoodie
              carries the signal, the QR opens the door, and the page behind it
              finishes the story.
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
