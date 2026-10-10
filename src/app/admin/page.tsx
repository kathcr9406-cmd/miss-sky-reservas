import { authenticated, authConfigured } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import {
  getSettings,
  getBookings,
  getSchedules,
  getOverview,
} from "@/lib/tours";
import { todayInCostaRica } from "@/lib/format";
import { AdminLogin } from "@/components/admin-login";
import { AdminDashboard } from "@/components/admin-dashboard";
import type { Booking, Schedule, TourSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  if (!(await authenticated()))
    return <AdminLogin configured={authConfigured()} />;
  let settings: TourSettings = { priceCents: null, currency: "CRC" };
  let bookings: Booking[] = [];
  let schedules: Schedule[] = [];
  let connected = false;
  const today = todayInCostaRica();
  let overview = { reservations: 0, people: 0, unpaid: 0 };
  if (databaseConfigured()) {
    try {
      [settings, bookings, schedules, overview] = await Promise.all([
        getSettings(),
        getBookings(),
        getSchedules(),
        getOverview(today),
      ]);
      connected = true;
    } catch {
      connected = false;
    }
  }
  return (
    <AdminDashboard
      settings={settings}
      bookings={bookings}
      schedules={schedules}
      connected={connected}
      today={today}
      overview={overview}
    />
  );
}
