import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Globe } from "lucide-react";
import { TemplateRenderer, type TemplateData } from "@/components/templates/TemplateRenderer";

interface SlugResult {
  type: "redirect" | "template";
  destination?: string;
  template?: TemplateData;
}

const resolveSlug = async (slug: string): Promise<SlugResult | null> => {
  try {
    const response = await fetch(`/api/resolve-slug/${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Slug resolution failed:", err);
    return null;
  }
};

const Bridge = () => {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) {
      navigate("/");
      return;
    }

    (async () => {
      try {
        const result = await resolveSlug(slug);

        if (!result) {
          setError("This bridge hasn't been built yet.");
          return;
        }

        if (result.type === "redirect" && result.destination) {
          window.location.href = result.destination;
          return;
        }

        if (result.type === "template" && result.template) {
          setTemplate(result.template);
          return;
        }

        setError("This bridge hasn't been built yet.");
      } catch {
        setError("Failed to connect to the world.");
      }
    })();
  }, [slug, navigate]);

  // Render landing page template instead of redirecting
  if (template) {
    return <TemplateRenderer data={template} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5 text-center">
      <div className="max-w-xs w-full space-y-8 animate-in fade-in duration-1000">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
          <div className="relative bg-background border border-border p-8 rounded-sm">
            <Globe className="w-10 h-10 mx-auto text-primary mb-6 animate-pulse" />

            {error ? (
              <>
                <h1 className="display text-2xl mb-4 text-destructive">Broken Bridge.</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
                <button onClick={() => navigate("/")} className="btn-transparent w-full mt-8">
                  Return Home
                </button>
              </>
            ) : (
              <>
                <h1 className="display text-2xl mb-2 font-medium">QONNECTING...</h1>
                <p className="eyebrow text-primary/60">/{slug}</p>
                <div className="mt-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-10 italic font-serif">
                  Bridging the physical and digital.
                </p>
              </>
            )}
          </div>
        </div>

        <p className="display text-xl font-light tracking-widest opacity-20">QONNECT — V1.0</p>
      </div>
    </div>
  );
};

export default Bridge;
