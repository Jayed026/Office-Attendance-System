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

  const [name, setName] = useState("");
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
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // =================================================
        // AUTH EMAIL
        // =================================================

        setEmail(user.email ?? "");

        // =================================================
        // PROFILE NAME
        // =================================================

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile load error:", profileError);
        }

        setName(profile?.full_name ?? "");

        // =================================================
        // TODAY
        // =================================================

        const today = getBangladeshDate();

        const { data: todayAttendance, error: todayError } = await supabase
          .from("attendance")
          .select("id, attendance_date, check_in, check_out, status")
          .eq("employee_id", user.id)
          .eq("attendance_date", today)
          .maybeSingle();

        if (todayError) {
          console.error("Today's attendance error:", todayError);
        }

        if (todayAttendance) {
          setAttendance(todayAttendance);
        }

        // =================================================
        // LAST 30 DAYS HISTORY
        // =================================================

        const { data: attendanceHistory, error: historyError } = await supabase
          .from("attendance")
          .select("id, attendance_date, check_in, check_out, status")
          .eq("employee_id", user.id)
          .order("attendance_date", {
            ascending: false,
          })
          .limit(30);

        if (historyError) {
          console.error("Attendance history error:", historyError);
        }

        setHistory(attendanceHistory ?? []);
      } catch (err) {
        console.error("Dashboard loading error:", err);

        setError(
          err instanceof Error ? err.message : "Failed to load dashboard.",
        );
      } finally {
        setLoading(false);
      }
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

        (locationError) => {
          switch (locationError.code) {
            case locationError.PERMISSION_DENIED:
              reject(
                new Error(
                  "Location permission denied. Please allow location access.",
                ),
              );
              break;

            case locationError.POSITION_UNAVAILABLE:
              reject(new Error("Your location could not be determined."));
              break;

            case locationError.TIMEOUT:
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

      // Secure API
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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
        <div className="rounded-3xl border border-white/70 bg-white/90 px-10 py-10 text-center shadow-xl backdrop-blur">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

          <p className="mt-5 text-sm font-semibold text-slate-600">
            Loading dashboard...
          </p>
        </div>
      </main>
    );
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          {/* LOGO */}

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-200">
              F
            </div>

            <div>
              <h1 className="text-lg font-bold text-slate-900">
                F10S Attendance
              </h1>

              <p className="text-xs font-medium text-slate-500">
                Employee Dashboard
              </p>
            </div>
          </div>

          {/* BUTTONS */}

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:px-4"
            >
              <span>👤</span>

              <span className="hidden sm:inline">Profile</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:px-4"
            >
              <span>↪</span>

              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        {/* =================================================
            WELCOME
        ================================================= */}

        <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-7 text-white shadow-xl shadow-blue-200 sm:p-9">
          {/* Decorative circles */}

          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />

          <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <span>✨</span>
              Employee Portal
            </div>

            <p className="text-sm font-medium text-blue-100">Welcome back 👋</p>

            {/* FULL NAME */}

            <h2 className="mt-1 text-3xl font-bold sm:text-4xl">
              {name || "Employee"}
            </h2>

            {/* EMAIL */}

            <p className="mt-2 break-all text-sm font-medium text-blue-100">
              {email}
            </p>

            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">
              Manage your daily office attendance and keep track of your working
              hours.
            </p>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 shadow-sm">
            ❌ {error}
          </div>
        )}

        {/* =================================================
            TODAY TITLE
        ================================================= */}

        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-900">
            Today&apos;s Attendance
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Your attendance summary for today.
          </p>
        </div>

        {/* =================================================
            TODAY CARDS
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* CHECK IN */}

          <div className="group overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="h-1 bg-blue-500" />

            <div className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">Check In</p>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg">
                  🟢
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold text-slate-900">
                {formatTime(attendance?.check_in ?? null)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Today&apos;s check-in time
              </p>
            </div>
          </div>

          {/* CHECK OUT */}

          <div className="group overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="h-1 bg-orange-500" />

            <div className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">
                  Check Out
                </p>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-lg">
                  🟠
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold text-slate-900">
                {formatTime(attendance?.check_out ?? null)}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Today&apos;s check-out time
              </p>
            </div>
          </div>

          {/* WORKING TIME */}

          <div className="group overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="h-1 bg-purple-500" />

            <div className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">
                  Working Time
                </p>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-lg">
                  ⏱️
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold text-slate-900">
                {getWorkingTime()}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Total working duration
              </p>
            </div>
          </div>

          {/* STATUS */}

          <div className="group overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="h-1 bg-green-500" />

            <div className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">Status</p>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-lg">
                  ✓
                </div>
              </div>

              <p
                className={`mt-4 text-2xl font-bold capitalize ${
                  attendance?.status ? "text-green-600" : "text-slate-400"
                }`}
              >
                {attendance?.status ?? "Not Marked"}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Today&apos;s attendance status
              </p>
            </div>
          </div>
        </div>

        {/* =================================================
            ATTENDANCE ACTION
        ================================================= */}

        <div className="mt-7 overflow-hidden rounded-3xl border border-white/70 bg-white shadow-xl">
          <div className="relative p-7 text-center sm:p-10">
            {/* Background decoration */}

            <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full bg-blue-100/60 blur-3xl" />

            <div className="relative">
              {/* GPS ICON */}

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 text-4xl shadow-xl shadow-blue-200">
                📍
              </div>

              <h3 className="mt-6 text-2xl font-bold text-slate-900">
                Office Attendance
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Your current location will be verified before marking your
                attendance.
              </p>

              {/* SUCCESS */}

              {message && (
                <div className="mx-auto mt-5 max-w-md rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
                  ✅ {message}
                </div>
              )}

              {/* ERROR */}

              {error && (
                <div className="mx-auto mt-5 max-w-md rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  ❌ {error}
                </div>
              )}

              {/* ATTENDANCE BUTTON */}

              <button
                onClick={handleAttendance}
                disabled={actionLoading || !!attendance?.check_out}
                className="mt-7 inline-flex min-w-[190px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 font-bold text-white shadow-lg shadow-blue-200 transition duration-300 hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {actionLoading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Checking location...
                  </>
                ) : attendance?.check_out ? (
                  <>✓ Attendance Complete</>
                ) : attendance?.check_in ? (
                  <>🏁 Check Out</>
                ) : (
                  <>📍 Check In</>
                )}
              </button>

              <p className="mt-4 text-xs font-medium text-slate-400">
                🔒 GPS verification required
              </p>
            </div>
          </div>
        </div>

        {/* =================================================
            ATTENDANCE HISTORY
        ================================================= */}

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          {/* HISTORY HEADER */}

          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Attendance History
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your recent attendance records.
              </p>
            </div>

            <span className="w-fit rounded-full bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700">
              Last 30 records
            </span>
          </div>

          {/* =================================================
              DESKTOP TABLE
          ================================================= */}

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Date
                  </th>

                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Check In
                  </th>

                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Check Out
                  </th>

                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Working Time
                  </th>

                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                        📋
                      </div>

                      <p className="mt-4 font-semibold text-slate-700">
                        No attendance records
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        Your attendance history will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  history.map((item, index) => (
                    <tr
                      key={item.id ?? `${item.attendance_date}-${index}`}
                      className="transition hover:bg-blue-50/40"
                    >
                      <td className="px-6 py-5 text-sm font-semibold text-slate-800">
                        {item.attendance_date
                          ? formatDate(item.attendance_date)
                          : "--"}
                      </td>

                      <td className="px-6 py-5 text-sm font-medium text-slate-600">
                        {formatTime(item.check_in)}
                      </td>

                      <td className="px-6 py-5 text-sm font-medium text-slate-600">
                        {formatTime(item.check_out)}
                      </td>

                      <td className="px-6 py-5 text-sm font-semibold text-slate-700">
                        {calculateWorkingTime(item.check_in, item.check_out)}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                            item.status === "present"
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              item.status === "present"
                                ? "bg-green-500"
                                : "bg-slate-400"
                            }`}
                          />

                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* =================================================
              MOBILE HISTORY
          ================================================= */}

          <div className="divide-y divide-slate-100 md:hidden">
            {history.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                  📋
                </div>

                <p className="mt-4 font-semibold text-slate-700">
                  No attendance records
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Your attendance history will appear here.
                </p>
              </div>
            ) : (
              history.map((item, index) => (
                <div
                  key={item.id ?? `${item.attendance_date}-${index}`}
                  className="p-5"
                >
                  {/* DATE + STATUS */}

                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-800">
                      {item.attendance_date
                        ? formatDate(item.attendance_date)
                        : "--"}
                    </p>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                        item.status === "present"
                          ? "bg-green-50 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.status === "present"
                            ? "bg-green-500"
                            : "bg-slate-400"
                        }`}
                      />

                      {item.status}
                    </span>
                  </div>

                  {/* DETAILS */}

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {/* CHECK IN */}

                    <div className="rounded-xl bg-blue-50 p-3">
                      <p className="text-xs font-medium text-blue-500">
                        Check In
                      </p>

                      <p className="mt-1 text-sm font-bold text-slate-700">
                        {formatTime(item.check_in)}
                      </p>
                    </div>

                    {/* CHECK OUT */}

                    <div className="rounded-xl bg-orange-50 p-3">
                      <p className="text-xs font-medium text-orange-500">
                        Check Out
                      </p>

                      <p className="mt-1 text-sm font-bold text-slate-700">
                        {formatTime(item.check_out)}
                      </p>
                    </div>

                    {/* TOTAL */}

                    <div className="rounded-xl bg-purple-50 p-3">
                      <p className="text-xs font-medium text-purple-500">
                        Total
                      </p>

                      <p className="mt-1 text-sm font-bold text-slate-700">
                        {calculateWorkingTime(item.check_in, item.check_out)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="py-8 text-center">
          <p className="text-xs font-medium text-slate-400">
            F10S Attendance • Secure Employee Portal
          </p>
        </div>
      </section>
    </main>
  );
}
