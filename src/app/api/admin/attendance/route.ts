import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function getBangladeshDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // ---------------------------------------------
    // VERIFY USER
    // ---------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid session",
        },
        { status: 401 },
      );
    }

    // ---------------------------------------------
    // CHECK ADMIN
    // ---------------------------------------------

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Admin access required.",
        },
        { status: 403 },
      );
    }

    // ---------------------------------------------
    // DATE
    // ---------------------------------------------

    const { searchParams } = new URL(request.url);

    const requestedDate = searchParams.get("date");

    const date = requestedDate || getBangladeshDate();

    // ---------------------------------------------
    // GET ATTENDANCE
    // ---------------------------------------------

    const { data: attendance, error: attendanceError } = await supabase
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
      .eq("attendance_date", date)
      .order("check_in", {
        ascending: true,
        nullsFirst: false,
      });

    if (attendanceError) {
      return NextResponse.json(
        {
          success: false,
          message: attendanceError.message,
        },
        { status: 500 },
      );
    }

    // ---------------------------------------------
    // GET ALL EMPLOYEES
    // ---------------------------------------------

    const { data: employees, error: employeeError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("role", "employee")
      .order("full_name", {
        ascending: true,
      });

    if (employeeError) {
      return NextResponse.json(
        {
          success: false,
          message: employeeError.message,
        },
        { status: 500 },
      );
    }

    // ---------------------------------------------
    // MERGE EMPLOYEES + ATTENDANCE
    // ---------------------------------------------

    const attendanceMap = new Map(
      (attendance ?? []).map((item) => [item.employee_id, item]),
    );

    const records = (employees ?? []).map((employee) => {
      const record = attendanceMap.get(employee.id);

      return {
        employee_id: employee.id,
        full_name: employee.full_name || "Unnamed Employee",

        attendance: record ?? null,
      };
    });

    // ---------------------------------------------
    // SUMMARY
    // ---------------------------------------------

    const totalEmployees = employees?.length ?? 0;

    const present = records.filter((item) => item.attendance?.check_in).length;

    const checkedOut = records.filter(
      (item) => item.attendance?.check_out,
    ).length;

    const currentlyWorking = records.filter(
      (item) => item.attendance?.check_in && !item.attendance?.check_out,
    ).length;

    const missing = totalEmployees - present;

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
    console.error("Admin Attendance API Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
      },
      { status: 500 },
    );
  }
}
