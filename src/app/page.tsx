import {
  ArrowDown,
  ArrowUpRight,
  Leaf,
  ShieldCheck,
  Ticket,
  Compass,
  Check,
  Trees,
} from "lucide-react";
import { Header, Footer } from "@/components/brand";
import { ForestArt } from "@/components/forest-art";
import { BookingForm } from "@/components/booking-form";
import { getSettings } from "@/lib/tours";
import { todayInCostaRica } from "@/lib/format";

export const dynamic = "force-dynamic";
export default async function Home() {
  let settings;
  let databaseAvailable = true;
  try {
    settings = await getSettings();
  } catch {
    settings = { priceCents: null, currency: "CRC" as const };
    databaseAvailable = false;
  }
  return (
    <>
      <Header />
      <main>
        <section className="hero container" id="experiencia">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="little-line" /> NATURALEZA. AVENTURA. LIBERTAD.
            </span>
            <h1>
              Tu próxima aventura
              <br />
              está <em>en el aire.</em>
            </h1>
            <p>
              Sal de la rutina. Conecta con la naturaleza.
              <br className="desktop-break" /> Reserva tu Canopy Tour y vive
              Miss Sky.
            </p>
            <a href="#reservar" className="button button-dark">
              Reservar mi aventura <ArrowUpRight size={19} />
            </a>
            <div className="hero-note">
              <ShieldCheck size={16} />
              <span>Reserva directamente con nosotros</span>
            </div>
          </div>
          <div className="hero-visual">
            <ForestArt />
            <div className="visual-label">
              <span className="label-icon">
                <Trees size={24} />
              </span>
              <div>
                <strong>Una vista diferente.</strong>
                <span>Una experiencia para recordar.</span>
              </div>
            </div>
            <span className="visual-corner">MISS SKY · CANOPY TOUR</span>
          </div>
        </section>
        <div className="benefit-strip container">
          <div>
            <Leaf size={21} />
            <span>Una aventura en la naturaleza</span>
          </div>
          <div>
            <Ticket size={21} />
            <span>Reservaciones en línea</span>
          </div>
          <div>
            <Compass size={21} />
            <span>Llega por tu cuenta · Sin transporte</span>
          </div>
        </div>
        <section id="reservar" className="booking-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TU AVENTURA, A UNOS PASOS</span>
                <h2>
                  Reserva tu Canopy Tour<span>.</span>
                </h2>
                <p>
                  Elige tu visita, completa tus datos y prepárate para volar.
                </p>
              </div>
              <span className="heading-aside">
                <ArrowDown size={17} /> Empecemos por la fecha
              </span>
            </div>
            <BookingForm
              settings={settings}
              today={todayInCostaRica()}
              databaseAvailable={databaseAvailable}
            />
          </div>
        </section>
        <section className="before-section container">
          <div>
            <span className="eyebrow">ANTES DE TU VISITA</span>
            <h2>
              Todo listo para
              <br />
              disfrutar el momento.
            </h2>
            <p>
              Tu reserva es para la actividad de Canopy Tour.
              <br />
              El traslado al lugar corre por tu cuenta.
            </p>
          </div>
          <div className="before-items">
            <article>
              <span>01</span>
              <div>
                <h3>Consulta la disponibilidad</h3>
                <p>
                  Los horarios y cupos disponibles se muestran al elegir tu
                  fecha.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Revisa tus datos</h3>
                <p>
                  Usaremos tu información de contacto para gestionar tu
                  reservación.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Guarda tu confirmación</h3>
                <p>
                  Al finalizar, recibirás un código de reserva en esta página.
                  El pago se gestiona por separado.
                </p>
              </div>
            </article>
          </div>
        </section>
        <div className="reassurance container">
          <Check size={17} />
          <p>Una sola actividad. Más tiempo para disfrutar.</p>
          <span>Miss Sky Canopy Tour</span>
        </div>
      </main>
      <Footer />
    </>
  );
}
