"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Info,
  LoaderCircle,
} from "lucide-react";
import { Brand } from "./brand";
import { ForestArt } from "./forest-art";

export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="admin-login-page">
      <section className="login-story">
        <Brand light />
        <div className="login-story-copy">
          <span className="eyebrow">CADA AVENTURA EMPIEZA CONTIGO</span>
          <h1>
            Menos pendientes.
            <br />
            <em>Más aventuras.</em>
          </h1>
          <p>
            Un espacio para organizar las visitas y acompañar cada experiencia
            de Miss Sky.
          </p>
        </div>
        <ForestArt />
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={login}>
          <div className="mobile-admin-brand">
            <Brand />
          </div>
          <span className="eyebrow">
            <LockKeyhole size={14} /> ÁREA DEL PERSONAL
          </span>
          <h2>Bienvenido a Miss Sky.</h2>
          <p>
            Ingresa con la contraseña del equipo para administrar las
            reservaciones.
          </p>
          {!configured && (
            <div className="notice">
              <Info size={17} />
              <div>
                <strong>Acceso pendiente de configuración</strong>
                <p>
                  El administrador debe establecer la contraseña y la clave de
                  sesión antes de habilitar el panel.
                </p>
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="admin-password">Contraseña</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña de acceso"
              required
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!configured || loading}
            />
          </div>
          {error && (
            <div role="alert" className="error-message">
              {error}
            </div>
          )}
          <button
            className="button button-dark"
            type="submit"
            disabled={!configured || loading}
          >
            {loading ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <>
                Ingresar al panel <ArrowRight size={17} />
              </>
            )}
          </button>
          <Link href="/" className="login-return">
            <ArrowLeft size={14} /> Volver a la página de reservas
          </Link>
        </form>
      </section>
    </main>
  );
}
