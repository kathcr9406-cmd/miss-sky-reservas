import { z } from "zod";
import { todayInCostaRica } from "./format";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === date &&
      date >= todayInCostaRica()
    );
  }, "Selecciona una fecha válida a partir de hoy.");
export const reservationSchema = z
  .object({
    date: dateSchema,
    scheduleId: z.uuid(),
    adults: z.number().int().min(0).max(50),
    children: z.number().int().min(0).max(50),
    referralCode: z
      .string()
      .trim()
      .toUpperCase()
      .max(40)
      .regex(/^[A-Z0-9-]*$/)
      .default(""),
    fullName: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
    email: z.email("Escribe un correo válido.").trim().toLowerCase().max(254),
    phone: z
      .string()
      .trim()
      .min(8, "Escribe un teléfono válido.")
      .max(25)
      .regex(
        /^[+\d\s()\-]+$/,
        "Usa números y un código de país si corresponde.",
      ),
    notes: z.string().trim().max(1000),
    consent: z.literal(
      true,
      "Acepta el uso de tus datos para gestionar la reserva.",
    ),
  })
  .refine(
    (v) => v.adults + v.children >= 1 && v.adults + v.children <= 50,
    "El grupo debe tener entre 1 y 50 personas.",
  );
export const settingsSchema = z.object({
  priceCents: z.number().int().min(1).max(100000000).nullable(),
  currency: z.enum(["CRC", "USD"]),
  schedules: z
    .array(
      z.object({
        id: z.uuid(),
        startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        capacity: z.number().int().min(1).max(200),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        active: z.boolean(),
        maxAdults: z.number().int().min(0).max(200).nullable().default(null),
        maxChildren: z.number().int().min(0).max(200).nullable().default(null),
        conditional: z.boolean().default(false),
      }),
    )
    .max(30)
    .refine(
      (items) => new Set(items.map((s) => s.startsAt)).size === items.length,
      "No repitas horarios.",
    ),
});
