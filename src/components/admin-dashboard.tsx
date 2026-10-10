"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Users,
  Settings2,
  Wallet,
  LogOut,
  ArrowUpRight,
  Search,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  Clock3,
  LoaderCircle,
  Info,
} from "lucide-react";
import { Brand } from "./brand";
import { Calendar } from "./calendar";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import type { TourSettings, Schedule, Booking } from "@/lib/types";

type Section =
  "overview" | "bookings" | "calendar" | "customers" | "settings" | "payments";
const navigation = [
  { id: "overview" as const, label: "Vista general", icon: LayoutDashboard },
  { id: "bookings" as const, label: "Reservaciones", icon: Ticket },
  { id: "calendar" as const, label: "Calendario", icon: CalendarDays },
  { id: "customers" as const, label: "Clientes", icon: Users },
  { id: "settings" as const, label: "Configuración", icon: Settings2 },
  { id: "payments" as const, label: "Pagos y reportes", icon: Wallet },
];
const weekdays = [
  { label: "L", day: 1 },
  { label: "M", day: 2 },
  { label: "M", day: 3 },
  { label: "J", day: 4 },
  { label: "V", day: 5 },
  { label: "S", day: 6 },
  { label: "D", day: 0 },
];
const weekdayNames = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

function BookingTable({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0)
    return (
      <div className="empty-state">
        <Ticket size={34} strokeWidth={1.3} />
        <h3>Aún no hay reservaciones</h3>
        <p>Las reservas registradas desde la página pública aparecerán aquí.</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Reserva / cliente</th>
            <th>Visita</th>
            <th>Personas</th>
            <th>Total</th>
            <th>Pago</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.reference}>
              <td>
                <strong>{b.full_name}</strong>
                <small>{b.reference}</small>
              </td>
              <td>
                <strong>{formatDate(b.visit_date, true)}</strong>
                <small>{formatTime(b.starts_at)}</small>
              </td>
              <td>{b.participants}</td>
              <td>{formatMoney(b.total_cents, b.currency)}</td>
              <td>
                <span className="status-pill">
                  {b.payment_status === "paid"
                    ? "Pagado"
                    : b.payment_status === "partial"
                      ? "Pago parcial"
                      : "Pendiente"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDashboard({
  settings,
  bookings,
  schedules,
  connected,
  today,
}: {
  settings: TourSettings;
  bookings: Booking[];
  schedules: Schedule[];
  connected: boolean;
  today: string;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");
  const [calendarDate, setCalendarDate] = useState(today);
  const [price, setPrice] = useState(
    settings.priceCents === null ? "" : String(settings.priceCents / 100),
  );
  const [currency, setCurrency] = useState(settings.currency);
  const [slots, setSlots] = useState(schedules.filter((s) => s.active));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const filtered = bookings.filter((b) =>
    `${b.full_name} ${b.reference} ${b.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const customers = Array.from(
    new Map(bookings.map((b) => [b.email, b])).values(),
  ).filter((b) =>
    `${b.full_name} ${b.email} ${b.phone}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const ready =
    connected &&
    settings.priceCents !== null &&
    schedules.some((s) => s.active);
  const active = bookings.filter((b) => b.status !== "cancelled");
  const todayBookings = active.filter((b) => b.visit_date === today);
  const title = navigation.find((n) => n.id === section)!.label;
  const unpaid = active.filter((b) => b.payment_status !== "paid");
  const descriptions: Record<Section, string> = {
    overview: "Cada visita, organizada. Cada aventura, a un paso.",
    bookings:
      "Consulta las 200 reservaciones más recientes por fecha de visita.",
    calendar:
      "Consulta las visitas de una fecha dentro de las 200 reservas más recientes.",
    customers: "Contactos de las 200 reservaciones más recientes.",
    settings:
      "Define la tarifa general, las salidas y los cupos del Canopy Tour.",
    payments: "Estado de pago de las 200 reservaciones más recientes.",
  };
  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setLogoutError("No se pudo cerrar sesión. Intenta de nuevo.");
    } finally {
      setLoggingOut(false);
    }
  }
  function updateSlot(id: string, change: Partial<Schedule>) {
    setSaved(false);
    setSlots((items) =>
      items.map((s) => (s.id === id ? { ...s, ...change } : s)),
    );
  }
  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    const amount = price.trim() === "" ? null : Number(price);
    if (
      amount !== null &&
      (!Number.isFinite(amount) ||
        amount <= 0 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)
    ) {
      setError("Escribe una tarifa positiva con hasta dos decimales.");
      setSaving(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceCents: amount === null ? null : Math.round(amount * 100),
          currency,
          schedules: slots,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSaved(true);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se guardó la configuración.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand light />
        <span className="admin-label">SISTEMA DE RESERVACIONES</span>
        <nav className="admin-nav" aria-label="Panel administrativo">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              className={section === id ? "active" : ""}
              key={id}
              aria-current={section === id ? "page" : undefined}
              onClick={() => {
                setSection(id);
                setSearch("");
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/" target="_blank">
            Ver página pública <ArrowUpRight size={15} />
          </Link>
          <button type="button" onClick={logout} disabled={loggingOut}>
            <LogOut size={15} />
            {loggingOut ? "Cerrando…" : "Cerrar sesión"}
          </button>
          {logoutError && (
            <p role="alert" className="field-error">
              {logoutError}
            </p>
          )}
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-topline">
          <span>Miss Sky / {title}</span>
          <span className="staff-badge">
            <ShieldCheck size={14} /> Personal autorizado
          </span>
        </div>
        <div className="admin-heading">
          <div>
            <h1>{section === "overview" ? "Hola, equipo Miss Sky." : title}</h1>
            <p>{descriptions[section]}</p>
          </div>
          {["bookings", "customers"].includes(section) && (
            <label className="search-field">
              <Search size={15} />
              <input
                type="search"
                aria-label="Buscar por nombre, correo o código"
                placeholder="Buscar por nombre, correo o código"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          )}
        </div>
        {!connected && (
          <div className="error-message" role="alert">
            <Info size={16} />
            La base de datos no está disponible. Las reservas y la configuración
            no se pueden guardar.
          </div>
        )}
        {section === "overview" && (
          <>
            <div className="stat-grid">
              <article className="stat-card">
                <div>
                  Reservaciones para hoy <CalendarDays size={18} />
                </div>
                <strong>
                  {connected
                    ? String(todayBookings.length).padStart(2, "0")
                    : "—"}
                </strong>
                <small>{formatDate(today, true)} · America/Costa_Rica</small>
              </article>
              <article className="stat-card">
                <div>
                  Personas para hoy <Users size={18} />
                </div>
                <strong>
                  {connected
                    ? String(
                        todayBookings.reduce((n, b) => n + b.participants, 0),
                      ).padStart(2, "0")
                    : "—"}
                </strong>
                <small>Dentro de las últimas 200 reservas</small>
              </article>
              <article className="stat-card">
                <div>
                  Reservas con pago pendiente <Wallet size={18} />
                </div>
                <strong>
                  {connected ? String(unpaid.length).padStart(2, "0") : "—"}
                </strong>
                <small>Dentro de las últimas 200 reservas</small>
              </article>
            </div>
            <section className="admin-card">
              <div className="admin-card-heading">
                <h2>
                  {ready
                    ? "Todo listo para recibir aventuras"
                    : "Prepara tu sistema de reservas"}
                </h2>
                <span>{ready ? "Configurado" : "Configuración inicial"}</span>
              </div>
              <div className="admin-card-body setup-checklist">
                {[
                  {
                    ok: connected,
                    title: "Base de datos PostgreSQL",
                    hint: connected
                      ? "Conexión establecida"
                      : "Configura la conexión y aplica el esquema",
                  },
                  {
                    ok: settings.priceCents !== null,
                    title: "Tarifa general",
                    hint:
                      settings.priceCents === null
                        ? "Pendiente de configurar"
                        : `${formatMoney(settings.priceCents, settings.currency)} por persona`,
                  },
                  {
                    ok: schedules.some((s) => s.active),
                    title: "Horarios y cupos",
                    hint: schedules.some((s) => s.active)
                      ? "Salidas configuradas"
                      : "Agrega las salidas y sus días de operación",
                  },
                ].map((item) => (
                  <div key={item.title}>
                    {item.ok ? (
                      <CheckCircle2 size={21} />
                    ) : (
                      <Circle size={21} />
                    )}
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.hint}</small>
                    </span>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setSection("settings")}
                  >
                    Ir a configuración <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-heading">
                <h2>Próximas visitas</h2>
                <span>Últimas 200 reservas</span>
              </div>
              <BookingTable
                bookings={active
                  .filter((b) => b.visit_date >= today)
                  .sort((a, b) =>
                    `${a.visit_date}${a.starts_at}`.localeCompare(
                      `${b.visit_date}${b.starts_at}`,
                    ),
                  )
                  .slice(0, 5)}
              />
            </section>
          </>
        )}
        {section === "bookings" && (
          <section className="admin-card">
            <div className="admin-card-heading">
              <h2>Reservaciones registradas</h2>
              <span>{filtered.length} resultados</span>
            </div>
            <BookingTable bookings={filtered} />
          </section>
        )}
        {section === "customers" && (
          <section className="admin-card">
            <div className="admin-card-heading">
              <h2>Registro de clientes</h2>
              <span>{customers.length} contactos</span>
            </div>
            {customers.length === 0 ? (
              <div className="empty-state">
                <Users size={34} strokeWidth={1.3} />
                <h3>Tu próxima aventura empieza aquí</h3>
                <p>
                  Los datos de contacto de los clientes se registran al
                  completar una reserva.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Teléfono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.email}>
                        <td>{c.full_name}</td>
                        <td>{c.email}</td>
                        <td>{c.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {section === "calendar" && (
          <>
            <section className="admin-card">
              <div className="admin-card-heading">
                <h2>Elige una fecha de visita</h2>
                <CalendarDays size={17} />
              </div>
              <div className="admin-card-body" style={{ maxWidth: 360 }}>
                <Calendar
                  today={today}
                  value={calendarDate}
                  onChange={setCalendarDate}
                />
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-heading">
                <h2>{formatDate(calendarDate)}</h2>
                <span>
                  {active.filter((b) => b.visit_date === calendarDate).length}{" "}
                  reservas
                </span>
              </div>
              <BookingTable
                bookings={active.filter((b) => b.visit_date === calendarDate)}
              />
            </section>
          </>
        )}
        {section === "payments" && (
          <>
            <div className="notice" style={{ margin: "0 0 24px" }}>
              <Info size={17} />
              <div>
                <strong>Primera etapa del sistema</strong>
                <p>
                  Puedes consultar el estado de pago de cada reserva. El
                  registro de abonos, la conciliación y la exportación de
                  reportes se desarrollarán en la siguiente etapa. Esta página
                  no realiza cobros.
                </p>
              </div>
            </div>
            <section className="admin-card">
              <div className="admin-card-heading">
                <h2>Reservaciones con pago pendiente</h2>
                <span>{unpaid.length} registros</span>
              </div>
              <BookingTable bookings={unpaid} />
            </section>
          </>
        )}
        {section === "settings" && (
          <form onSubmit={saveSettings}>
            <section className="admin-card">
              <div className="admin-card-heading">
                <h2>Tarifa general</h2>
                <Ticket size={17} />
              </div>
              <div className="admin-card-body">
                <p className="settings-subtitle">
                  Una única actividad: Canopy Tour. La tarifa se aplica por
                  persona a las nuevas reservas. Las reservas existentes
                  conservan su precio.
                </p>
                <div className="settings-price-grid">
                  <div className="field">
                    <label htmlFor="price">Tarifa por persona</label>
                    <input
                      id="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Sin configurar"
                      value={price}
                      onChange={(e) => {
                        setPrice(e.target.value);
                        setSaved(false);
                      }}
                      disabled={!connected || saving}
                    />
                    <span className="field-hint">
                      Deja el campo vacío para mantener las reservas públicas
                      deshabilitadas.
                    </span>
                  </div>
                  <div className="field">
                    <label htmlFor="currency">Moneda</label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value as "CRC" | "USD");
                        setSaved(false);
                      }}
                      disabled={!connected || saving}
                    >
                      <option value="CRC">CRC · Colones</option>
                      <option value="USD">USD · Dólares</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
            <section className="admin-card">
              <div className="admin-card-heading">
                <h2>Horarios y cupos</h2>
                <Clock3 size={17} />
              </div>
              <div className="admin-card-body">
                <p className="settings-subtitle">
                  Configura cada salida, su capacidad y los días de la semana en
                  los que opera. Todos los horarios usan la hora de Costa Rica.
                  No se incluye transporte.
                </p>
                {slots.length === 0 && (
                  <div className="empty-state">
                    <Clock3 size={33} strokeWidth={1.3} />
                    <h3>No hay horarios configurados</h3>
                    <p>Agrega las salidas reales que ofrecerá Miss Sky.</p>
                  </div>
                )}
                {slots.map((slot, i) => (
                  <div className="schedule-editor" key={slot.id}>
                    <div className="field">
                      <label htmlFor={`time-${slot.id}`}>Horario {i + 1}</label>
                      <input
                        id={`time-${slot.id}`}
                        type="time"
                        required
                        value={slot.startsAt}
                        onChange={(e) =>
                          updateSlot(slot.id, { startsAt: e.target.value })
                        }
                        disabled={saving}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`capacity-${slot.id}`}>Cupos</label>
                      <input
                        id={`capacity-${slot.id}`}
                        type="number"
                        required
                        min={1}
                        max={200}
                        placeholder="Cantidad"
                        value={slot.capacity || ""}
                        onChange={(e) =>
                          updateSlot(slot.id, {
                            capacity: Number(e.target.value),
                          })
                        }
                        disabled={saving}
                      />
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Eliminar horario ${i + 1}`}
                      onClick={() => {
                        setSlots((items) =>
                          items.filter((s) => s.id !== slot.id),
                        );
                        setSaved(false);
                      }}
                      disabled={saving}
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="full">
                      <label className="field-label">Días de operación</label>
                      <div className="weekday-toggles">
                        {weekdays.map(({ label, day }) => (
                          <button
                            type="button"
                            key={day}
                            aria-label={weekdayNames[day]}
                            aria-pressed={slot.weekdays.includes(day)}
                            className={
                              slot.weekdays.includes(day) ? "selected" : ""
                            }
                            disabled={saving}
                            onClick={() =>
                              updateSlot(slot.id, {
                                weekdays: slot.weekdays.includes(day)
                                  ? slot.weekdays.filter((d) => d !== day)
                                  : [...slot.weekdays, day],
                              })
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="button button-outline"
                  disabled={!connected || saving || slots.length >= 30}
                  onClick={() => {
                    setSlots((items) => [
                      ...items,
                      {
                        id: crypto.randomUUID(),
                        startsAt: "",
                        capacity: 0,
                        weekdays: [],
                        active: true,
                      },
                    ]);
                    setSaved(false);
                  }}
                >
                  <Plus size={16} /> Agregar horario
                </button>
                <div className="notice">
                  <Info size={16} />
                  <div>
                    <strong>Los cambios no cancelan reservas existentes</strong>
                    <p>
                      Eliminar una salida la deshabilita para nuevas reservas.
                      Revisa las visitas registradas antes de cambiar horarios o
                      reducir cupos.
                    </p>
                  </div>
                </div>
              </div>
            </section>
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <div className="settings-actions">
              <button
                type="submit"
                className="button button-dark"
                disabled={!connected || saving}
              >
                {saving ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Save size={16} />
                )}{" "}
                Guardar configuración
              </button>
              {saved && (
                <span className="success-message" role="status">
                  <CheckCircle2 size={16} /> Configuración guardada
                </span>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
