import { useState } from "react";
import { Loader2, CheckCircle2, Globe, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const IntakeForm = ({ orderId }: { orderId?: string }) => {
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast.error("Please provide a link for your world.");
      return;
    }

    setIsSubmitting(true);
    // Simulate API call to save the URL
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    toast.success("Identity secured. We are building your bridge.");
  };

  if (isSubmitted) {
    return (
      <div className="bg-foreground/5 border border-foreground/10 p-10 md:p-16 text-center animate-in fade-in zoom-in duration-700">
        <CheckCircle2 className="w-12 h-12 mx-auto text-primary mb-6" />
        <h3 className="display text-3xl mb-4 font-medium">World Connected.</h3>
        <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Your unique QR code is being generated for order <span className="text-foreground">#{orderId || "1024"}</span>. 
          We will notify you once your hoodie hits the press.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-10 text-center">
        <p className="eyebrow mb-4">Step 2: Connect Your World</p>
        <h2 className="display-md">The scannable <em className="italic">identity.</em></h2>
        <p className="text-muted-foreground mt-4 italic font-serif text-lg">
          Provide the link that will live on your hoodie forever. 
          LinkedIn, Portfolio, or your custom QONNECT page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
            <Globe className="w-4 h-4" />
          </div>
          <input
            type="url"
            placeholder="https://yourworld.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-background border border-border py-5 pl-14 pr-5 text-lg font-serif focus:outline-none focus:border-foreground transition-all duration-300 placeholder:text-muted-foreground/40"
            disabled={isSubmitting}
            required
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-filled w-full group active:scale-[0.98] transition-all duration-300"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Confirm Identity <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
        
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground text-center">
          You can change this link within 2 hours of purchase.
        </p>
      </form>
    </div>
  );
};
