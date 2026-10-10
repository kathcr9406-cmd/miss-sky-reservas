"use client";
import { useEffect, useState, useRef } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import type { Booking, DaySchedule } from "@/lib/types";
import type { getFinance, Operation } from "@/lib/operations";
type Finance = Awaited<ReturnType<typeof getFinance>>;
const categories: Record<string, string> = {
  salary: "Salarios",
  supplies: "Insumos",
  supplier: "Proveedores",
  maintenance: "Mantenimiento",
  services: "Servicios",
  other: "Otros",
  commission: "Comisiones",
};
const methods: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
};
export function OperationsPanel({
  mode,
  today,
}: {
  mode: "daily" | "finance";
  today: string;
}) {
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [daily, setDaily] = useState<{
    bookings: Booking[];
    schedules: DaySchedule[];
  } | null>(null);
  const [finance, setFinance] = useState<Finance | null>(null);
  const [tab, setTab] = useState("payment");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  // Keep the same request ID across a network retry so a payment is not duplicated.
  const pending = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/admin/operations?${mode === "daily" ? `date=${date}` : `month=${month}`}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (mode === "daily") setDaily(data);
        else setFinance(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [mode, date, month, reload]);
  useEffect(() => {
    if (mode !== "daily") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        setReload((n) => n + 1);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [mode]);
  async function save(input: Omit<Operation, "id"> | Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    const key = JSON.stringify(input);
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const r = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, id: pending.current.id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      pending.current = null;
      setLoading(true);
      setReload((n) => n + 1);
      setMessage("Registro guardado.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function amount(f: FormData) {
    return Math.round(Number(f.get("amount")) * 100);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const common = {
      amountCents: amount(f),
      paidOn: String(f.get("paidOn")),
      reference: String(f.get("reference") ?? ""),
    };
    let input: Record<string, unknown> = { action: tab };
    if (tab === "payment")
      input = {
        ...input,
        ...common,
        bookingReference: String(f.get("bookingReference")).trim(),
        method: f.get("method"),
      };
    if (tab === "expense")
      input = {
        ...input,
        ...common,
        currency: f.get("currency"),
        category: f.get("category"),
        description: f.get("description"),
        payee: f.get("payee"),
      };
    if (tab === "partner")
      input = {
        ...input,
        name: f.get("name"),
        kind: f.get("kind"),
        code: f.get("code"),
        contact: f.get("contact"),
      };
    if (tab === "assign")
      input = {
        ...input,
        bookingReference: String(f.get("bookingReference")).trim(),
        partnerId: f.get("partnerId"),
      };
    if (tab === "payout")
      input = {
        ...input,
        ...common,
        partnerId: f.get("partnerId"),
        currency: f.get("currency"),
      };
    if (tab === "classify")
      input = {
        ...input,
        bookingReference: String(f.get("bookingReference")).trim(),
        adults: Number(f.get("adults")),
        children: Number(f.get("children")),
      };
    if (await save(input)) form.reset();
  }
  async function voidRecord(
    action: "voidPayment" | "voidExpense",
    recordId: string,
  ) {
    const reason = window.prompt(
      "Motivo de la anulación (mínimo 5 caracteres). El registro permanecerá en el historial.",
    );
    if (reason) await save({ action, recordId, reason });
  }
  const feedback = (
    <>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      {loading && <p role="status">Consultando registros…</p>}
    </>
  );
  if (mode === "daily")
    return (
      <>
        <section className="admin-card">
          <div className="admin-card-heading">
            <h2>Reservas organizadas por día</h2>
          </div>
          <div className="admin-card-body">
            <label>
              Fecha de visita
              <input
                aria-label="Fecha de visita"
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) {
                    setLoading(true);
                    setError("");
                    setDate(e.target.value);
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setLoading(true);
                setError("");
                setReload((n) => n + 1);
              }}
            >
              Actualizar reservas
            </button>
            {feedback}
            {!loading && daily && (
              <>
                <p>
                  Esta vista consulta nuevas reservas automáticamente cada 30
                  segundos.
                </p>
                <p>
                  {formatDate(date)} ·{" "}
                  {
                    daily.bookings.filter((b) => b.status !== "cancelled")
                      .length
                  }{" "}
                  reservas ·{" "}
                  {daily.bookings
                    .filter((b) => b.status !== "cancelled")
                    .reduce((n, b) => n + b.participants, 0)}{" "}
                  personas
                </p>
                <div className="daily-slots">
                  {daily.schedules.map((s) => (
                    <article className="operation-summary" key={s.id}>
                      <h3>
                        {s.startsAt}
                        {s.conditional ? " · Salida extra" : ""}
                      </h3>
                      <p>
                        {s.booked}/{s.capacity} personas · {s.remaining} cupos
                        disponibles
                      </p>
                      <p>
                        {s.adultsBooked} adultos / máximo{" "}
                        {s.maxAdults ?? s.capacity}
                        <br />
                        {s.childrenBooked} niños / máximo{" "}
                        {s.maxChildren ?? s.capacity}
                      </p>
                      {s.unclassified > 0 && (
                        <p>
                          {s.unclassified} personas antiguas sin desglose;
                          cuentan contra ambos máximos hasta clasificarlas.
                        </p>
                      )}
                      <p>
                        {s.enabled
                          ? "Habilitada"
                          : "Cerrada para nuevas reservas"}
                      </p>
                      {s.conditional && date >= today && (
                        <button
                          type="button"
                          disabled={busy || loading}
                          className="button button-outline"
                          onClick={() =>
                            save({
                              action: "opening",
                              scheduleId: s.id,
                              date,
                              enabled: !s.enabled,
                            })
                          }
                        >
                          {s.enabled
                            ? "Cerrar salida extra"
                            : "Activar salida extra"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Hora / reserva</th>
                        <th>Cliente</th>
                        <th>Adultos / niños</th>
                        <th>Total</th>
                        <th>Pago / referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daily.bookings.map((b) => (
                        <tr key={b.id}>
                          <td>
                            {b.starts_at}
                            <br />
                            {b.reference}
                            <br />
                            {b.status === "cancelled"
                              ? "Cancelada"
                              : b.status === "completed"
                                ? "Completada"
                                : "Confirmada"}
                          </td>
                          <td>
                            {b.full_name}
                            <br />
                            {b.phone}
                            <br />
                            {b.email}
                          </td>
                          <td>
                            {b.adults === null
                              ? `${b.participants} sin desglose`
                              : `${b.adults} adultos · ${b.children} niños`}
                          </td>
                          <td>{formatMoney(b.total_cents, b.currency)}</td>
                          <td>
                            {b.payment_status === "paid"
                              ? "Pagado"
                              : b.payment_status === "partial"
                                ? "Pago parcial"
                                : "Pendiente"}
                            <br />
                            {b.partner_name ?? "Sin referencia"}
                            {b.payment_status === "pending" &&
                              !b.partner_id && (
                                <>
                                  <br />
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Eliminar la reserva de prueba ${b.reference} de ${b.full_name}, ${b.participants} personas, ${b.visit_date} a las ${b.starts_at}. Esta acción no se puede deshacer. Solo permite reservas sin pagos ni comisiones.`,
                                        )
                                      )
                                        save({
                                          action: "deleteTest",
                                          bookingReference: b.reference,
                                        });
                                    }}
                                  >
                                    Eliminar reserva de prueba
                                  </button>
                                </>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {daily.bookings.length === 0 && (
                  <p>No hay reservas para esta fecha.</p>
                )}
                <p>
                  Para clasificar reservas antiguas, usa «Finanzas → Desglose de
                  participantes».
                </p>
              </>
            )}
          </div>
        </section>
      </>
    );
  return (
    <>
      <section className="admin-card">
        <div className="admin-card-heading">
          <h2>Finanzas y reporte mensual</h2>
        </div>
        <div className="admin-card-body">
          <label>
            Mes del reporte
            <input
              aria-label="Mes del reporte"
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) {
                  setLoading(true);
                  setError("");
                  setMonth(e.target.value);
                }
              }}
            />
          </label>
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              setLoading(true);
              setError("");
              setReload((n) => n + 1);
            }}
          >
            Actualizar
          </button>{" "}
          <a
            className="button button-outline"
            href={`/api/admin/operations?month=${month}&export=csv`}
          >
            Descargar reporte para Excel
          </a>
          <p>
            Ingresos cobrados y gastos pagados por fecha del movimiento. Las
            monedas se muestran por separado. Registrar una tarjeta documenta un
            pago ya recibido; no hace el cobro al cliente.
          </p>
          {!loading && finance && (
            <>
              <div className="daily-slots">
                {finance.report.totals.map((t) => (
                  <article className="operation-summary" key={t.currency}>
                    <h3>
                      {t.currency} · {month}
                    </h3>
                    <p>
                      Ingresos:{" "}
                      <strong>{formatMoney(t.income_cents, t.currency)}</strong>
                    </p>
                    <p>
                      Gastos:{" "}
                      <strong>
                        {formatMoney(t.expenses_cents, t.currency)}
                      </strong>
                    </p>
                    <p>
                      Saldo del mes:{" "}
                      <strong>
                        {formatMoney(t.balance_cents, t.currency)}
                      </strong>
                    </p>
                    <p>
                      Comisiones generadas este mes:{" "}
                      {formatMoney(t.commissions_earned_cents, t.currency)}
                    </p>
                    <p>
                      Comisiones pagadas este mes:{" "}
                      {formatMoney(t.commissions_paid_cents, t.currency)}{" "}
                      (incluidas en gastos)
                    </p>
                    <p>
                      Comisiones pendientes acumuladas:{" "}
                      {formatMoney(t.commissions_pending_cents, t.currency)}
                    </p>
                  </article>
                ))}
              </div>
              <h3>Gastos por categoría</h3>
              {finance.report.categories.length === 0 ? (
                <p>Sin gastos registrados este mes.</p>
              ) : (
                finance.report.categories.map((r) => (
                  <p key={`${r.currency}-${r.category}`}>
                    {categories[r.category]} ·{" "}
                    {formatMoney(r.amount_cents, r.currency)}
                  </p>
                ))
              )}
            </>
          )}
        </div>
      </section>
      <section className="admin-card">
        <div className="admin-card-heading">
          <h2>Registrar movimientos</h2>
        </div>
        <div className="admin-card-body">
          <div className="operation-tabs">
            {Object.entries({
              payment: "Pago recibido",
              expense: "Gasto pagado",
              partner: "Empresa o persona",
              assign: "Asignar comisión",
              payout: "Pagar comisión",
              classify: "Desglose de participantes",
            }).map(([key, label]) => (
              <button
                className={`button ${tab === key ? "button-dark" : "button-outline"}`}
                type="button"
                disabled={busy}
                key={key}
                onClick={() => {
                  setTab(key);
                  setError("");
                  setMessage("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form key={tab} onSubmit={submit} className="operation-form">
            {["payment", "assign", "classify"].includes(tab) && (
              <label>
                Referencia de reserva
                <input
                  name="bookingReference"
                  placeholder="MS-…"
                  required
                  maxLength={40}
                />
              </label>
            )}
            {tab === "payment" && (
              <>
                <p>
                  La moneda se obtiene de la reserva. El sistema impide cobrar
                  más que el saldo pendiente.
                </p>
                <label>
                  Método
                  <select aria-label="Método" name="method">
                    {Object.entries(methods).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {tab === "expense" && (
              <>
                <label>
                  Categoría
                  <select aria-label="Categoría" name="category">
                    {Object.entries(categories)
                      .filter(([k]) => k !== "commission")
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Descripción
                  <input
                    name="description"
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </label>
                <label>
                  Pagado a / proveedor
                  <input name="payee" required minLength={2} maxLength={120} />
                </label>
              </>
            )}
            {tab === "partner" && (
              <>
                <label>
                  Nombre
                  <input name="name" required minLength={2} maxLength={120} />
                </label>
                <label>
                  Tipo
                  <select aria-label="Tipo" name="kind">
                    <option value="company">Empresa</option>
                    <option value="person">Persona</option>
                  </select>
                </label>
                <label>
                  Código para reservas públicas
                  <input
                    name="code"
                    required
                    pattern="[A-Za-z0-9-]{2,40}"
                    placeholder="Código único, sin espacios"
                  />
                </label>
                <label>
                  Contacto
                  <input name="contact" maxLength={200} />
                </label>
                <p>
                  Comisión fija del 10 % del total de cada reserva asociada. Se
                  registra pendiente y se paga por separado.
                </p>
              </>
            )}
            {["assign", "payout"].includes(tab) && (
              <>
                <label>
                  Empresa o persona
                  <select
                    aria-label="Empresa o persona"
                    name="partnerId"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Seleccionar
                    </option>
                    {finance?.partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.code}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Solo se asigna una comisión por reserva. Los pagos de comisión
                  se descuentan del saldo pendiente de la empresa o persona.
                </p>
              </>
            )}
            {["expense", "payout"].includes(tab) && (
              <label>
                Moneda
                <select aria-label="Moneda" name="currency">
                  <option value="USD">USD</option>
                  <option value="CRC">CRC</option>
                </select>
              </label>
            )}
            {["payment", "expense", "payout"].includes(tab) && (
              <>
                <label>
                  Importe
                  <input
                    type="number"
                    name="amount"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Fecha del pago
                  <input
                    type="date"
                    name="paidOn"
                    defaultValue={today}
                    max={today}
                    required
                  />
                </label>
                <label>
                  Comprobante / referencia (opcional)
                  <input name="reference" maxLength={120} />
                </label>
              </>
            )}
            {tab === "classify" && (
              <>
                <label>
                  Adultos
                  <input
                    name="adults"
                    type="number"
                    min={0}
                    max={50}
                    required
                  />
                </label>
                <label>
                  Niños
                  <input
                    name="children"
                    type="number"
                    min={0}
                    max={50}
                    required
                  />
                </label>
                <p>
                  Debe coincidir con el total existente; conserva la tarifa y la
                  reserva.
                </p>
              </>
            )}
            <button
              className="button button-dark"
              type="submit"
              disabled={busy || loading || !finance}
            >
              {busy ? "Guardando…" : "Guardar registro"}
            </button>
          </form>
          {feedback}
        </div>
      </section>
      {!loading && finance && (
        <>
          <section className="admin-card">
            <div className="admin-card-heading">
              <h2>Empresas y personas registradas</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Código de referencia</th>
                    <th>Contacto</th>
                  </tr>
                </thead>
                <tbody>
                  {finance.partners.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.kind === "company" ? "Empresa" : "Persona"}</td>
                      <td>{p.code}</td>
                      <td>{p.contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-card">
            <div className="admin-card-heading">
              <h2>Comisiones por empresa o persona · acumuladas</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empresa / persona</th>
                    <th>Reservas</th>
                    <th>Generadas (10 %)</th>
                    <th>Pagadas</th>
                    <th>Pendientes</th>
                  </tr>
                </thead>
                <tbody>
                  {finance.commissions.map((c) => (
                    <tr key={`${c.partner_id}-${c.currency}`}>
                      <td>
                        {c.name}
                        <br />
                        {c.code}
                      </td>
                      <td>{c.reservations}</td>
                      <td>{formatMoney(c.earned_cents, c.currency)}</td>
                      <td>{formatMoney(c.paid_cents, c.currency)}</td>
                      <td>{formatMoney(c.pending_cents, c.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {finance.commissions.length === 0 && (
              <p className="admin-card-body">No hay comisiones registradas.</p>
            )}
          </section>
          <section className="admin-card">
            <div className="admin-card-heading">
              <h2>Pagos recibidos · {month}</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Reserva / cliente</th>
                    <th>Importe</th>
                    <th>Método</th>
                    <th>Comprobante</th>
                    <th>Corrección</th>
                  </tr>
                </thead>
                <tbody>
                  {finance.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.paid_on}</td>
                      <td>
                        {p.booking_reference}
                        <br />
                        {p.full_name}
                      </td>
                      <td>{formatMoney(p.amount_cents, p.currency)}</td>
                      <td>{methods[p.method]}</td>
                      <td>{p.reference}</td>
                      <td>
                        {p.voided ? (
                          `Anulado: ${p.void_reason}`
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => voidRecord("voidPayment", p.id)}
                          >
                            Anular registro
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-card">
            <div className="admin-card-heading">
              <h2>Gastos pagados · {month}</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Categoría / concepto</th>
                    <th>Pagado a</th>
                    <th>Importe</th>
                    <th>Comprobante</th>
                    <th>Corrección</th>
                  </tr>
                </thead>
                <tbody>
                  {finance.expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{e.paid_on}</td>
                      <td>
                        {categories[e.category]}
                        <br />
                        {e.description}
                      </td>
                      <td>{e.payee}</td>
                      <td>{formatMoney(e.amount_cents, e.currency)}</td>
                      <td>{e.reference}</td>
                      <td>
                        {e.voided ? (
                          `Anulado: ${e.void_reason}`
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => voidRecord("voidExpense", e.id)}
                          >
                            Anular registro
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
