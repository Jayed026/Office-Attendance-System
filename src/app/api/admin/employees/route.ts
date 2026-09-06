import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// =====================================================
// ENV
// =====================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// =====================================================
// CHECK ENV
// =====================================================

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
}

if (!supabasePublishableKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

// =====================================================
// ADMIN / SERVICE ROLE CLIENT
// =====================================================

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// =====================================================
// USER AUTH CLIENT
// =====================================================

function createAuthClient(token: string) {
  return createClient(supabaseUrl!, supabasePublishableKey!, {
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
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("No authorization header");

      return null;
    }

    const token = authHeader.substring(7);

    if (!token) {
      return null;
    }

    // Verify logged-in user
    const authSupabase = createAuthClient(token);

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError) {
      console.error("User verification error:", userError);

      return null;
    }

    if (!user) {
      console.log("No authenticated user");

      return null;
    }

    console.log("Authenticated user:", user.email);

    // Get user's profile using service role
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile verification error:", profileError);

      return null;
    }

    if (!profile) {
      console.log("Profile not found for user:", user.id);

      return null;
    }

    console.log("User profile:", profile);

    // Check admin role
    if (profile.role !== "admin") {
      console.log("User is not admin:", profile.role);

      return null;
    }

    // Check active status
    if (profile.is_active === false) {
      console.log("Admin account is inactive");

      return null;
    }

    return user;
  } catch (error) {
    console.error("verifyAdmin ERROR:", error);

    return null;
  }
}

// =====================================================
// GET EMPLOYEES
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/admin/employees");

    // -----------------------------------------------
    // VERIFY ADMIN
    // -----------------------------------------------

    const adminUser = await verifyAdmin(request);

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

    // -----------------------------------------------
    // GET PROFILES
    // -----------------------------------------------

    const { data: profiles, error: profilesError } = await adminSupabase
      .from("profiles")
      .select("id, full_name, role, is_active, created_at")
      .order("created_at", {
        ascending: false,
      });

    if (profilesError) {
      console.error("Profiles fetch error:", profilesError);

      return NextResponse.json(
        {
          success: false,
          message: profilesError.message,
        },
        {
          status: 500,
        },
      );
    }

    // -----------------------------------------------
    // GET AUTH USERS
    // -----------------------------------------------

    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authError) {
      console.error("Auth users fetch error:", authError);

      return NextResponse.json(
        {
          success: false,
          message: authError.message,
        },
        {
          status: 500,
        },
      );
    }

    // -----------------------------------------------
    // CREATE EMAIL MAP
    // -----------------------------------------------

    const emailMap = new Map<string, string>();

    for (const user of authData.users) {
      if (user.email) {
        emailMap.set(user.id, user.email);
      }
    }

    // -----------------------------------------------
    // COMBINE PROFILE + EMAIL
    // -----------------------------------------------

    const employees = (profiles ?? []).map((profile) => ({
      id: profile.id,

      full_name: profile.full_name ?? "Unnamed Employee",

      email: emailMap.get(profile.id) ?? "",

      role: profile.role,

      is_active: profile.is_active ?? true,

      created_at: profile.created_at,
    }));

    // -----------------------------------------------
    // SUCCESS
    // -----------------------------------------------

    return NextResponse.json({
      success: true,
      employees,
    });
  } catch (error) {
    console.error("GET employees ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      },
    );
  }
}
