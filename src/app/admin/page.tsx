"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AttendanceRecord = {
  employee_id: string;
  full_name: string;

  attendance: {
    id: number;
    attendance_date: string;
    check_in: string | null;
    check_out: string | null;
    status: string;
  } | null;
};

type Summary = {
  totalEmployees: number;
  present: number;
  checkedOut: number;
  currentlyWorking: number;
  missing: number;
};

export default function AdminPage() {
  const router = useRouter();

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

  function getBangladeshDate() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
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
  // WORKING TIME
  // =====================================================

  function calculateWorkingTime(
    checkIn: string | null,
    checkOut: string | null,
  ) {
    if (!checkIn) return "--";

    const start = new Date(checkIn).getTime();

    const end = checkOut ? new Date(checkOut).getTime() : Date.now();

    const difference = end - start;

    if (difference <= 0) return "--";

    const totalMinutes = Math.floor(difference / (1000 * 60));

    const hours = Math.floor(totalMinutes / 60);

    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  }

  // =====================================================
  // LOAD ADMIN DATA
  // =====================================================

  async function loadAttendance(selectedDate: string) {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `/api/admin/attendance?date=${selectedDate}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        if (response.status === 403) {
          router.push("/dashboard");
          return;
        }

        throw new Error(result.message || "Failed to load attendance.");
      }

      setSummary(result.summary);
      setRecords(result.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    const today = getBangladeshDate();

    setDate(today);

    loadAttendance(today);
  }, []);

  // =====================================================
  // DATE CHANGE
  // =====================================================

  function handleDateChange(value: string) {
    setDate(value);

    loadAttendance(value);
  }

  // =====================================================
  // FILTER
  // =====================================================

  const filteredRecords = records.filter((record) =>
    record.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    router.push("/login");
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              F10S Attendance
            </h1>

            <p className="text-sm text-slate-500">Admin Panel</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/employees")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Employee Dashboard
            </button>

            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* =================================================
          CONTENT
      ================================================= */}

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* TITLE */}

        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">Management</p>

          <h2 className="mt-1 text-3xl font-bold text-slate-900">
            Attendance Overview
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Monitor employee attendance and working hours.
          </p>
        </div>

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {/* TOTAL */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Employees</p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {summary.totalEmployees}
            </p>
          </div>

          {/* PRESENT */}

          <div className="rounded-2xl border border-green-100 bg-green-50 p-5 shadow-sm">
            <p className="text-sm text-green-700">Present</p>

            <p className="mt-2 text-3xl font-bold text-green-700">
              {summary.present}
            </p>
          </div>

          {/* CHECKED OUT */}

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm text-blue-700">Checked Out</p>

            <p className="mt-2 text-3xl font-bold text-blue-700">
              {summary.checkedOut}
            </p>
          </div>

          {/* WORKING */}

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm text-amber-700">Currently Working</p>

            <p className="mt-2 text-3xl font-bold text-amber-700">
              {summary.currentlyWorking}
            </p>
          </div>

          {/* MISSING */}

          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm">
            <p className="text-sm text-red-700">Missing</p>

            <p className="mt-2 text-3xl font-bold text-red-700">
              {summary.missing}
            </p>
          </div>
        </div>

        {/* =================================================
            FILTER BAR
        ================================================= */}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            {/* DATE */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Attendance Date
              </label>

              <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </div>

            {/* SEARCH */}

            <div className="w-full md:max-w-sm">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Search Employee
              </label>

              <input
                type="text"
                placeholder="Search by employee name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            ❌ {error}
          </div>
        )}

        {/* =================================================
            ATTENDANCE TABLE
        ================================================= */}

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-lg font-bold text-slate-900">
              Employee Attendance
            </h3>

            <p className="mt-1 text-sm text-slate-500">{date}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Employee
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
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-sm text-slate-400"
                      >
                        No employees found.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => {
                      const attendance = record.attendance;

                      return (
                        <tr
                          key={record.employee_id}
                          className="hover:bg-slate-50"
                        >
                          {/* EMPLOYEE */}

                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                                {record.full_name.charAt(0).toUpperCase()}
                              </div>

                              <div>
                                <p className="font-semibold text-slate-800">
                                  {record.full_name}
                                </p>

                                <p className="text-xs text-slate-400">
                                  Employee
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* IN */}

                          <td className="px-6 py-5 text-sm text-slate-600">
                            {formatTime(attendance?.check_in ?? null)}
                          </td>

                          {/* OUT */}

                          <td className="px-6 py-5 text-sm text-slate-600">
                            {formatTime(attendance?.check_out ?? null)}
                          </td>

                          {/* HOURS */}

                          <td className="px-6 py-5 text-sm font-medium text-slate-700">
                            {calculateWorkingTime(
                              attendance?.check_in ?? null,
                              attendance?.check_out ?? null,
                            )}
                          </td>

                          {/* STATUS */}

                          <td className="px-6 py-5">
                            {!attendance ? (
                              <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                Absent
                              </span>
                            ) : attendance.check_out ? (
                              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
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
      </section>
    </main>
  );
}
