import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { IntakeForm } from "@/components/IntakeForm";
import { useSearchParams } from "react-router-dom";

const Success = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <main className="relative">
        {/* Background Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/5 blur-[120px] pointer-events-none" />

        <section className="px-5 md:px-12 py-20 md:py-32">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16 md:mb-24">
              <p className="eyebrow mb-6">Payment Successful</p>
              <h1 className="display-lg">
                Welcome to the <em className="italic">tribe.</em>
              </h1>
              <p className="tagline mt-8 max-w-xl mx-auto">
                Your order is confirmed. Now, let's bridge your physical and digital presence.
              </p>
            </div>

            <div className="relative z-10 bg-background border border-border shadow-2xl p-8 md:p-12 lg:p-20">
              <IntakeForm orderId={sessionId?.slice(-4)} />
            </div>

            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left border-t border-border pt-16">
              <div>
                <p className="nav-text mb-4 text-primary">01. Generate</p>
                <p className="text-sm text-muted-foreground leading-relaxed font-serif text-lg">
                  We generate your custom high-res QR asset based on your link.
                </p>
              </div>
              <div>
                <p className="nav-text mb-4 text-primary">02. Print</p>
                <p className="text-sm text-muted-foreground leading-relaxed font-serif text-lg">
                  Our master printers apply the QONNECT edition to your premium hoodie.
                </p>
              </div>
              <div>
                <p className="nav-text mb-4 text-primary">03. Ship</p>
                <p className="text-sm text-muted-foreground leading-relaxed font-serif text-lg">
                  Direct from the press to your doorstep. Tracked and secured.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Success;
