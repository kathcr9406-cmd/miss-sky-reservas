import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miss Sky Canopy Tour — Sistema de Reservaciones",
  description:
    "Planea tu aventura con Miss Sky. Consulta los cupos y reserva tu Canopy Tour en línea.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
