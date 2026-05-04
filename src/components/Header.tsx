import { Link } from "react-router-dom";
import { CartDrawer } from "./CartDrawer";
import qonnectSymbol from "@/assets/qonnect-symbol.jpeg";

const links = [
  { href: "/#editions", label: "Editions" },
  { href: "/#concept", label: "Concept" },
  { href: "/#shop", label: "Shop" },
  { href: "/login", label: "My Bridge" },
];

const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="px-5 py-4 md:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8">
          {/* Left Navigation */}
          <nav className="hidden flex-1 items-center gap-6 md:flex">
            {links.slice(0, 2).map((link) => (
              <Link key={link.label} to={link.href} className="nav-text text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest text-[10px]">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Center Logo */}
          <Link
            to="/"
            className="flex items-center justify-center transition-transform duration-500 hover:scale-110 active:scale-95"
            aria-label="QONNECT home"
          >
            <div className="h-12 w-12 overflow-hidden rounded-full border border-primary/20 bg-muted/20">
              <img 
                src={qonnectSymbol} 
                alt="QONNECT Symbol" 
                className="h-full w-full object-cover scale-150" // Zoomed to show the center hands/QR
              />
            </div>
          </Link>

          {/* Right Navigation & Cart */}
          <div className="flex flex-1 items-center justify-end gap-6 md:gap-10">
            <nav className="hidden items-center gap-6 md:flex">
              {links.slice(2).map((link) => (
                <Link key={link.label} to={link.href} className="nav-text text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest text-[10px]">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3 border-l border-border/50 pl-6 md:pl-10">
              <span className="hidden text-[10px] uppercase tracking-[0.28em] text-muted-foreground lg:block">
                Drop 01
              </span>
              <CartDrawer />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
