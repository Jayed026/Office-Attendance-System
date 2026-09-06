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

  // =====================================================
  // EMPLOYEES
  // =====================================================

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

  useEffect(() => {
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
      } catch (error) {
        console.error("Load employees error:", error);

        setError(
          error instanceof Error ? error.message : "Failed to load employees.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadEmployees();
  }, [router]);

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
          full_name: name,
          email,
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

      // Reload employee list
      const reloadResponse = await fetch("/api/admin/employees", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const reloadText = await reloadResponse.text();

      const reloadData = JSON.parse(reloadText);

      if (reloadResponse.ok && reloadData.success) {
        setEmployees(reloadData.employees || []);
      }

      setTimeout(() => {
        setShowAddModal(false);
        setCreateSuccess("");
      }, 1000);
    } catch (error) {
      console.error("Create employee error:", error);

      setCreateError(
        error instanceof Error ? error.message : "Failed to create employee.",
      );
    } finally {
      setCreating(false);
    }
  }

  // =====================================================
  // ACTIVATE / DEACTIVATE EMPLOYEE
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

      // Update UI immediately
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
    } catch (error) {
      console.error("Toggle employee error:", error);

      setError(
        error instanceof Error
          ? error.message
          : `Failed to ${action} employee.`,
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
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

          <p className="mt-4 text-sm font-medium text-slate-500">
            Loading employees...
          </p>
        </div>
      </main>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              F10S Attendance
            </h1>

            <p className="text-sm text-slate-500">Admin Panel</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Dashboard
            </button>

            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
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

        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-blue-600">Administration</p>

            <h2 className="mt-1 text-3xl font-bold text-slate-900">
              Employee Management
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Manage employees, accounts and access status.
            </p>
          </div>

          <button
            onClick={() => {
              setShowAddModal(true);
              setCreateError("");
              setCreateSuccess("");
            }}
            className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            + Add Employee
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
            ⚠️ {error}
          </div>
        )}

        {/* =================================================
            STATS
        ================================================= */}

        <div className="mb-6 grid gap-5 md:grid-cols-3">
          {/* TOTAL */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Total Employees
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {employees.length}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                👥
              </div>
            </div>
          </div>

          {/* ACTIVE */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Active</p>

                <p className="mt-2 text-3xl font-bold text-green-600">
                  {employees.filter((employee) => employee.is_active).length}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-2xl">
                ✓
              </div>
            </div>
          </div>

          {/* INACTIVE */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Inactive</p>

                <p className="mt-2 text-3xl font-bold text-red-600">
                  {employees.filter((employee) => !employee.is_active).length}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-2xl">
                !
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            TABLE CARD
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* TABLE HEADER */}

          <div className="flex flex-col gap-4 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Employee List
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredEmployees.length} of {employees.length}{" "}
                employees
              </p>
            </div>

            {/* SEARCH */}

            <div className="relative w-full md:w-80">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              {/* HEAD */}

              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Joined
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              {/* BODY */}

              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
                        👥
                      </div>

                      <p className="mt-4 font-semibold text-slate-700">
                        No employees found
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        Try a different search or add a new employee.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="transition hover:bg-slate-50"
                    >
                      {/* EMPLOYEE */}

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white shadow-sm">
                            {(employee.full_name || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {employee.full_name || "Unnamed Employee"}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              ID: {employee.id.slice(0, 8)}
                              ...
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* EMAIL */}

                      <td className="px-6 py-5">
                        <p className="text-sm text-slate-600">
                          {employee.email || "No email"}
                        </p>
                      </td>

                      {/* ROLE */}

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            employee.role === "admin"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {employee.role === "admin" ? "Admin" : "Employee"}
                        </span>
                      </td>

                      {/* STATUS */}

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            employee.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              employee.is_active ? "bg-green-500" : "bg-red-500"
                            }`}
                          />

                          {employee.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* JOINED */}

                      <td className="px-6 py-5">
                        <p className="text-sm text-slate-600">
                          {new Date(employee.created_at).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </p>
                      </td>

                      {/* ACTION */}

                      <td className="px-6 py-5 text-right">
                        {employee.role === "admin" ? (
                          <span className="text-xs font-medium text-slate-400">
                            Admin
                          </span>
                        ) : (
                          <button
                            disabled={actionLoading === employee.id}
                            onClick={() => toggleEmployee(employee)}
                            className={`rounded-lg border px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              employee.is_active
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-green-200 text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {actionLoading === employee.id
                              ? "Updating..."
                              : employee.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =================================================
          ADD EMPLOYEE MODAL
      ================================================= */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Add Employee
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Create a new employee account.
                </p>
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            {/* FORM */}

            <form onSubmit={handleCreateEmployee} className="space-y-5 p-6">
              {/* NAME */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Full Name
                </label>

                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* EMAIL */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* PASSWORD */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* ERROR */}

              {createError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
                  ⚠️ {createError}
                </div>
              )}

              {/* SUCCESS */}

              {createSuccess && (
                <div className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-600">
                  ✓ {createSuccess}
                </div>
              )}

              {/* BUTTONS */}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
