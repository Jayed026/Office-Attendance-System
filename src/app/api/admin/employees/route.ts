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
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing"
  );
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
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
  }
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
    }
  );
}

// =====================================================
// VERIFY ADMIN
// =====================================================

async function verifyAdmin(
  request: NextRequest
) {
  try {
    const authHeader =
      request.headers.get("authorization");

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      console.log(
        "No authorization header"
      );

      return null;
    }

    const token =
      authHeader.substring(7);

    if (!token) {
      return null;
    }

    // -----------------------------------------------
    // VERIFY AUTH USER
    // -----------------------------------------------

    const authSupabase =
      createAuthClient(token);

    const {
      data: { user },
      error: userError,
    } =
      await authSupabase.auth.getUser();

    if (userError) {
      console.error(
        "User verification error:",
        userError
      );

      return null;
    }

    if (!user) {
      console.log(
        "No authenticated user"
      );

      return null;
    }

    // -----------------------------------------------
    // GET PROFILE USING SERVICE ROLE
    // -----------------------------------------------

    const {
      data: profile,
      error: profileError,
    } =
      await adminSupabase
        .from("profiles")
        .select(
          "id, full_name, role, is_active"
        )
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error(
        "Profile verification error:",
        profileError
      );

      return null;
    }

    if (!profile) {
      console.log(
        "Profile not found:",
        user.id
      );

      return null;
    }

    // -----------------------------------------------
    // ADMIN CHECK
    // -----------------------------------------------

    if (profile.role !== "admin") {
      console.log(
        "User is not admin:",
        profile.role
      );

      return null;
    }

    // -----------------------------------------------
    // ACTIVE CHECK
    // -----------------------------------------------

    if (profile.is_active === false) {
      console.log(
        "Admin account is inactive"
      );

      return null;
    }

    return user;
  } catch (error) {
    console.error(
      "verifyAdmin ERROR:",
      error
    );

    return null;
  }
}

// =====================================================
// GET EMPLOYEES
// =====================================================

export async function GET(
  request: NextRequest
) {
  try {
    console.log(
      "GET /api/admin/employees"
    );

    // -----------------------------------------------
    // VERIFY ADMIN
    // -----------------------------------------------

    const adminUser =
      await verifyAdmin(request);

    if (!adminUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin access required.",
        },
        {
          status: 403,
        }
      );
    }

    // -----------------------------------------------
    // GET PROFILES
    // -----------------------------------------------

    const {
      data: profiles,
      error: profilesError,
    } =
      await adminSupabase
        .from("profiles")
        .select(
          "id, full_name, role, is_active, created_at"
        )
        .order("created_at", {
          ascending: false,
        });

    if (profilesError) {
      console.error(
        "Profiles fetch error:",
        profilesError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            profilesError.message,
        },
        {
          status: 500,
        }
      );
    }

    // -----------------------------------------------
    // GET AUTH USERS
    // -----------------------------------------------

    const {
      data: authData,
      error: authError,
    } =
      await adminSupabase.auth.admin.listUsers(
        {
          page: 1,
          perPage: 1000,
        }
      );

    if (authError) {
      console.error(
        "Auth users fetch error:",
        authError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            authError.message,
        },
        {
          status: 500,
        }
      );
    }

    // -----------------------------------------------
    // EMAIL MAP
    // -----------------------------------------------

    const emailMap =
      new Map<string, string>();

    for (const user of authData.users) {
      if (user.email) {
        emailMap.set(
          user.id,
          user.email
        );
      }
    }

    // -----------------------------------------------
    // COMBINE DATA
    // -----------------------------------------------

    const employees =
      (profiles ?? []).map(
        (profile) => ({
          id: profile.id,

          full_name:
            profile.full_name ??
            "Unnamed Employee",

          email:
            emailMap.get(
              profile.id
            ) ?? "",

          role: profile.role,

          is_active:
            profile.is_active ??
            true,

          created_at:
            profile.created_at,
        })
      );

    // -----------------------------------------------
    // SUCCESS
    // -----------------------------------------------

    return NextResponse.json({
      success: true,
      employees,
    });
  } catch (error) {
    console.error(
      "GET employees ERROR:",
      error
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
      }
    );
  }
}

// =====================================================
// POST - CREATE EMPLOYEE
// =====================================================

export async function POST(
  request: NextRequest
) {
  try {
    console.log(
      "POST /api/admin/employees"
    );

    // -----------------------------------------------
    // VERIFY ADMIN
    // -----------------------------------------------

    const adminUser =
      await verifyAdmin(request);

    if (!adminUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin access required.",
        },
        {
          status: 403,
        }
      );
    }

    // -----------------------------------------------
    // READ REQUEST BODY
    // -----------------------------------------------

    const body =
      await request.json();

    const {
      full_name,
      email,
      password,
    } = body;

    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (
      !full_name ||
      typeof full_name !== "string" ||
      !full_name.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Full name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !email ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !password ||
      typeof password !== "string" ||
      password.length < 6
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must be at least 6 characters.",
        },
        {
          status: 400,
        }
      );
    }

    const cleanName =
      full_name.trim();

    const cleanEmail =
      email.trim().toLowerCase();

    // -----------------------------------------------
    // CREATE SUPABASE AUTH USER
    // -----------------------------------------------

    const {
      data: authData,
      error: authCreateError,
    } =
      await adminSupabase.auth.admin.createUser(
        {
          email: cleanEmail,
          password,
          email_confirm: true,

          user_metadata: {
            full_name: cleanName,
          },
        }
      );

    if (authCreateError) {
      console.error(
        "Auth user creation error:",
        authCreateError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            authCreateError.message,
        },
        {
          status: 400,
        }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User creation failed.",
        },
        {
          status: 500,
        }
      );
    }

    const userId =
      authData.user.id;

    // -----------------------------------------------
    // CREATE PROFILE
    // -----------------------------------------------

    const {
      data: profile,
      error: profileError,
    } =
      await adminSupabase
        .from("profiles")
        .insert({
          id: userId,
          full_name: cleanName,
          role: "employee",
          is_active: true,
        })
        .select(
          "id, full_name, role, is_active, created_at"
        )
        .single();

    // -----------------------------------------------
    // ROLLBACK AUTH USER IF PROFILE FAILS
    // -----------------------------------------------

    if (profileError) {
      console.error(
        "Profile creation error:",
        profileError
      );

      await adminSupabase.auth.admin.deleteUser(
        userId
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Employee profile could not be created.",
        },
        {
          status: 500,
        }
      );
    }

    // -----------------------------------------------
    // SUCCESS
    // -----------------------------------------------

    return NextResponse.json(
      {
        success: true,
        message:
          "Employee created successfully.",

        employee: {
          id: profile.id,
          full_name:
            profile.full_name,
          email: cleanEmail,
          role: profile.role,
          is_active:
            profile.is_active,
          created_at:
            profile.created_at,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST employees ERROR:",
      error
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
      }
    );
  }
}