"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function EmployeesPage() {
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [error, setError] = useState("");

  // =====================================================
  // ADD EMPLOYEE MODAL
  // =====================================================

  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // =====================================================
  // LOAD EMPLOYEES
  // =====================================================

  async function loadEmployees() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/admin/employees", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid API response: ${text || "Empty response"}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load employees.");
      }

      setEmployees(data.employees || []);
    } catch (err) {
      console.error("Load employees error:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load employees.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmployees();
  }, []);

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredEmployees = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) {
      return employees;
    }

    return employees.filter((employee) => {
      return (
        employee.full_name?.toLowerCase().includes(value) ||
        employee.email?.toLowerCase().includes(value) ||
        employee.role?.toLowerCase().includes(value)
      );
    });
  }, [employees, search]);

  // =====================================================
  // ADD EMPLOYEE
  // =====================================================

  async function handleCreateEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/admin/employees", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          full_name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid API response: ${text || "Empty response"}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create employee.");
      }

      setCreateSuccess("Employee created successfully.");

      setName("");
      setEmail("");
      setPassword("");

      await loadEmployees();

      setTimeout(() => {
        setShowAddModal(false);
        setCreateSuccess("");
      }, 1000);
    } catch (err) {
      console.error("Create employee error:", err);

      setCreateError(
        err instanceof Error ? err.message : "Failed to create employee.",
      );
    } finally {
      setCreating(false);
    }
  }

  // =====================================================
  // ACTIVATE / DEACTIVATE
  // =====================================================

  async function toggleEmployee(employee: Employee) {
    const action = employee.is_active ? "deactivate" : "activate";

    const confirmed = window.confirm(
      employee.is_active
        ? `Are you sure you want to deactivate ${employee.full_name}?`
        : `Are you sure you want to activate ${employee.full_name}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(employee.id);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          is_active: !employee.is_active,
        }),
      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid API response: ${text || "Empty response"}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to ${action} employee.`);
      }

      setEmployees((currentEmployees) =>
        currentEmployees.map((item) =>
          item.id === employee.id
            ? {
                ...item,
                is_active: !item.is_active,
              }
            : item,
        ),
      );
    } catch (err) {
      console.error("Toggle employee error:", err);

      setError(
        err instanceof Error ? err.message : `Failed to ${action} employee.`,
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =====================================================
  // DELETE EMPLOYEE
  // =====================================================

  async function deleteEmployee(employee: Employee) {
    const confirmed = window.confirm(
      `WARNING!\n\nAre you sure you want to permanently delete ${employee.full_name}'s account?\n\nEmail: ${employee.email}\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    const secondConfirmed = window.confirm(
      `Final confirmation:\n\nDelete ${employee.full_name} permanently?`,
    );

    if (!secondConfirmed) {
      return;
    }

    try {
      setActionLoading(employee.id);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid API response: ${text || "Empty response"}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete employee account.");
      }

      setEmployees((currentEmployees) =>
        currentEmployees.filter((item) => item.id !== employee.id),
      );
    } catch (err) {
      console.error("Delete employee error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete employee account.",
      );
    } finally {
      setActionLoading(null);
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
  // CLOSE MODAL
  // =====================================================

  function closeModal() {
    if (creating) return;

    setShowAddModal(false);
    setCreateError("");
    setCreateSuccess("");
    setName("");
    setEmail("");
    setPassword("");
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
        <div className="rounded-3xl border border-white/70 bg-white/80 px-10 py-9 text-center shadow-xl backdrop-blur">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

          <p className="mt-5 text-sm font-semibold text-slate-600">
            Loading employees...
          </p>

          <p className="mt-1 text-xs text-slate-400">Please wait a moment</p>
        </div>
      </main>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/60 to-indigo-100/70">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
          {/* BRAND */}

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-black text-white shadow-lg shadow-blue-200">
              F
            </div>

            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                F10S Attendance
              </h1>

              <p className="text-xs font-medium text-slate-400">
                Administration Panel
              </p>
            </div>
          </div>

          {/* NAV */}

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin")}
              className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:block"
            >
              Dashboard
            </button>

            <button
              onClick={() => router.push("/profile")}
              className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 sm:block"
            >
              Profile
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* =================================================
          CONTENT
      ================================================= */}

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:py-10">
        {/* HERO */}

        <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-7 shadow-xl shadow-blue-200/50 sm:p-9">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-green-300" />
                Admin Control Center
              </div>

              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Employee Management
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">
                Manage employee accounts, access status and organization members
                from one place.
              </p>
            </div>

            <button
              onClick={() => {
                setShowAddModal(true);
                setCreateError("");
                setCreateSuccess("");
              }}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-blue-700 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-lg transition-transform group-hover:rotate-90">
                +
              </span>
              Add Employee
            </button>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
                ⚠️
              </div>

              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>

            <button
              onClick={() => setError("")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-red-400 transition hover:bg-red-100 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            STATS
        ================================================= */}

        <div className="mb-7 grid gap-5 md:grid-cols-3">
          {/* TOTAL */}

          <div className="group overflow-hidden rounded-2xl border border-blue-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Total Employees
                </p>

                <p className="mt-2 text-4xl font-black text-slate-900">
                  {employees.length}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Registered accounts
                </p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl transition-transform group-hover:scale-110">
                👥
              </div>
            </div>
          </div>

          {/* ACTIVE */}

          <div className="group overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Active Employees
                </p>

                <p className="mt-2 text-4xl font-black text-emerald-600">
                  {employees.filter((employee) => employee.is_active).length}
                </p>

                <p className="mt-1 text-xs text-slate-400">Currently enabled</p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl transition-transform group-hover:scale-110">
                ✓
              </div>
            </div>
          </div>

          {/* INACTIVE */}

          <div className="group overflow-hidden rounded-2xl border border-rose-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Inactive Employees
                </p>

                <p className="mt-2 text-4xl font-black text-rose-600">
                  {employees.filter((employee) => !employee.is_active).length}
                </p>

                <p className="mt-1 text-xs text-slate-400">Access disabled</p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-2xl transition-transform group-hover:scale-110">
                !
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            EMPLOYEE TABLE CARD
        ================================================= */}

        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-xl shadow-slate-200/60">
          {/* TABLE HEADER */}

          <div className="border-b border-slate-100 bg-white px-6 py-6 sm:px-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-extrabold text-slate-900">
                    Employee List
                  </h3>

                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600">
                    {employees.length}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  View and manage all employee accounts.
                </p>
              </div>

              {/* SEARCH */}

              <div className="relative w-full lg:w-96">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email or role..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-7 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Employee
                  </th>

                  <th className="px-7 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Email
                  </th>

                  <th className="px-7 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Role
                  </th>

                  <th className="px-7 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Status
                  </th>

                  <th className="px-7 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Joined
                  </th>

                  <th className="px-7 py-4 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                        👥
                      </div>

                      <p className="mt-5 font-bold text-slate-700">
                        No employees found
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        Try another search or add a new employee.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => {
                    const isProcessing = actionLoading === employee.id;

                    return (
                      <tr
                        key={employee.id}
                        className="group transition-colors hover:bg-blue-50/30"
                      >
                        {/* EMPLOYEE */}

                        <td className="px-7 py-5">
                          <div className="flex items-center gap-3.5">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-black text-white shadow-md shadow-blue-100">
                              {(employee.full_name || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <p className="font-bold text-slate-800">
                                {employee.full_name || "Unnamed Employee"}
                              </p>

                              <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                                ID: {employee.id.slice(0, 8)}...
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* EMAIL */}

                        <td className="px-7 py-5">
                          <span className="text-sm font-medium text-slate-600">
                            {employee.email || "No email"}
                          </span>
                        </td>

                        {/* ROLE */}

                        <td className="px-7 py-5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                              employee.role === "admin"
                                ? "bg-violet-50 text-violet-700 ring-1 ring-violet-100"
                                : "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                            }`}
                          >
                            <span>
                              {employee.role === "admin" ? "👑" : "👤"}
                            </span>

                            {employee.role === "admin" ? "Admin" : "Employee"}
                          </span>
                        </td>

                        {/* STATUS */}

                        <td className="px-7 py-5">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                              employee.is_active
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                employee.is_active
                                  ? "bg-emerald-500"
                                  : "bg-rose-500"
                              }`}
                            />

                            {employee.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* JOINED */}

                        <td className="px-7 py-5">
                          <span className="text-sm font-medium text-slate-600">
                            {new Date(employee.created_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </td>

                        {/* ACTION */}

                        <td className="px-7 py-5">
                          {employee.role === "admin" ? (
                            <div className="flex justify-end">
                              <span className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-600">
                                Protected
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                disabled={isProcessing}
                                onClick={() => toggleEmployee(employee)}
                                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                                  employee.is_active
                                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {isProcessing
                                  ? "Updating..."
                                  : employee.is_active
                                    ? "Deactivate"
                                    : "Activate"}
                              </button>

                              <button
                                disabled={isProcessing}
                                onClick={() => deleteEmployee(employee)}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition-all hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isProcessing ? "Processing..." : "Delete"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}

          <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <p className="text-xs font-medium text-slate-400">
              Showing{" "}
              <span className="font-bold text-slate-600">
                {filteredEmployees.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-600">
                {employees.length}
              </span>{" "}
              employees
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          ADD EMPLOYEE MODAL
      ===================================================== */}

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
            {/* MODAL HEADER */}

            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-6 py-7">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-white/10" />

              <div className="relative flex items-start justify-between">
                <div>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">
                    👤
                  </div>

                  <h3 className="text-2xl font-extrabold text-white">
                    Add Employee
                  </h3>

                  <p className="mt-1 text-sm text-blue-100">
                    Create a new employee account.
                  </p>
                </div>

                <button
                  onClick={closeModal}
                  disabled={creating}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xl text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </div>

            {/* FORM */}

            <form onSubmit={handleCreateEmployee} className="space-y-5 p-6">
              {/* NAME */}

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Full Name
                </label>

                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* EMAIL */}

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Email Address
                </label>

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* PASSWORD */}

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />

                <p className="mt-2 text-xs text-slate-400">
                  Use at least 6 characters for the password.
                </p>
              </div>

              {/* ERROR */}

              {createError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5">
                  <span>⚠️</span>

                  <p className="text-sm font-semibold text-red-600">
                    {createError}
                  </p>
                </div>
              )}

              {/* SUCCESS */}

              {createSuccess && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5">
                  <span>✓</span>

                  <p className="text-sm font-semibold text-emerald-600">
                    {createSuccess}
                  </p>
                </div>
              )}

              {/* BUTTONS */}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating...
                    </span>
                  ) : (
                    "Create Employee"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
