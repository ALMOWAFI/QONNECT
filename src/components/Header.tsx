import { Link } from "react-router-dom";
import { CartDrawer } from "./CartDrawer";

const links = [
  { href: "/#editions", label: "Editions" },
  { href: "/#concept", label: "Concept" },
  { href: "/#shop", label: "Shop" },
];

const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="px-5 py-4 md:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-end gap-3 transition-transform duration-300 active:scale-[0.98]"
            aria-label="QONNECT home"
          >
            <span className="display text-2xl font-medium tracking-[0.02em] md:text-3xl">
              QONNECT
            </span>
            <span className="hidden pb-1 text-[10px] uppercase tracking-[0.32em] text-muted-foreground lg:block">
              Wear your world
            </span>
          </Link>

          <nav className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/70 p-2 md:flex">
            {links.map((link) => (
              <Link key={link.label} to={link.href} className="nav-pill">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] uppercase tracking-[0.28em] text-muted-foreground lg:block">
              Drop 01
            </span>
            <CartDrawer />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
