import Link from "next/link";
import { Header, Footer } from "@/components/brand";
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="container legal-page">
        <span className="eyebrow">404</span>
        <h1>Esta ruta no está disponible.</h1>
        <p>Tu aventura puede empezar en nuestra página de reservas.</p>
        <Link href="/" className="button button-dark">
          Volver al inicio
        </Link>
      </main>
      <Footer />
    </>
  );
}
