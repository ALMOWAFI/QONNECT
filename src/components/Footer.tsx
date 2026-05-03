const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="px-5 py-16 md:px-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="display text-3xl font-medium md:text-4xl">QONNECT</div>
            <p className="tagline mt-4 max-w-md">
              Premium identity wear for people whose next connection should open a real destination.
            </p>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
              QONNECT is built around custom fulfillment, not shelf inventory.
              The garment, the QR destination, and the service tier are one
              product.
            </p>
          </div>

          <div>
            <h3 className="footer-header">Offer</h3>
            <nav className="flex flex-col gap-2">
              <a href="/#editions" className="footer-link">Tech Edition</a>
              <a href="/#editions" className="footer-link">Medicine Edition</a>
              <a href="/#editions" className="footer-link">Business Edition</a>
              <a href="/#shop" className="footer-link">Basic, Standard, Premium</a>
            </nav>
          </div>

          <div>
            <h3 className="footer-header">Process</h3>
            <nav className="flex flex-col gap-2">
              <a href="/success" className="footer-link">Intake after checkout</a>
              <a href="mailto:hello@qonnect.com" className="footer-link">hello@qonnect.com</a>
              <span className="footer-link">Print-on-demand fulfillment</span>
            </nav>
          </div>
        </div>

        <div className="mt-14 flex flex-col justify-between gap-2 border-t border-border pt-6 md:flex-row">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Copyright {year} QONNECT. All rights reserved.
          </p>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Wear the conversation.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
