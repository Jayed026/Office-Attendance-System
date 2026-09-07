"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  is_active?: boolean;
};

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =====================================================
  // LOAD PROFILE
  // =====================================================

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        setEmail(user.email ?? "");

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role, is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw new Error(profileError.message);
        }

        if (!data) {
          throw new Error("Profile not found.");
        }

        setProfile(data);
        setName(data.full_name ?? "");
      } catch (err) {
        console.error("Load profile error:", err);

        setError(
          err instanceof Error ? err.message : "Failed to load profile.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [router]);

  // =====================================================
  // UPDATE NAME + EMAIL
  // =====================================================

  async function handleUpdateProfile() {
    setSavingProfile(true);
    setMessage("");
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const trimmedName = name.trim();
      const trimmedEmail = email.trim();

      if (!trimmedName) {
        throw new Error("Name cannot be empty.");
      }

      if (!trimmedEmail) {
        throw new Error("Email cannot be empty.");
      }

      // -----------------------------------------------
      // UPDATE PROFILE NAME
      // -----------------------------------------------

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
        })
        .eq("id", user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

      // -----------------------------------------------
      // UPDATE EMAIL IF CHANGED
      // -----------------------------------------------

      if (trimmedEmail !== (user.email ?? "")) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });

        if (emailError) {
          throw new Error(emailError.message);
        }

        setMessage(
          "Name updated. A confirmation email has been sent to your new email address.",
        );
      } else {
        setMessage("Profile updated successfully.");
      }

      setName(trimmedName);
      setEmail(trimmedEmail);

      setProfile((previous) =>
        previous
          ? {
              ...previous,
              full_name: trimmedName,
            }
          : previous,
      );
    } catch (err) {
      console.error("Update profile error:", err);

      setError(
        err instanceof Error ? err.message : "Failed to update profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  async function handleChangePassword() {
    setChangingPassword(true);
    setMessage("");
    setError("");

    try {
      if (!newPassword) {
        throw new Error("Please enter a new password.");
      }

      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) {
        throw new Error(passwordError.message);
      }

      setNewPassword("");
      setConfirmPassword("");

      setMessage("Password changed successfully.");
    } catch (err) {
      console.error("Change password error:", err);

      setError(
        err instanceof Error ? err.message : "Failed to change password.",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  // =====================================================
  // BACK
  // =====================================================

  function handleBack() {
    if (profile?.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
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
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-500">Loading profile...</p>
        </div>
      </main>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="min-h-screen bg-slate-100">
      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              F10S Attendance
            </h1>

            <p className="text-sm text-slate-500">Profile Settings</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              ← Back
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

      {/* CONTENT */}

      <section className="mx-auto max-w-5xl px-6 py-10">
        {/* TITLE */}

        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">Account</p>

          <h2 className="mt-1 text-3xl font-bold text-slate-900">
            Profile Settings
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Update your personal information and password.
          </p>
        </div>

        {/* MESSAGE */}

        {message && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">✅ {message}</p>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">❌ {error}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* =================================================
              PERSONAL INFORMATION
          ================================================= */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900">
                Personal Information
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Update your name and email address.
              </p>
            </div>

            {/* NAME */}

            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Full Name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* EMAIL */}

            <div className="mt-5">
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs text-slate-400">
                Changing email may require confirmation from your new email
                address.
              </p>
            </div>

            {/* ROLE */}

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Account Role
              </label>

              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold capitalize text-slate-700">
                  {profile?.role ?? "User"}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Account role cannot be changed from this page.
              </p>
            </div>

            {/* SAVE */}

            <button
              onClick={handleUpdateProfile}
              disabled={savingProfile}
              className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>

          {/* =================================================
              PASSWORD
          ================================================= */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900">
                Change Password
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Create a new password for your account.
              </p>
            </div>

            {/* NEW PASSWORD */}

            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                New Password
              </label>

              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs text-slate-400">
                Minimum 6 characters.
              </p>
            </div>

            {/* CONFIRM PASSWORD */}

            <div className="mt-5">
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Confirm New Password
              </label>

              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* CHANGE PASSWORD */}

            <button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {changingPassword ? "Changing Password..." : "Change Password"}
            </button>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-xs leading-5 text-slate-500">
                Your password is securely managed by Supabase Authentication.
                You do not need to enter your old password while you are logged
                in.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
