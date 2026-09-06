"use client";

import { FormEvent, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  full_name: string | null;
  role: "employee" | "admin";
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

  //const [actionLoading, setActionLoading] = useState("");

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
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const result = await response.json();

      console.log("EMPLOYEE API RESPONSE:", result);

      if (!response.ok) {
        setError(result.message || "Failed to load employees.");
        return;
      }

      setEmployees(result.employees ?? []);
    } catch (error) {
      console.error("Load employees error:", error);

      setError("Something went wrong while loading employees.");
    } finally {
      setLoading(false);
    }
  }
  async function toggleEmployeeStatus(
    employeeId: string,
    currentStatus: boolean,
  ) {
    try {
      setActionLoading(employeeId);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/admin/employees/${employeeId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      const text = await response.text();

      let result;

      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        result = {
          success: false,
          message: "Server returned an invalid response.",
        };
      }

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to update employee.");
        return;
      }

      setEmployees((current) =>
        current.map((employee) =>
          employee.id === employeeId
            ? {
                ...employee,
                is_active: result.employee.is_active,
              }
            : employee,
        ),
      );
    } catch (error) {
      console.error("Toggle employee status error:", error);

      alert("Something went wrong. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadEmployees();
  }, []);

  // =====================================================
  // CREATE EMPLOYEE
  // =====================================================

  async function handleCreateEmployee(e: FormEvent) {
    e.preventDefault();

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanName) {
        setCreateError("Full name is required.");
        return;
      }

      if (!cleanEmail) {
        setCreateError("Email address is required.");
        return;
      }

      if (password.length < 6) {
        setCreateError("Password must be at least 6 characters.");
        return;
      }

      // -----------------------------------------------
      // GET CURRENT SESSION
      // -----------------------------------------------

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      // -----------------------------------------------
      // CREATE EMPLOYEE
      // -----------------------------------------------

      const response = await fetch("/api/admin/employees/create", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          full_name: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to create employee.");
      }

      // -----------------------------------------------
      // SUCCESS
      // -----------------------------------------------

      setCreateSuccess("Employee created successfully!");

      setName("");
      setEmail("");
      setPassword("");

      // Refresh employee list
      await loadEmployees();

      // Close modal after short delay
      setTimeout(() => {
        setShowAddModal(false);
        setCreateSuccess("");
      }, 1200);
    } catch (err) {
      console.error(err);

      setCreateError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setCreating(false);
    }
  }

  // =====================================================
  // TOGGLE EMPLOYEE STATUS
  // =====================================================

  async function toggleEmployee(employee: Employee) {
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

      // IMPORTANT:
      // [id] route এ request যাবে
      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: "PATCH",

        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          is_active: !employee.is_active,
        }),
      });

      const text = await response.text();

      let result: {
        success?: boolean;
        message?: string;
        employee?: Employee;
      } = {};

      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          console.error("Invalid API response:", text);

          throw new Error("Server returned an invalid response.");
        }
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || `Request failed with status ${response.status}`,
        );
      }

      // Update UI
      setEmployees((currentEmployees) =>
        currentEmployees.map((item) =>
          item.id === employee.id
            ? {
                ...item,
                is_active: result.employee?.is_active ?? !item.is_active,
              }
            : item,
        ),
      );
    } catch (error) {
      console.error("Toggle employee error:", error);

      setError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =====================================================
  // SEARCH FILTER
  // =====================================================

  const filteredEmployees = employees.filter((employee) => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return true;
    }

    return employee.full_name?.toLowerCase().includes(query) ?? false;
  });

  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    await supabase.auth.signOut();

    router.push("/login");
  }

  // =====================================================
  // OPEN ADD MODAL
  // =====================================================

  function openAddModal() {
    setName("");
    setEmail("");
    setPassword("");

    setCreateError("");
    setCreateSuccess("");

    setShowAddModal(true);
  }

  // =====================================================
  // CLOSE ADD MODAL
  // =====================================================

  function closeAddModal() {
    if (creating) {
      return;
    }

    setShowAddModal(false);

    setCreateError("");
    setCreateSuccess("");

    setName("");
    setEmail("");
    setPassword("");
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          {/* BRAND */}

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              F10S Attendance
            </h1>

            <p className="text-sm text-slate-500">Admin Panel</p>
          </div>

          {/* HEADER ACTIONS */}

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Attendance
            </button>

            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
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
        {/* =================================================
            PAGE TITLE
        ================================================= */}

        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Management</p>

            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Employees
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Manage F10S employees and account status.
            </p>
          </div>

          {/* ADD EMPLOYEE */}

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-xl"
          >
            <span className="mr-2 text-lg">+</span>
            Add Employee
          </button>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* =================================================
            SEARCH
        ================================================= */}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-md">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Search Employee
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />

                    <path d="m20 20-4-4" />
                  </svg>
                </div>

                <input
                  type="text"
                  placeholder="Search by employee name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            {/* TOTAL */}

            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-400">
                Total Employees
              </p>

              <p className="mt-1 text-xl font-bold text-slate-800">
                {employees.length}
              </p>
            </div>
          </div>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* TABLE HEADER */}

          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-lg font-bold text-slate-900">Employee List</h3>

            <p className="mt-1 text-sm text-slate-500">
              Showing {filteredEmployees.length} of {employees.length} employees
            </p>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

              <p className="mt-4 text-sm text-slate-400">
                Loading employees...
              </p>
            </div>
          ) : (
            /* TABLE */

            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px]">
                {/* HEAD */}

                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Employee
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
                      <td colSpan={5} className="px-6 py-16 text-center">
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
                            {/* AVATAR */}

                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white shadow-sm">
                              {(employee.full_name || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            {/* NAME */}

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
                                employee.is_active
                                  ? "bg-green-500"
                                  : "bg-red-500"
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
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* =================================================
          ADD EMPLOYEE MODAL
      ================================================= */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* MODAL HEADER */}

            <div className="border-b border-slate-100 px-7 py-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">
                    👤
                  </div>

                  <h3 className="mt-4 text-2xl font-bold text-slate-900">
                    Add Employee
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Create a new employee account.
                  </p>
                </div>

                {/* CLOSE */}

                <button
                  type="button"
                  disabled={creating}
                  onClick={closeAddModal}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* MODAL BODY */}

            <div className="px-7 py-6">
              {/* SUCCESS */}

              {createSuccess && (
                <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-sm text-green-600">
                    ✓
                  </div>

                  <p className="text-sm font-semibold text-green-700">
                    {createSuccess}
                  </p>
                </div>
              )}

              {/* ERROR */}

              {createError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-600">
                    !
                  </div>

                  <p className="text-sm leading-5 text-red-700">
                    {createError}
                  </p>
                </div>
              )}

              {/* FORM */}

              <form onSubmit={handleCreateEmployee} className="space-y-5">
                {/* FULL NAME */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Full Name
                  </label>

                  <input
                    type="text"
                    required
                    disabled={creating}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahim Ahmed"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {/* EMAIL */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email Address
                  </label>

                  <input
                    type="email"
                    required
                    disabled={creating}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rahim@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {/* PASSWORD */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Temporary Password
                  </label>

                  <input
                    type="password"
                    required
                    minLength={6}
                    disabled={creating}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Give this temporary password to the employee.
                  </p>
                </div>

                {/* ROLE */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Role
                  </label>

                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm">
                      👤
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Employee
                      </p>

                      <p className="text-xs text-slate-400">
                        Standard attendance access
                      </p>
                    </div>
                  </div>
                </div>

                {/* BUTTONS */}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={closeAddModal}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={creating}
                    className="flex flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? (
                      <>
                        <svg
                          className="mr-2 h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="opacity-25"
                          />

                          <path
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            className="opacity-75"
                          />
                        </svg>
                        Creating...
                      </>
                    ) : (
                      "Create Employee"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
