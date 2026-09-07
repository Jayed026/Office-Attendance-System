import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function POST(
  request: NextRequest,
) {
  try {
    // =============================================
    // GET AUTHORIZATION
    // =============================================

    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const token =
      authHeader.substring(7);

    // =============================================
    // AUTH CLIENT
    // =============================================

    const supabase = createClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        global: {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        },
      },
    );

    // =============================================
    // VERIFY USER
    // =============================================

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid session.",
        },
        { status: 401 },
      );
    }

    // =============================================
    // READ BODY
    // =============================================

    const body =
      await request.json();

    const {
      currentPassword,
      newPassword,
    } = body;

    // =============================================
    // VALIDATION
    // =============================================

    if (
      !currentPassword ||
      !newPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Current password and new password are required.",
        },
        { status: 400 },
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message:
            "New password must be at least 6 characters.",
        },
        { status: 400 },
      );
    }

    if (
      currentPassword ===
      newPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "New password must be different from current password.",
        },
        { status: 400 },
      );
    }

    // =============================================
    // VERIFY CURRENT PASSWORD
    // =============================================

    if (!user.email) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User email not found.",
        },
        { status: 400 },
      );
    }

    const verifyClient =
      createClient(
        supabaseUrl,
        supabasePublishableKey,
      );

    const {
      error: loginError,
    } =
      await verifyClient.auth.signInWithPassword(
        {
          email: user.email,
          password:
            currentPassword,
        },
      );

    if (loginError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Current password is incorrect.",
        },
        { status: 400 },
      );
    }

    // =============================================
    // UPDATE PASSWORD
    // =============================================

    const {
      error: updateError,
    } =
      await supabase.auth.updateUser(
        {
          password:
            newPassword,
        },
      );

    if (updateError) {
      console.error(
        "Password update error:",
        updateError,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            updateError.message,
        },
        { status: 500 },
      );
    }

    // =============================================
    // SUCCESS
    // =============================================

    return NextResponse.json({
      success: true,
      message:
        "Password changed successfully.",
    });
  } catch (error) {
    console.error(
      "Change password error:",
      error,
    );

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