import NewsletterForm from "./NewsletterForm";

interface NewsletterProps {
  variant?: "colorful" | "minimal";
}

const Newsletter = ({ variant = "colorful" }: NewsletterProps) => {
  if (variant === "minimal") {
    return (
      <section className="bg-foreground text-background py-16 md:py-20">
        <div className="px-5 md:px-20 max-w-4xl mx-auto">
          <NewsletterForm
            className="justify-center"
            inputClassName="border-background text-background placeholder:text-background"
            buttonClassName="border-background text-background hover:bg-background hover:text-foreground"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-accent-pink py-16 md:py-20">
      <div className="px-5 md:px-20 max-w-4xl mx-auto">
        <NewsletterForm className="justify-center" />
      </div>
    </section>
  );
};

export default Newsletter;
