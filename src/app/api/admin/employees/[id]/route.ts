import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function createAuthClient(token: string) {
  return createClient(supabaseUrl, supabasePublishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  const authSupabase = createAuthClient(token);

  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  if (profile.role !== "admin" || profile.is_active === false) {
    return null;
  }

  return user;
}

// =====================================================
// ACTIVATE / DEACTIVATE EMPLOYEE
// =====================================================

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // Verify admin
    const adminUser = await verifyAdmin(request);

    if (!adminUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin access required.",
        },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee ID is required.",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const is_active = body.is_active;

    if (typeof is_active !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "is_active must be true or false.",
        },
        { status: 400 },
      );
    }

    // Prevent admin from accidentally
    // deactivating their own account
    if (id === adminUser.id) {
      return NextResponse.json(
        {
          success: false,
          message: "You cannot deactivate your own admin account.",
        },
        { status: 400 },
      );
    }

    const { data: employee, error } = await adminSupabase
      .from("profiles")
      .update({
        is_active,
      })
      .eq("id", id)
      .eq("role", "employee")
      .select("id, full_name, role, is_active")
      .maybeSingle();

    if (error) {
      console.error("Employee status update error:", error);

      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 500 },
      );
    }

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: is_active
        ? "Employee activated successfully."
        : "Employee deactivated successfully.",
      employee,
    });
  } catch (error) {
    console.error("Employee PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error.",
      },
      { status: 500 },
    );
  }
}
