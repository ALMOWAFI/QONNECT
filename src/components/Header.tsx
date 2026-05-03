import { Link } from "react-router-dom";
import { CartDrawer } from "./CartDrawer";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-background/70 backdrop-blur-lg border-b border-border/50 transition-all duration-500">
      <div className="px-5 md:px-12 py-5">
        <div className="flex items-center justify-between gap-6">
          <Link
            to="/"
            className="display text-2xl md:text-3xl font-medium tracking-[0.02em] transition-transform duration-300 active:scale-[0.97]"
            aria-label="QONNECT home"
          >
            QONNECT
          </Link>

          <nav className="hidden md:flex items-center gap-10">
            <Link to="/#editions" className="nav-text text-muted-foreground hover:text-foreground transition-all duration-300 active:scale-95">
              Editions
            </Link>
            <Link to="/#concept" className="nav-text text-muted-foreground hover:text-foreground transition-all duration-300 active:scale-95">
              Concept
            </Link>
            <Link to="/#shop" className="nav-text text-muted-foreground hover:text-foreground transition-all duration-300 active:scale-95">
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
