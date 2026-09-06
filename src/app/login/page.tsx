"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      // ============================================
      // LOGIN
      // ============================================

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      const user = data.user;

      if (!user) {
        setError("Login failed. Please try again.");
        return;
      }

      // ============================================
      // GET USER ROLE
      // ============================================

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();

        setError(
          "Your account profile was not found. Please contact the administrator.",
        );

        return;
      }

      // ============================================
      // ADMIN → ADMIN PANEL
      // EMPLOYEE → EMPLOYEE DASHBOARD
      // ============================================

      if (profile.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);

      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* ============================================
          BACKGROUND DECORATION
      ============================================ */}

      <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />

      {/* ============================================
          LOGIN CARD
      ============================================ */}

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Brand */}

        <div className="mb-7 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white shadow-xl shadow-blue-500/20">
            F
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">
            F10S Attendance
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Office Attendance Management System
          </p>
        </div>

        {/* Card */}

        <div className="rounded-3xl border border-white/10 bg-white p-7 shadow-2xl sm:p-9">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-900">
              Welcome back 👋
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Sign in to continue to your account
            </p>
          </div>

          {/* ========================================
              ERROR
          ======================================== */}

          {error && (
            <div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                !
              </div>

              <p className="text-sm leading-5 text-red-700">{error}</p>
            </div>
          )}

          {/* ========================================
              FORM
          ======================================== */}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* EMAIL */}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email Address
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />

                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </div>

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="4" y="10" width="16" height="11" rx="2" />

                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </div>

                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            {/* LOGIN BUTTON */}

            <button
              type="submit"
              disabled={loading}
              className="group relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition duration-200 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-600/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg
                    className="mr-2 h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />

                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <svg
                    className="ml-2 transition-transform group-hover:translate-x-1"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* ========================================
              SECURITY INFO
          ======================================== */}

          <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="4" y="10" width="16" height="11" rx="2" />

              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Secure employee authentication
          </div>
        </div>

        {/* FOOTER */}

        <p className="mt-6 text-center text-xs text-slate-500">
          F10S Attendance System
        </p>
      </div>
    </main>
  );
}
