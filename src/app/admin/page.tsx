import { authenticated, authConfigured } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import { getSettings, getBookings, getSchedules } from "@/lib/tours";
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
  if (databaseConfigured()) {
    try {
      [settings, bookings, schedules] = await Promise.all([
        getSettings(),
        getBookings(),
        getSchedules(),
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
      today={todayInCostaRica()}
    />
  );
}
