"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Calendar({
  today,
  value,
  onChange,
}: {
  today: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(`${today.slice(0, 7)}-01T12:00:00Z`),
  );
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const start = (month.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const title = new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);
  return (
    <div className="calendar">
      <div className="calendar-heading">
        <strong>{title}</strong>
        <div>
          <button
            type="button"
            className="icon-button"
            aria-label="Mes anterior"
            disabled={month.toISOString().slice(0, 7) <= today.slice(0, 7)}
            onClick={() =>
              setMonth(new Date(Date.UTC(year, monthIndex - 1, 1, 12)))
            }
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Mes siguiente"
            onClick={() =>
              setMonth(new Date(Date.UTC(year, monthIndex + 1, 1, 12)))
            }
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {["L", "M", "M", "J", "V", "S", "D"].map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
        <div className="calendar-days">
          {Array.from({ length: start }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            return (
              <button
                type="button"
                key={date}
                disabled={date < today}
                aria-label={new Intl.DateTimeFormat("es-CR", {
                  dateStyle: "full",
                  timeZone: "UTC",
                }).format(new Date(`${date}T12:00:00Z`))}
                aria-pressed={value === date}
                onClick={() => onChange(date)}
                className={`${value === date ? "selected" : ""} ${date === today ? "today" : ""}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
      <div className="calendar-key">
        <span />
        <small>Selecciona tu fecha de visita</small>
      </div>
    </div>
  );
}
