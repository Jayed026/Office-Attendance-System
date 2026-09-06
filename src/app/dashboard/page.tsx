"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Attendance = {
  id?: number;
  attendance_date?: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [attendance, setAttendance] = useState<Attendance | null>(null);

  const [history, setHistory] = useState<Attendance[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =====================================================
  // BANGLADESH DATE
  // =====================================================

  function getBangladeshDate() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  // =====================================================
  // LOAD DASHBOARD
  // =====================================================

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email ?? "");

      const today = getBangladeshDate();

      // Today's attendance
      const { data: todayAttendance } = await supabase
        .from("attendance")
        .select("id, attendance_date, check_in, check_out, status")
        .eq("employee_id", user.id)
        .eq("attendance_date", today)
        .maybeSingle();

      if (todayAttendance) {
        setAttendance(todayAttendance);
      }

      // =================================================
      // LAST 30 DAYS HISTORY
      // =================================================

      const { data: attendanceHistory } = await supabase
        .from("attendance")
        .select("id, attendance_date, check_in, check_out, status")
        .eq("employee_id", user.id)
        .order("attendance_date", {
          ascending: false,
        })
        .limit(30);

      setHistory(attendanceHistory ?? []);

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  // =====================================================
  // GET GPS LOCATION
  // =====================================================

  async function getCurrentLocation(): Promise<{
    latitude: number;
    longitude: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));

        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },

        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(
                new Error(
                  "Location permission denied. Please allow location access.",
                ),
              );
              break;

            case error.POSITION_UNAVAILABLE:
              reject(new Error("Your location could not be determined."));
              break;

            case error.TIMEOUT:
              reject(
                new Error("Location request timed out. Please try again."),
              );
              break;

            default:
              reject(new Error("Unable to get your location."));
          }
        },

        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    });
  }

  // =====================================================
  // CHECK IN / CHECK OUT
  // =====================================================

  async function handleAttendance() {
    setActionLoading(true);
    setMessage("");
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Get GPS
      const location = await getCurrentLocation();

      // Get session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please login again.");
      }

      // Determine action
      const action = attendance?.check_in ? "check_out" : "check_in";

      // Send request to secure API
      const response = await fetch("/api/attendance", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          action,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Attendance request failed.");
      }

      // Update today's attendance
      setAttendance(result.attendance);

      setMessage(result.message);

      // =================================================
      // UPDATE HISTORY
      // =================================================

      setHistory((previous) => {
        const updated = [
          result.attendance,
          ...previous.filter(
            (item) =>
              item.attendance_date !== result.attendance.attendance_date,
          ),
        ];

        return updated.slice(0, 30);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    router.push("/login");
  }

  // =====================================================
  // FORMAT TIME
  // =====================================================

  function formatTime(time: string | null) {
    if (!time) return "--:--";

    return new Date(time).toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // =====================================================
  // WORKING TIME
  // =====================================================

  function calculateWorkingTime(
    checkIn: string | null,
    checkOut: string | null,
  ) {
    if (!checkIn || !checkOut) {
      return "--";
    }

    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();

    const difference = end - start;

    if (difference <= 0) {
      return "--";
    }

    const totalMinutes = Math.floor(difference / (1000 * 60));

    const hours = Math.floor(totalMinutes / 60);

    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  }

  // =====================================================
  // TODAY WORKING TIME
  // =====================================================

  function getWorkingTime() {
    return calculateWorkingTime(
      attendance?.check_in ?? null,
      attendance?.check_out ?? null,
    );
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              F10S Attendance
            </h1>

            <p className="text-sm text-slate-500">Employee Dashboard</p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <section className="mx-auto max-w-6xl px-6 py-10">
        {/* WELCOME */}

        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Welcome back 👋</p>

          <h2 className="mt-1 text-3xl font-bold text-slate-900">{email}</h2>

          <p className="mt-2 text-sm text-slate-500">
            Manage your daily office attendance.
          </p>
        </div>

        {/* =================================================
            TODAY CARDS
        ================================================= */}

        <div className="grid gap-5 md:grid-cols-4">
          {/* CHECK IN */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Check In</p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {formatTime(attendance?.check_in ?? null)}
            </p>

            <p className="mt-2 text-xs text-slate-400">Today's check-in</p>
          </div>

          {/* CHECK OUT */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Check Out</p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {formatTime(attendance?.check_out ?? null)}
            </p>

            <p className="mt-2 text-xs text-slate-400">Today's check-out</p>
          </div>

          {/* WORKING TIME */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Working Time</p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {getWorkingTime()}
            </p>

            <p className="mt-2 text-xs text-slate-400">Today's total</p>
          </div>

          {/* STATUS */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Status</p>

            <p className="mt-3 text-2xl font-bold capitalize text-green-600">
              {attendance?.status ?? "Not Marked"}
            </p>

            <p className="mt-2 text-xs text-slate-400">Today's attendance</p>
          </div>
        </div>

        {/* =================================================
            ATTENDANCE ACTION
        ================================================= */}

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-4xl">
              📍
            </div>

            <h3 className="mt-5 text-2xl font-bold text-slate-900">
              Office Attendance
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Your current location will be verified before marking your
              attendance.
            </p>

            {/* SUCCESS */}

            {message && (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
                ✅ {message}
              </div>
            )}

            {/* ERROR */}

            {error && (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                ❌ {error}
              </div>
            )}

            {/* BUTTON */}

            <button
              onClick={handleAttendance}
              disabled={actionLoading || !!attendance?.check_out}
              className="mt-6 rounded-xl bg-slate-900 px-10 py-3.5 font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading
                ? "Checking location..."
                : attendance?.check_out
                  ? "Attendance Complete"
                  : attendance?.check_in
                    ? "Check Out"
                    : "Check In"}
            </button>

            <p className="mt-4 text-xs text-slate-400">
              📍 GPS verification required
            </p>
          </div>
        </div>

        {/* =================================================
            ATTENDANCE HISTORY
        ================================================= */}

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* HISTORY HEADER */}

          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Attendance History
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your recent attendance records
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Last 30 records
            </span>
          </div>

          {/* DESKTOP TABLE */}

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Check In
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Check Out
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Working Time
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-sm text-slate-400"
                    >
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  history.map((item, index) => (
                    <tr
                      key={item.id ?? `${item.attendance_date}-${index}`}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        {item.attendance_date
                          ? formatDate(item.attendance_date)
                          : "--"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatTime(item.check_in)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatTime(item.check_out)}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-700">
                        {calculateWorkingTime(item.check_in, item.check_out)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            item.status === "present"
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE HISTORY */}

          <div className="divide-y divide-slate-100 md:hidden">
            {history.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                No attendance records found.
              </div>
            ) : (
              history.map((item, index) => (
                <div
                  key={item.id ?? `${item.attendance_date}-${index}`}
                  className="p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-800">
                      {item.attendance_date
                        ? formatDate(item.attendance_date)
                        : "--"}
                    </p>

                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Check In</p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {formatTime(item.check_in)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">Check Out</p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {formatTime(item.check_out)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">Total</p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {calculateWorkingTime(item.check_in, item.check_out)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
