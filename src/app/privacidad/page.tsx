import Link from "next/link";
import { Header, Footer } from "@/components/brand";

export default function Privacy() {
  return (
    <>
      <Header />
      <main className="container legal-page">
        <span className="eyebrow">INFORMACIÓN PARA TU RESERVA</span>
        <h1>Uso de tus datos</h1>
        <p>
          El formulario solicita tu nombre, correo electrónico y teléfono para
          identificar tu reservación y permitir que el personal de Miss Sky
          gestione tu visita. Las notas son opcionales: evita incluir datos
          sensibles.
        </p>
        <p>
          Las reservas se guardan en una base de datos accesible al personal
          autorizado. Este sitio no solicita datos de tarjetas ni realiza cobros
          en línea. No utiliza cookies publicitarias; el acceso administrativo
          usa una cookie de sesión.
        </p>
        <div className="notice">
          Antes de abrir el sistema al público, Miss Sky debe completar la
          información del responsable, el medio de contacto para ejercer los
          derechos sobre los datos y los plazos de conservación.
        </div>
        <Link className="button button-dark" href="/#reservar">
          Volver a la reserva
        </Link>
      </main>
      <Footer />
    </>
  );
}
