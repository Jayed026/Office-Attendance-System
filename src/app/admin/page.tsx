"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// =====================================================
// TYPES
// =====================================================

type Attendance = {
  id: number;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
};

type AttendanceRecord = {
  employee_id: string;
  full_name: string;
  attendance: Attendance | null;
};

type Summary = {
  totalEmployees: number;
  present: number;
  checkedOut: number;
  currentlyWorking: number;
  missing: number;
};

// =====================================================
// PAGE
// =====================================================

export default function AdminPage() {
  const router = useRouter();

  // =====================================================
  // STATE
  // =====================================================

  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [summary, setSummary] = useState<Summary>({
    totalEmployees: 0,
    present: 0,
    checkedOut: 0,
    currentlyWorking: 0,
    missing: 0,
  });

  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // BANGLADESH DATE
  // =====================================================

  const getBangladeshDate = useCallback((): string => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  // =====================================================
  // FORMAT TIME
  // =====================================================

  const formatTime = useCallback((time: string | null): string => {
    if (!time) {
      return "--:--";
    }

    const dateObject = new Date(time);

    if (Number.isNaN(dateObject.getTime())) {
      return "--:--";
    }

    return dateObject.toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // =====================================================
  // CALCULATE WORKING TIME
  // =====================================================

  const calculateWorkingTime = useCallback(
    (checkIn: string | null, checkOut: string | null): string => {
      if (!checkIn) {
        return "--";
      }

      const start = new Date(checkIn).getTime();
      const end = checkOut ? new Date(checkOut).getTime() : Date.now();

      if (Number.isNaN(start) || Number.isNaN(end)) {
        return "--";
      }

      const difference = end - start;

      if (difference <= 0) {
        return "--";
      }

      const totalMinutes = Math.floor(difference / (1000 * 60));

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${hours}h ${minutes}m`;
    },
    [],
  );

  // =====================================================
  // LOAD ATTENDANCE
  // =====================================================

  const loadAttendance = useCallback(
    async (selectedDate: string) => {
      if (!selectedDate) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        // GET SESSION

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          router.push("/login");
          return;
        }

        // API REQUEST

        const response = await fetch(
          `/api/admin/attendance?date=${encodeURIComponent(selectedDate)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          },
        );

        // SAFE JSON

        const responseText = await response.text();

        let result: {
          success?: boolean;
          message?: string;
          summary?: Summary;
          records?: AttendanceRecord[];
        } = {};

        try {
          result = responseText ? JSON.parse(responseText) : {};
        } catch {
          console.error("Invalid attendance API response:", responseText);

          throw new Error("Attendance API returned an invalid response.");
        }

        console.log("ATTENDANCE API RESPONSE:", result);

        // ERROR

        if (!response.ok || !result.success) {
          if (response.status === 401) {
            router.push("/login");
            return;
          }

          if (response.status === 403) {
            router.push("/dashboard");
            return;
          }

          throw new Error(
            result.message || `Failed to load attendance (${response.status}).`,
          );
        }

        // SET DATA

        setSummary(
          result.summary ?? {
            totalEmployees: 0,
            present: 0,
            checkedOut: 0,
            currentlyWorking: 0,
            missing: 0,
          },
        );

        setRecords(result.records ?? []);
      } catch (err) {
        console.error("Load attendance error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading attendance.",
        );
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    const today = getBangladeshDate();

    setDate(today);

    void loadAttendance(today);
  }, [getBangladeshDate, loadAttendance]);

  // =====================================================
  // DATE CHANGE
  // =====================================================

  function handleDateChange(value: string) {
    setDate(value);
    void loadAttendance(value);
  }

  // =====================================================
  // SEARCH FILTER
  // =====================================================

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return records;
    }

    return records.filter((record) =>
      record.full_name.toLowerCase().includes(query),
    );
  }, [records, search]);

  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    router.push("/login");
  }

  // =====================================================
  // REFRESH
  // =====================================================

  function handleRefresh() {
    if (date) {
      void loadAttendance(date);
    }
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/40">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          {/* BRAND */}

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-black text-white shadow-lg shadow-blue-200">
              F
            </div>

            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
                F10S Attendance
              </h1>

              <p className="text-xs font-medium text-slate-500 sm:text-sm">
                Admin Control Center
              </p>
            </div>
          </div>

          {/* HEADER ACTIONS */}

          <div className="flex items-center gap-2 sm:gap-3">
            {/* EMPLOYEES */}

            <button
              onClick={() => router.push("/admin/employees")}
              className="group inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-100 hover:shadow-md sm:px-4"
            >
              <span>👥</span>
              <span className="hidden sm:inline">Employees</span>
            </button>

            {/* PROFILE */}

            <button
              onClick={() => router.push("/profile")}
              className="group inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-100 hover:shadow-md sm:px-4"
            >
              <span>👤</span>
              <span className="hidden sm:inline">Profile</span>
            </button>

            {/* LOGOUT */}

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-3 py-2 text-sm font-bold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:from-red-600 hover:to-red-500 hover:shadow-lg sm:px-4"
            >
              <span>↪</span>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* =================================================
          CONTENT
      ================================================= */}

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        {/* HERO */}

        <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-blue-200 sm:p-8">
          {/* Decorative circles */}

          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />

          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-green-300" />
              Admin Dashboard
            </div>

            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Attendance Overview
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                  Monitor employee attendance, working hours and daily activity
                  from one place.
                </p>
              </div>

              {/* REFRESH */}

              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={loading ? "animate-spin" : ""}>↻</span>

                {loading ? "Refreshing..." : "Refresh Data"}
              </button>
            </div>
          </div>
        </div>

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* TOTAL */}

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-slate-100 transition-transform group-hover:scale-125" />

            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  👥
                </div>

                <span className="text-xs font-bold text-slate-400">TOTAL</span>
              </div>

              <p className="text-sm font-semibold text-slate-500">
                Total Employees
              </p>

              <p className="mt-1 text-3xl font-black text-slate-900">
                {summary.totalEmployees}
              </p>
            </div>
          </div>

          {/* PRESENT */}

          <div className="group relative overflow-hidden rounded-2xl border border-green-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-green-50 transition-transform group-hover:scale-125" />

            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-xl">
                  ✓
                </div>

                <span className="text-xs font-bold text-green-500">TODAY</span>
              </div>

              <p className="text-sm font-semibold text-green-700">Present</p>

              <p className="mt-1 text-3xl font-black text-green-700">
                {summary.present}
              </p>
            </div>
          </div>

          {/* CHECKED OUT */}

          <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-blue-50 transition-transform group-hover:scale-125" />

            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl">
                  ✓
                </div>

                <span className="text-xs font-bold text-blue-500">DONE</span>
              </div>

              <p className="text-sm font-semibold text-blue-700">Checked Out</p>

              <p className="mt-1 text-3xl font-black text-blue-700">
                {summary.checkedOut}
              </p>
            </div>
          </div>

          {/* CURRENTLY WORKING */}

          <div className="group relative overflow-hidden rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-amber-50 transition-transform group-hover:scale-125" />

            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-xl">
                  ⏱
                </div>

                <span className="text-xs font-bold text-amber-500">ACTIVE</span>
              </div>

              <p className="text-sm font-semibold text-amber-700">
                Currently Working
              </p>

              <p className="mt-1 text-3xl font-black text-amber-700">
                {summary.currentlyWorking}
              </p>
            </div>
          </div>

          {/* MISSING */}

          <div className="group relative overflow-hidden rounded-2xl border border-red-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-red-50 transition-transform group-hover:scale-125" />

            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-xl">
                  !
                </div>

                <span className="text-xs font-bold text-red-500">ALERT</span>
              </div>

              <p className="text-sm font-semibold text-red-700">Missing</p>

              <p className="mt-1 text-3xl font-black text-red-700">
                {summary.missing}
              </p>
            </div>
          </div>
        </div>

        {/* =================================================
            FILTER
        ================================================= */}

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg">
              🔎
            </div>

            <div>
              <h3 className="font-bold text-slate-900">Attendance Filters</h3>

              <p className="text-xs text-slate-500">
                Select a date or search for an employee
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 md:flex-row md:items-end">
            {/* DATE */}

            <div className="flex-1">
              <label
                htmlFor="attendance-date"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Attendance Date
              </label>

              <div className="relative">
                <input
                  id="attendance-date"
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* SEARCH */}

            <div className="flex-1">
              <label
                htmlFor="employee-search"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Search Employee
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>

                <input
                  id="employee-search"
                  type="text"
                  placeholder="Search by employee name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-red-700">Something went wrong</p>

              <p className="mt-1 text-sm text-red-600">{error}</p>
            </div>

            <button
              onClick={handleRefresh}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* =================================================
            ATTENDANCE TABLE
        ================================================= */}

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* TABLE HEADER */}

          <div className="border-b border-slate-200 bg-gradient-to-r from-white to-slate-50 px-5 py-5 sm:px-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-xl">
                  📊
                </div>

                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Employee Attendance
                  </h3>

                  <p className="mt-0.5 text-sm text-slate-500">
                    {date || "Loading date..."}
                  </p>
                </div>
              </div>

              <div className="flex w-fit items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Showing{" "}
                <span className="font-black text-slate-900">
                  {filteredRecords.length}
                </span>{" "}
                employees
              </div>
            </div>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="relative">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

                <div className="absolute inset-0 flex items-center justify-center text-sm">
                  📊
                </div>
              </div>

              <p className="mt-5 text-sm font-bold text-slate-600">
                Loading attendance...
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Please wait a moment
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Employee
                    </th>

                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Check In
                    </th>

                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Check Out
                    </th>

                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Working Time
                    </th>

                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                          👥
                        </div>

                        <p className="mt-5 font-bold text-slate-700">
                          No employees found
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          No attendance data is available for this date.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => {
                      const attendance = record.attendance;

                      return (
                        <tr
                          key={record.employee_id}
                          className="group transition-all duration-150 hover:bg-blue-50/40"
                        >
                          {/* EMPLOYEE */}

                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 font-black text-blue-700 ring-4 ring-blue-50">
                                {(record.full_name || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div>
                                <p className="font-bold text-slate-800">
                                  {record.full_name || "Unnamed Employee"}
                                </p>

                                <p className="mt-0.5 text-xs font-medium text-slate-400">
                                  Employee
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* CHECK IN */}

                          <td className="px-6 py-5">
                            <span className="inline-flex rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700">
                              {formatTime(attendance?.check_in ?? null)}
                            </span>
                          </td>

                          {/* CHECK OUT */}

                          <td className="px-6 py-5">
                            <span className="inline-flex rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                              {formatTime(attendance?.check_out ?? null)}
                            </span>
                          </td>

                          {/* WORKING TIME */}

                          <td className="px-6 py-5">
                            <span className="text-sm font-bold text-slate-700">
                              {calculateWorkingTime(
                                attendance?.check_in ?? null,
                                attendance?.check_out ?? null,
                              )}
                            </span>
                          </td>

                          {/* STATUS */}

                          <td className="px-6 py-5">
                            {!attendance ? (
                              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3.5 py-1.5 text-xs font-extrabold text-red-700">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                Absent
                              </span>
                            ) : attendance.check_out ? (
                              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-extrabold text-blue-700">
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3.5 py-1.5 text-xs font-extrabold text-green-700">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                                Working
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =================================================
            FOOTER INFO
        ================================================= */}

        <div className="mt-5 flex flex-col justify-between gap-2 px-1 text-xs text-slate-400 sm:flex-row">
          <p>F10S Attendance Management System</p>

          <p>Bangladesh Time • {date || "--"}</p>
        </div>
      </section>
    </main>
  );
}
