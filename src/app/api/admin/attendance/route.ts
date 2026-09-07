import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// =====================================================
// ENV
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// =====================================================
// CHECK ENV
// =====================================================

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
}

if (!supabasePublishableKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is missing",
  );
}

// =====================================================
// ADMIN / SERVICE ROLE CLIENT
// =====================================================

const adminSupabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

// =====================================================
// USER AUTH CLIENT
// =====================================================

function createAuthClient(token: string) {
  return createClient(
    supabaseUrl!,
    supabasePublishableKey!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  );
}

// =====================================================
// BANGLADESH DATE
// =====================================================

function getBangladeshDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// =====================================================
// VERIFY ADMIN
// =====================================================

async function verifyAdmin(
  request: NextRequest,
) {
  try {
    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      console.log(
        "Attendance API: No authorization header",
      );

      return null;
    }

    const token = authHeader.substring(7);

    if (!token) {
      return null;
    }

    // -------------------------------------------------
    // VERIFY SUPABASE USER
    // -------------------------------------------------

    const authSupabase =
      createAuthClient(token);

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "Attendance API user verification error:",
        userError,
      );

      return null;
    }

    console.log(
      "Authenticated admin candidate:",
      user.email,
    );

    // -------------------------------------------------
    // GET PROFILE USING SERVICE ROLE
    // -------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await adminSupabase
      .from("profiles")
      .select(
        "id, full_name, role, is_active",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Attendance API profile error:",
        profileError,
      );

      return null;
    }

    if (!profile) {
      console.error(
        "Admin profile not found:",
        user.id,
      );

      return null;
    }

    console.log(
      "Admin profile:",
      profile,
    );

    // -------------------------------------------------
    // CHECK ROLE
    // -------------------------------------------------

    if (profile.role !== "admin") {
      console.error(
        "User is not admin:",
        profile.role,
      );

      return null;
    }

    // -------------------------------------------------
    // CHECK ACTIVE
    // -------------------------------------------------

    if (profile.is_active === false) {
      console.error(
        "Admin account is inactive",
      );

      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "verifyAdmin attendance error:",
      error,
    );

    return null;
  }
}

// =====================================================
// GET ADMIN ATTENDANCE
// =====================================================

export async function GET(
  request: NextRequest,
) {
  try {
    console.log(
      "GET /api/admin/attendance",
    );

    // =================================================
    // VERIFY ADMIN
    // =================================================

    const adminUser =
      await verifyAdmin(request);

    if (!adminUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Admin access required.",
        },
        {
          status: 403,
        },
      );
    }

    // =================================================
    // DATE
    // =================================================

    const { searchParams } =
      new URL(request.url);

    const requestedDate =
      searchParams.get("date");

    const date =
      requestedDate ||
      getBangladeshDate();

    console.log(
      "Attendance date:",
      date,
    );

    // =================================================
    // GET ATTENDANCE
    // =================================================

    const {
      data: attendance,
      error: attendanceError,
    } = await adminSupabase
      .from("attendance")
      .select(
        `
        id,
        employee_id,
        attendance_date,
        check_in,
        check_out,
        status,
        check_in_lat,
        check_in_lng,
        check_out_lat,
        check_out_lng
        `,
      )
      .eq(
        "attendance_date",
        date,
      )
      .order("check_in", {
        ascending: true,
        nullsFirst: false,
      });

    if (attendanceError) {
      console.error(
        "Attendance fetch error:",
        attendanceError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            attendanceError.message,
        },
        {
          status: 500,
        },
      );
    }

    console.log(
      "Attendance rows:",
      attendance?.length ?? 0,
    );

    // =================================================
    // GET EMPLOYEES
    // =================================================

    const {
      data: employees,
      error: employeeError,
    } = await adminSupabase
      .from("profiles")
      .select(
        "id, full_name, role, is_active",
      )
      .eq(
        "role",
        "employee",
      )
      .order(
        "full_name",
        {
          ascending: true,
        },
      );

    if (employeeError) {
      console.error(
        "Employee fetch error:",
        employeeError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            employeeError.message,
        },
        {
          status: 500,
        },
      );
    }

    console.log(
      "Employee rows:",
      employees?.length ?? 0,
    );

    // =================================================
    // CREATE ATTENDANCE MAP
    // =================================================

    const attendanceMap = new Map(
      (attendance ?? []).map(
        (item) => [
          item.employee_id,
          item,
        ],
      ),
    );

    // =================================================
    // MERGE EMPLOYEES + ATTENDANCE
    // =================================================

    const records =
      (employees ?? []).map(
        (employee) => {
          const record =
            attendanceMap.get(
              employee.id,
            ) ?? null;

          return {
            employee_id:
              employee.id,

            full_name:
              employee.full_name ||
              "Unnamed Employee",

            is_active:
              employee.is_active ??
              true,

            attendance:
              record,
          };
        },
      );

    // =================================================
    // SUMMARY
    // =================================================

    const totalEmployees =
      employees?.length ?? 0;

    const present =
      records.filter(
        (item) =>
          Boolean(
            item.attendance?.check_in,
          ),
      ).length;

    const checkedOut =
      records.filter(
        (item) =>
          Boolean(
            item.attendance?.check_out,
          ),
      ).length;

    const currentlyWorking =
      records.filter(
        (item) =>
          Boolean(
            item.attendance?.check_in,
          ) &&
          !item.attendance
            ?.check_out,
      ).length;

    const missing =
      totalEmployees - present;

    // =================================================
    // DEBUG
    // =================================================

    console.log(
      "Attendance summary:",
      {
        date,
        totalEmployees,
        present,
        checkedOut,
        currentlyWorking,
        missing,
      },
    );

    // =================================================
    // RESPONSE
    // =================================================

    return NextResponse.json({
      success: true,

      date,

      summary: {
        totalEmployees,
        present,
        checkedOut,
        currentlyWorking,
        missing,
      },

      records,
    });
  } catch (error) {
    console.error(
      "Admin Attendance API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      },
    );
  }
}