"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  Clock3,
  Users,
  Minus,
  Plus,
  Info,
  ShieldCheck,
  Check,
  Mountain,
  Ticket,
  LoaderCircle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { Calendar } from "./calendar";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { reservationSchema } from "@/lib/validation";
import type { TourSettings, Availability } from "@/lib/types";

export function BookingForm({
  settings,
  today,
  databaseAvailable,
}: {
  settings: TourSettings;
  today: string;
  databaseAvailable: boolean;
}) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [participants, setParticipants] = useState(1);
  const [availability, setAvailability] = useState<Availability>({
    configured: false,
    slots: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({
    fullName: "",
    email: "",
    phone: "",
    notes: "",
    consent: false,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{
    reference: string;
    totalCents: number;
    currency: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const lastRequest = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const slot = availability.slots.find((s) => s.id === scheduleId);
  const total =
    settings.priceCents === null ? null : settings.priceCents * participants;

  async function selectDate(value: string) {
    setDate(value);
    setScheduleId("");
    setLoading(true);
    setError("");
    setAvailability({ configured: false, slots: [] });
    const request = ++lastRequest.current;
    try {
      const response = await fetch(`/api/availability?date=${value}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (lastRequest.current !== request) return;
      if (!response.ok) throw new Error(result.error);
      setAvailability(result);
    } catch (error) {
      if (lastRequest.current === request)
        setError(
          error instanceof Error
            ? error.message
            : "No podemos consultar la disponibilidad.",
        );
    } finally {
      if (lastRequest.current === request) setLoading(false);
    }
  }
  function moveStep(next: number) {
    setError("");
    setStep(next);
  }
  function updateField(name: keyof typeof fields, value: string | boolean) {
    setFields((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }
  function checkVisit() {
    if (!date) {
      setError("Selecciona la fecha de tu visita.");
      return false;
    }
    if (settings.priceCents === null || !availability.configured) {
      setError(
        "Las reservas se habilitarán cuando Miss Sky configure la tarifa y los horarios.",
      );
      return false;
    }
    if (!slot || slot.remaining < participants) {
      setError("Selecciona un horario con cupos para todo tu grupo.");
      return false;
    }
    return true;
  }
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (step === 1) {
      if (checkVisit()) moveStep(2);
      return;
    }
    const parsed = reservationSchema.safeParse({
      date,
      scheduleId,
      participants,
      ...fields,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        errors[String(issue.path[0])] = issue.message;
      setFieldErrors(errors);
      if (errors.date || errors.scheduleId) {
        setError(
          "Selecciona primero una fecha y un horario disponibles en «Tu visita».",
        );
        return;
      }
      setError("Revisa los campos indicados para continuar.");
      formRef.current
        ?.querySelector<HTMLInputElement>(
          `[name="${String(parsed.error.issues[0].path[0])}"]`,
        )
        ?.focus();
      return;
    }
    if (step === 2) {
      moveStep(3);
      return;
    }
    if (!checkVisit() || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setConfirmation(result);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar tu reserva.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (confirmation)
    return (
      <div className="confirmation-card" role="status">
        <span className="success-icon">
          <CheckCircle2 size={36} />
        </span>
        <span className="eyebrow">TU AVENTURA TE ESPERA</span>
        <h2>¡Tu reserva está registrada!</h2>
        <p>
          Guarda este código y preséntalo al personal de Miss Sky.
          <br />
          No se ha realizado ningún cobro.
        </p>
        <div className="confirmation-code">
          <span>{confirmation.reference}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Copiar código de reserva"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(confirmation.reference);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <div className="confirmation-details">
          <span>{formatDate(date)}</span>
          <span>{slot && formatTime(slot.startsAt)}</span>
          <span>
            {participants} {participants === 1 ? "persona" : "personas"}
          </span>
        </div>
        <strong>
          {formatMoney(confirmation.totalCents, confirmation.currency)} · Pago
          pendiente
        </strong>
        <p className="fine-print">
          La confirmación se muestra aquí. El envío de correos se incorporará en
          una próxima etapa.
        </p>
        <button
          type="button"
          className="button button-dark"
          onClick={() => {
            setConfirmation(null);
            setDate("");
            setScheduleId("");
            setStep(1);
            setFields({
              fullName: "",
              email: "",
              phone: "",
              notes: "",
              consent: false,
            });
            setParticipants(1);
            setAvailability({ configured: false, slots: [] });
          }}
        >
          Hacer otra reserva <ArrowRight size={18} />
        </button>
      </div>
    );

  return (
    <div className="booking-layout">
      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        className="booking-card"
      >
        <div className="stepper" aria-label="Pasos de la reserva">
          {["Tu visita", "Tus datos", "Confirmación"].map((label, i) => (
            <button
              type="button"
              key={label}
              className={`step ${step === i + 1 ? "current" : ""} ${step > i + 1 ? "complete" : ""}`}
              aria-current={step === i + 1 ? "step" : undefined}
              disabled={i === 2 && step < 3}
              onClick={() => moveStep(i + 1)}
            >
              <span className="step-number">
                {step > i + 1 ? <Check size={14} /> : `0${i + 1}`}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="form-content">
          <div className="selected-activity">
            <span className="activity-icon">
              <Mountain size={26} />
            </span>
            <div>
              <small>TU EXPERIENCIA</small>
              <strong>Canopy Tour</strong>
            </div>
            <span className="activity-selected">
              <Check size={13} /> Actividad seleccionada
            </span>
          </div>
          {step === 1 && (
            <>
              <div className="form-title">
                <h3>¿Cuándo empieza tu aventura?</h3>
                <p>Selecciona una fecha y el número de personas.</p>
              </div>
              <div className="visit-grid">
                <div>
                  <label className="field-label">
                    <CalendarDays size={15} /> Fecha de visita <span>*</span>
                  </label>
                  <Calendar today={today} value={date} onChange={selectDate} />
                </div>
                <div className="visit-options">
                  <div>
                    <label className="field-label">
                      <Users size={15} /> Participantes <span>*</span>
                    </label>
                    <div className="participant-counter">
                      <span>
                        <strong>{participants}</strong>
                        <small>
                          {participants === 1 ? "persona" : "personas"}
                        </small>
                      </span>
                      <div>
                        <button
                          type="button"
                          className="counter-button"
                          aria-label="Quitar una persona"
                          disabled={participants === 1}
                          onClick={() => {
                            setParticipants((p) => p - 1);
                            setError("");
                          }}
                        >
                          <Minus size={15} />
                        </button>
                        <button
                          type="button"
                          className="counter-button"
                          aria-label="Agregar una persona"
                          disabled={participants === 50}
                          onClick={() => {
                            setParticipants((p) => p + 1);
                            setScheduleId("");
                            setError("");
                          }}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                    <span className="field-hint">
                      Una tarifa general por persona.
                    </span>
                  </div>
                  <div className="time-field">
                    <label className="field-label">
                      <Clock3 size={15} /> Horario <span>*</span>
                    </label>
                    {loading ? (
                      <div className="slot-placeholder" role="status">
                        <LoaderCircle size={21} className="spin" />
                        <p>Consultando cupos…</p>
                      </div>
                    ) : availability.slots.length > 0 ? (
                      <div className="slot-list">
                        {availability.slots.map((s) => (
                          <button
                            type="button"
                            key={s.id}
                            disabled={s.remaining < participants}
                            className={`slot-button ${scheduleId === s.id ? "selected" : ""}`}
                            onClick={() => {
                              setScheduleId(s.id);
                              setError("");
                            }}
                            aria-pressed={scheduleId === s.id}
                          >
                            <strong>{formatTime(s.startsAt)}</strong>
                            <small>
                              {s.remaining === 0
                                ? "Sin cupos"
                                : `${s.remaining} cupos`}
                            </small>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="slot-placeholder">
                        <Clock3 size={23} />
                        <p>
                          {!date
                            ? "Primero, elige una fecha"
                            : availability.configured
                              ? "Sin salidas disponibles"
                              : "Horarios por configurar"}
                        </p>
                        <small>
                          {!date
                            ? "Aquí verás los horarios disponibles."
                            : availability.configured
                              ? "Prueba con otra fecha."
                              : "Pronto podrás elegir tu horario."}
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {(settings.priceCents === null || !databaseAvailable) && (
                <div className="notice">
                  <Info size={17} />
                  <div>
                    <strong>
                      {databaseAvailable
                        ? "Estamos preparando tu próxima aventura"
                        : "La disponibilidad no se puede consultar ahora"}
                    </strong>
                    <p>
                      {databaseAvailable
                        ? "La tarifa y los horarios aún no se han publicado. Podrás reservar cuando estén disponibles."
                        : "Intenta nuevamente más tarde para consultar fechas y cupos."}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <div className="form-title">
                <h3>Cuéntanos quién viene.</h3>
                <p>Estos datos nos ayudarán a gestionar tu reserva.</p>
              </div>
              <div className="contact-grid">
                <div className="field full">
                  <label htmlFor="fullName">
                    Nombre completo <span>*</span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    autoComplete="name"
                    placeholder="Tu nombre y apellidos"
                    maxLength={120}
                    value={fields.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    aria-invalid={!!fieldErrors.fullName}
                    aria-describedby={
                      fieldErrors.fullName ? "fullName-error" : undefined
                    }
                  />
                  {fieldErrors.fullName && (
                    <small id="fullName-error" className="field-error">
                      {fieldErrors.fullName}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="email">
                    Correo electrónico <span>*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    maxLength={254}
                    value={fields.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={
                      fieldErrors.email ? "email-error" : undefined
                    }
                  />
                  {fieldErrors.email && (
                    <small id="email-error" className="field-error">
                      {fieldErrors.email}
                    </small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="phone">
                    Teléfono <span>*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Incluye el código de país"
                    maxLength={25}
                    value={fields.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    aria-invalid={!!fieldErrors.phone}
                    aria-describedby={
                      fieldErrors.phone ? "phone-error" : undefined
                    }
                  />
                  {fieldErrors.phone && (
                    <small id="phone-error" className="field-error">
                      {fieldErrors.phone}
                    </small>
                  )}
                </div>
                <div className="field full">
                  <label htmlFor="notes">
                    ¿Algo que debamos saber? <small>Opcional</small>
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    placeholder="Agrega una nota para el equipo de Miss Sky. Evita incluir datos sensibles."
                    rows={3}
                    maxLength={1000}
                    value={fields.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                  />
                  <span className="field-hint">
                    No ofrecemos servicio de transporte.
                  </span>
                </div>
                <label className="consent full">
                  <input
                    type="checkbox"
                    name="consent"
                    checked={fields.consent}
                    onChange={(e) => updateField("consent", e.target.checked)}
                  />
                  <span>
                    Acepto el{" "}
                    <Link href="/privacidad" target="_blank">
                      uso de mis datos
                    </Link>{" "}
                    para gestionar esta reservación.{" "}
                    <span className="required">*</span>
                  </span>
                </label>
                {fieldErrors.consent && (
                  <small className="field-error full">
                    {fieldErrors.consent}
                  </small>
                )}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="form-title">
                <h3>Todo listo para tu aventura.</h3>
                <p>Revisa los detalles antes de registrar tu reservación.</p>
              </div>
              <div className="review-block">
                <div>
                  <CalendarDays size={20} />
                  <span>
                    <small>Fecha y horario</small>
                    <strong>
                      {date && formatDate(date)} ·{" "}
                      {slot && formatTime(slot.startsAt)}
                    </strong>
                  </span>
                  <button type="button" onClick={() => moveStep(1)}>
                    Editar
                  </button>
                </div>
                <div>
                  <Users size={20} />
                  <span>
                    <small>Participantes</small>
                    <strong>
                      {participants}{" "}
                      {participants === 1 ? "persona" : "personas"}
                    </strong>
                  </span>
                </div>
                <div>
                  <Ticket size={20} />
                  <span>
                    <small>Contacto de la reserva</small>
                    <strong>{fields.fullName}</strong>
                    <span>
                      {fields.email}
                      <br />
                      {fields.phone}
                    </span>
                  </span>
                  <button type="button" onClick={() => moveStep(2)}>
                    Editar
                  </button>
                </div>
                {fields.notes && (
                  <div>
                    <Info size={20} />
                    <span>
                      <small>Tu nota</small>
                      <p className="customer-note">{fields.notes}</p>
                    </span>
                  </div>
                )}
              </div>
              <div className="notice">
                <Info size={17} />
                <div>
                  <strong>El pago se gestiona por separado</strong>
                  <p>
                    Al confirmar guardaremos tu reserva con pago pendiente. No
                    se realiza ningún cobro en esta página.
                  </p>
                </div>
              </div>
            </>
          )}
          {error && (
            <div className="error-message" role="alert">
              <Info size={16} />
              {error}
            </div>
          )}
        </div>
        <div className="form-actions">
          <span className="required-note">* Campos obligatorios</span>
          <div>
            {step > 1 && (
              <button
                type="button"
                className="button button-ghost"
                disabled={saving}
                onClick={() => moveStep(step - 1)}
              >
                <ArrowLeft size={16} /> Atrás
              </button>
            )}
            <button
              type="submit"
              className="button button-dark"
              disabled={saving || loading}
            >
              {saving ? (
                <>
                  <LoaderCircle size={17} className="spin" /> Guardando…
                </>
              ) : (
                <>
                  {step === 3 ? "Confirmar reserva" : "Continuar"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      <aside className="booking-summary">
        <div className="summary-heading">
          <Ticket size={19} />
          <h3>Tu aventura</h3>
          <span className="summary-dots">···</span>
        </div>
        <div className="summary-tour">
          <span className="eyebrow">MISS SKY CANOPY TOUR</span>
          <h4>
            Un momento para
            <br />
            sentirte libre.
          </h4>
          <div className="summary-tree">
            <Mountain size={45} strokeWidth={1} />
          </div>
        </div>
        <div className="summary-body">
          <div className="summary-rows">
            <div>
              <span>
                <CalendarDays size={15} /> Fecha
              </span>
              <strong>
                {date ? formatDate(date, true) : "Por seleccionar"}
              </strong>
            </div>
            <div>
              <span>
                <Clock3 size={15} /> Horario
              </span>
              <strong>
                {slot ? formatTime(slot.startsAt) : "Por seleccionar"}
              </strong>
            </div>
            <div>
              <span>
                <Users size={15} /> Personas
              </span>
              <strong>{String(participants).padStart(2, "0")}</strong>
            </div>
          </div>
          <div className="price-line">
            <span>Tarifa por persona</span>
            <strong>
              {settings.priceCents === null
                ? "Por configurar"
                : formatMoney(settings.priceCents, settings.currency)}
            </strong>
          </div>
          <div className="summary-total">
            <span>
              Total de la reserva
              <small>
                {total === null
                  ? "La tarifa se publicará próximamente"
                  : "Pago pendiente al reservar"}
              </small>
            </span>
            <strong>
              {total === null ? "—" : formatMoney(total, settings.currency)}
            </strong>
          </div>
          <div className="summary-footnote">
            <ShieldCheck size={16} />
            <span>
              Tus datos se usan únicamente
              <br />
              para gestionar tu reservación.
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
