import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// =====================================================
// ADMIN SUPABASE CLIENT
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

  const token = authHeader.replace("Bearer ", "");

  const supabase = createAuthClient(token);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // -----------------------------------------------
  // Check profile role
  // -----------------------------------------------

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.is_active === false
  ) {
    return null;
  }

  return user;
}

// =====================================================
// GET EMPLOYEES
// =====================================================

export async function GET(request: NextRequest) {
  try {
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
        { status: 403 },
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
          message: "Failed to load employee profiles.",
        },
        { status: 500 },
      );
    }

    // -----------------------------------------------
    // GET AUTH USERS
    // -----------------------------------------------

    const { data: authUsers, error: authUsersError } =
      await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authUsersError) {
      console.error("Auth users fetch error:", authUsersError);

      return NextResponse.json(
        {
          success: false,
          message: "Failed to load authentication users.",
        },
        { status: 500 },
      );
    }

    // -----------------------------------------------
    // CREATE EMAIL MAP
    // -----------------------------------------------

    const emailMap = new Map<string, string>();

    authUsers.users.forEach((user) => {
      if (user.email) {
        emailMap.set(user.id, user.email);
      }
    });

    // -----------------------------------------------
    // COMBINE PROFILE + AUTH DATA
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
    console.error("GET employees error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
      },
      { status: 500 },
    );
  }
}

// =====================================================
// PATCH EMPLOYEE
// Activate / Deactivate
// =====================================================

export async function PATCH(request: NextRequest) {
  try {
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
        { status: 403 },
      );
    }

    // -----------------------------------------------
    // REQUEST DATA
    // -----------------------------------------------

    const body = await request.json();

    const { id, is_active } = body;

    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee ID is required.",
        },
        { status: 400 },
      );
    }

    if (typeof is_active !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "is_active must be true or false.",
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------
    // GET TARGET EMPLOYEE
    // -----------------------------------------------

    const { data: employee, error: employeeError } = await adminSupabase
      .from("profiles")
      .select("id, full_name, role, is_active, created_at")
      .eq("id", id)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee not found.",
        },
        { status: 404 },
      );
    }

    // -----------------------------------------------
    // PREVENT ADMIN DEACTIVATION
    // -----------------------------------------------

    if (employee.role === "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Admin accounts cannot be deactivated from this page.",
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------
    // UPDATE PROFILE
    // -----------------------------------------------

    const { data: updatedEmployee, error: updateError } = await adminSupabase
      .from("profiles")
      .update({
        is_active,
      })
      .eq("id", id)
      .select("id, full_name, role, is_active, created_at")
      .single();

    if (updateError || !updatedEmployee) {
      console.error("Employee update error:", updateError);

      return NextResponse.json(
        {
          success: false,
          message: "Failed to update employee.",
        },
        { status: 500 },
      );
    }

    // -----------------------------------------------
    // GET EMAIL
    // -----------------------------------------------

    const { data: authUser } = await adminSupabase.auth.admin.getUserById(id);

    // -----------------------------------------------
    // SUCCESS
    // -----------------------------------------------

    return NextResponse.json({
      success: true,

      message: is_active
        ? "Employee activated successfully."
        : "Employee deactivated successfully.",

      employee: {
        id: updatedEmployee.id,

        full_name: updatedEmployee.full_name,

        email: authUser.user?.email ?? "",

        role: updatedEmployee.role,

        is_active: updatedEmployee.is_active,

        created_at: updatedEmployee.created_at,
      },
    });
  } catch (error) {
    console.error("PATCH employee error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
      },
      { status: 500 },
    );
  }
}

// =====================================================
// POST — CREATE EMPLOYEE
// =====================================================

export async function POST(request: NextRequest) {
  try {
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
        { status: 403 },
      );
    }

    // -----------------------------------------------
    // READ DATA
    // -----------------------------------------------

    const body = await request.json();

    const { full_name, email, password } = body;

    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (!full_name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Full name is required.",
        },
        { status: 400 },
      );
    }

    if (!email?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Email is required.",
        },
        { status: 400 },
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 6 characters.",
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------
    // CREATE AUTH USER
    // -----------------------------------------------

    const { data: createdUser, error: createError } =
      await adminSupabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),

        password,

        email_confirm: true,

        user_metadata: {
          full_name: full_name.trim(),
        },
      });

    if (createError) {
      return NextResponse.json(
        {
          success: false,
          message: createError.message,
        },
        { status: 400 },
      );
    }

    if (!createdUser.user) {
      return NextResponse.json(
        {
          success: false,
          message: "User creation failed.",
        },
        { status: 500 },
      );
    }

    // -----------------------------------------------
    // CREATE PROFILE
    // -----------------------------------------------

    const { error: profileError } = await adminSupabase
      .from("profiles")
      .upsert({
        id: createdUser.user.id,

        full_name: full_name.trim(),

        role: "employee",

        is_active: true,
      });

    if (profileError) {
      console.error("Profile creation error:", profileError);

      // Rollback Auth user
      await adminSupabase.auth.admin.deleteUser(createdUser.user.id);

      return NextResponse.json(
        {
          success: false,
          message: "Employee profile could not be created.",
        },
        { status: 500 },
      );
    }

    // -----------------------------------------------
    // SUCCESS
    // -----------------------------------------------

    return NextResponse.json({
      success: true,

      message: "Employee created successfully.",

      employee: {
        id: createdUser.user.id,

        full_name: full_name.trim(),

        email: email.trim().toLowerCase(),

        role: "employee",

        is_active: true,

        created_at: createdUser.user.created_at,
      },
    });
  } catch (error) {
    console.error("POST employee error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
      },
      { status: 500 },
    );
  }
}
