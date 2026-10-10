import { NextResponse } from "next/server";
import { authenticated, sameOrigin } from "@/lib/auth";
import {
  operationSchema,
  performOperation,
  getDaily,
  getFinance,
  calendarDate,
  monthSchema,
  csvCell,
} from "@/lib/operations";
import { BookingError } from "@/lib/tours";
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await authenticated()))
    return NextResponse.json(
      { error: "Acceso no autorizado." },
      { status: 401 },
    );
  const parsed = operationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  try {
    await performOperation(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof BookingError
            ? e.message
            : "No se guardó el registro. Revisa los datos o la conexión.",
      },
      { status: e instanceof BookingError ? 409 : 503 },
    );
  }
}
export async function GET(request: Request) {
  if (!(await authenticated()))
    return NextResponse.json(
      { error: "Acceso no autorizado." },
      { status: 401 },
    );
  const url = new URL(request.url);
  try {
    if (url.searchParams.has("date")) {
      const date = calendarDate.safeParse(url.searchParams.get("date"));
      if (!date.success)
        return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
      return NextResponse.json(await getDaily(date.data), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const month = monthSchema.safeParse(url.searchParams.get("month"));
    if (!month.success)
      return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
    const data = await getFinance(month.data);
    if (url.searchParams.get("export") === "csv") {
      const rows: unknown[][] = [
        [
          "Tipo",
          "Fecha",
          "Moneda",
          "Importe",
          "Categoría / método",
          "Empresa / cliente",
          "Referencia",
          "Estado",
          "Motivo de anulación",
        ],
      ];
      for (const p of data.payments)
        rows.push([
          "Ingreso",
          p.paid_on,
          p.currency,
          (p.amount_cents / 100).toFixed(2),
          (
            {
              cash: "Efectivo",
              card: "Tarjeta",
              transfer: "Transferencia",
            } as Record<string, string>
          )[p.method] ?? p.method,
          p.full_name,
          p.booking_reference,
          p.voided ? "Anulado" : "Vigente",
          p.void_reason,
        ]);
      for (const e of data.expenses)
        rows.push([
          "Gasto",
          e.paid_on,
          e.currency,
          (e.amount_cents / 100).toFixed(2),
          (
            {
              salary: "Salarios",
              supplies: "Insumos",
              supplier: "Proveedores",
              maintenance: "Mantenimiento",
              services: "Servicios",
              other: "Otros",
              commission: "Comisiones",
            } as Record<string, string>
          )[e.category] ?? e.category,
          e.payee,
          e.reference,
          e.voided ? "Anulado" : "Vigente",
          e.void_reason,
        ]);
      for (const t of data.report.totals)
        rows.push([
          "Saldo mensual",
          month.data,
          t.currency,
          (t.balance_cents / 100).toFixed(2),
          "Ingresos cobrados menos gastos pagados",
          "",
          "",
          "",
          "",
        ]);
      return new Response(
        "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="Miss-Sky-${month.data}.csv"`,
            "Cache-Control": "no-store",
          },
        },
      );
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron consultar los registros." },
      { status: 503 },
    );
  }
}
