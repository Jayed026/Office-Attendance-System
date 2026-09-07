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

// =====================================================
// VERIFY ADMIN
// =====================================================

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
// PATCH
// ACTIVATE / DEACTIVATE EMPLOYEE
// =====================================================

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // ---------------------------------------------------
    // VERIFY ADMIN
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // GET EMPLOYEE ID
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // REQUEST BODY
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // PREVENT ADMIN SELF DEACTIVATION
    // ---------------------------------------------------

    if (id === adminUser.id) {
      return NextResponse.json(
        {
          success: false,
          message: "You cannot deactivate your own admin account.",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------
    // UPDATE EMPLOYEE
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // SUCCESS
    // ---------------------------------------------------

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
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 },
    );
  }
}

// =====================================================
// DELETE
// DELETE EMPLOYEE ACCOUNT
// =====================================================

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    // ---------------------------------------------------
    // VERIFY ADMIN
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // GET EMPLOYEE ID
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // PREVENT SELF DELETE
    // ---------------------------------------------------

    if (id === adminUser.id) {
      return NextResponse.json(
        {
          success: false,
          message: "You cannot delete your own admin account.",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------
    // FIND EMPLOYEE
    // ---------------------------------------------------

    const { data: employee, error: employeeError } = await adminSupabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", id)
      .maybeSingle();

    if (employeeError) {
      console.error("Find employee error:", employeeError);

      return NextResponse.json(
        {
          success: false,
          message: employeeError.message,
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

    // ---------------------------------------------------
    // ONLY EMPLOYEE ACCOUNT CAN BE DELETED
    // ---------------------------------------------------

    if (employee.role !== "employee") {
      return NextResponse.json(
        {
          success: false,
          message: "Only employee accounts can be deleted.",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------
    // DELETE ATTENDANCE RECORDS
    // ---------------------------------------------------

    const { error: attendanceDeleteError } = await adminSupabase
      .from("attendance")
      .delete()
      .eq("employee_id", id);

    if (attendanceDeleteError) {
      console.error(
        "Delete employee attendance error:",
        attendanceDeleteError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Could not delete employee attendance records. " +
            attendanceDeleteError.message,
        },
        { status: 500 },
      );
    }

    // ---------------------------------------------------
    // DELETE PROFILE
    // ---------------------------------------------------

    const { error: profileDeleteError } = await adminSupabase
      .from("profiles")
      .delete()
      .eq("id", id)
      .eq("role", "employee");

    if (profileDeleteError) {
      console.error("Delete employee profile error:", profileDeleteError);

      return NextResponse.json(
        {
          success: false,
          message:
            "Could not delete employee profile. " +
            profileDeleteError.message,
        },
        { status: 500 },
      );
    }

    // ---------------------------------------------------
    // DELETE SUPABASE AUTH ACCOUNT
    // ---------------------------------------------------

    const { error: authDeleteError } =
      await adminSupabase.auth.admin.deleteUser(id);

    if (authDeleteError) {
      console.error("Delete auth user error:", authDeleteError);

      return NextResponse.json(
        {
          success: false,
          message:
            "Profile was deleted, but authentication account could not be deleted. " +
            authDeleteError.message,
        },
        { status: 500 },
      );
    }

    // ---------------------------------------------------
    // SUCCESS
    // ---------------------------------------------------

    return NextResponse.json({
      success: true,
      message: `${employee.full_name || "Employee"} account deleted successfully.`,
    });
  } catch (error) {
    console.error("Employee DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 },
    );
  }
}