import Link from "next/link";
import { Mountain, ArrowUpRight } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="Miss Sky — inicio"
    >
      <span className="brand-icon">
        <Mountain size={25} strokeWidth={1.6} />
      </span>
      <span>
        <strong>
          MISS SKY<span className="brand-dot">.</span>
        </strong>
        <small>CANOPY TOUR</small>
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav aria-label="Navegación principal">
          <Link href="/#experiencia" className="nav-experience">
            La experiencia
          </Link>
          <Link href="/#reservar" className="nav-booking">
            Reservar
          </Link>
          <Link href="/admin" className="staff-link">
            Acceso del personal <ArrowUpRight size={15} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <Brand light />
        <p>
          Un poco de aventura.
          <br />
          Una nueva forma de ver el mundo.
        </p>
        <Link href="/#reservar">
          Planea tu visita <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Miss Sky Canopy Tour</span>
        <span>Sistema de reservaciones · Sin servicio de transporte</span>
        <Link href="/privacidad">Privacidad</Link>
      </div>
    </footer>
  );
}
