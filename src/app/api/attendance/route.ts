import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// =====================================================
// DISTANCE CALCULATION
// =====================================================

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

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
// POST
// =====================================================

export async function POST(request: NextRequest) {
  try {
    // -------------------------------------------------
    // GET AUTHORIZATION HEADER
    // -------------------------------------------------

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 },
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // -------------------------------------------------
    // CREATE SUPABASE CLIENT WITH USER TOKEN
    // -------------------------------------------------

    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // -------------------------------------------------
    // VERIFY USER
    // -------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired session.",
        },
        { status: 401 },
      );
    }

    // -------------------------------------------------
    // GET REQUEST BODY
    // -------------------------------------------------

    const body = await request.json();

    const action = body.action;

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    // -------------------------------------------------
    // VALIDATE ACTION
    // -------------------------------------------------

    if (action !== "check_in" && action !== "check_out") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid attendance action.",
        },
        { status: 400 },
      );
    }

    // -------------------------------------------------
    // VALIDATE GPS
    // -------------------------------------------------

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid GPS coordinates.",
        },
        { status: 400 },
      );
    }

    // -------------------------------------------------
    // GET OFFICE SETTINGS
    // -------------------------------------------------

    const { data: office, error: officeError } = await supabase
      .from("office_settings")
      .select("latitude, longitude, allowed_radius_meters")
      .limit(1)
      .single();

    if (officeError || !office) {
      return NextResponse.json(
        {
          success: false,
          message: "Office location is not configured.",
        },
        { status: 500 },
      );
    }

    // -------------------------------------------------
    // SERVER-SIDE DISTANCE CALCULATION
    // -------------------------------------------------

    const distance = calculateDistance(
      latitude,
      longitude,
      office.latitude,
      office.longitude,
    );

    const allowedRadius = office.allowed_radius_meters;

    // -------------------------------------------------
    // LOCATION CHECK
    // -------------------------------------------------

    if (distance > allowedRadius) {
      return NextResponse.json(
        {
          success: false,
          message: `You are outside the office area. Distance: ${Math.round(
            distance,
          )} meters.`,
          distance: Math.round(distance),
          allowedRadius,
        },
        { status: 403 },
      );
    }

    // -------------------------------------------------
    // BANGLADESH TODAY
    // -------------------------------------------------

    const today = getBangladeshDate();

    // =================================================
    // CHECK IN
    // =================================================

    if (action === "check_in") {
      // Check existing attendance
      const { data: existingAttendance, error: existingError } = await supabase
        .from("attendance")
        .select("id, check_in, check_out, status")
        .eq("employee_id", user.id)
        .eq("attendance_date", today)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json(
          {
            success: false,
            message: existingError.message,
          },
          { status: 500 },
        );
      }

      // Already checked in
      if (existingAttendance?.check_in) {
        return NextResponse.json(
          {
            success: false,
            message: "You have already checked in today.",
            attendance: existingAttendance,
          },
          { status: 409 },
        );
      }

      // -------------------------------------------------
      // INSERT ATTENDANCE
      // -------------------------------------------------

      const { data: attendance, error: insertError } = await supabase
        .from("attendance")
        .insert({
          employee_id: user.id,
          attendance_date: today,

          check_in: new Date().toISOString(),

          check_in_lat: latitude,
          check_in_lng: longitude,

          status: "present",
        })
        .select("id, attendance_date, check_in, check_out, status")
        .single();

      if (insertError) {
        return NextResponse.json(
          {
            success: false,
            message: insertError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        action: "check_in",
        message: `Check In successful! You are ${Math.round(
          distance,
        )}m from the office.`,
        distance: Math.round(distance),
        attendance,
      });
    }

    // =================================================
    // CHECK OUT
    // =================================================

    if (action === "check_out") {
      // Get today's attendance
      const { data: existingAttendance, error: existingError } = await supabase
        .from("attendance")
        .select("id, check_in, check_out, status")
        .eq("employee_id", user.id)
        .eq("attendance_date", today)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json(
          {
            success: false,
            message: existingError.message,
          },
          { status: 500 },
        );
      }

      // No check in
      if (!existingAttendance?.check_in) {
        return NextResponse.json(
          {
            success: false,
            message: "You must check in before checking out.",
          },
          { status: 400 },
        );
      }

      // Already checked out
      if (existingAttendance.check_out) {
        return NextResponse.json(
          {
            success: false,
            message: "You have already checked out today.",
          },
          { status: 409 },
        );
      }

      // -------------------------------------------------
      // UPDATE CHECK OUT
      // -------------------------------------------------

      const { data: attendance, error: updateError } = await supabase
        .from("attendance")
        .update({
          check_out: new Date().toISOString(),

          check_out_lat: latitude,
          check_out_lng: longitude,
        })
        .eq("id", existingAttendance.id)
        .eq("employee_id", user.id)
        .is("check_out", null)
        .select("id, attendance_date, check_in, check_out, status")
        .single();

      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            message: updateError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        action: "check_out",
        message: `Check Out successful! You are ${Math.round(
          distance,
        )}m from the office.`,
        distance: Math.round(distance),
        attendance,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Invalid request.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Attendance API Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
      },
      { status: 500 },
    );
  }
}
