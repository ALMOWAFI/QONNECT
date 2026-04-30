import { Link } from "react-router-dom";
import { CartDrawer } from "./CartDrawer";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur border-b border-border">
      <div className="px-5 md:px-12 py-5">
        <div className="flex items-center justify-between gap-6">
          <Link
            to="/"
            className="display text-2xl md:text-3xl font-medium tracking-[0.02em]"
            aria-label="QONNECT home"
          >
            QONNECT
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            <Link to="/#editions" className="nav-text text-muted-foreground hover:text-foreground transition-colors">
              Editions
            </Link>
            <Link to="/#concept" className="nav-text text-muted-foreground hover:text-foreground transition-colors">
              Concept
            </Link>
            <Link to="/#shop" className="nav-text text-muted-foreground hover:text-foreground transition-colors">
              Shop
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <CartDrawer />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
