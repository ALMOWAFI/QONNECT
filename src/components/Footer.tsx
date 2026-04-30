const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-background border-t border-border">
      <div className="px-5 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="display text-3xl md:text-4xl font-medium">QONNECT</div>
            <p className="tagline mt-4 max-w-md">
              The hoodie as a living business card.
            </p>
          </div>

          <div>
            <h3 className="footer-header">Editions</h3>
            <nav className="flex flex-col gap-2">
              <a href="/#editions" className="footer-link">Tech</a>
              <a href="/#editions" className="footer-link">Medicine</a>
              <a href="/#editions" className="footer-link">Business</a>
            </nav>
          </div>

          <div>
            <h3 className="footer-header">Connect</h3>
            <nav className="flex flex-col gap-2">
              <a href="mailto:hello@qonnect.com" className="footer-link">Contact</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="footer-link">Instagram</a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="footer-link">Twitter</a>
            </nav>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-border flex flex-col md:flex-row justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            © {year} QONNECT. All rights reserved.
          </p>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Wear your world.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
