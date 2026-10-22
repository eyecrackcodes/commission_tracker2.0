import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const { userId: authenticatedUserId } = auth();

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { userId, role } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Only admins can create profiles for other users
    if (userId !== authenticatedUserId) {
      const { data: adminProfile } = await supabase
        .from("agent_profiles")
        .select("role")
        .eq("user_id", authenticatedUserId)
        .single();

      if (!adminProfile || adminProfile.role !== "admin") {
        return NextResponse.json(
          { error: "Forbidden - cannot create profile for another user" },
          { status: 403 }
        );
      }
    }

    // Validate role if provided (only admins can set roles)
    if (role && role !== "agent") {
      const { data: adminProfile } = await supabase
        .from("agent_profiles")
        .select("role")
        .eq("user_id", authenticatedUserId)
        .single();

      if (!adminProfile || adminProfile.role !== "admin") {
        return NextResponse.json(
          { error: "Forbidden - only admins can assign roles" },
          { status: 403 }
        );
      }
    }

    const { data: existingProfile, error: fetchError } = await supabase
      .from("agent_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error checking for existing profile:", fetchError);
      return NextResponse.json(
        { error: "Failed to check for existing profile" },
        { status: 500 }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        { message: "Agent profile already exists", profile: existingProfile },
        { status: 200 }
      );
    }

    let firstName: string | null = null;
    let lastName: string | null = null;
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      firstName = clerkUser.firstName || null;
      lastName = clerkUser.lastName || null;
    } catch (err) {
      console.error("Could not fetch Clerk user name:", err);
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: newProfile, error: createError } = await supabase
      .from("agent_profiles")
      .insert([
        {
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          start_date: today,
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error("Error creating agent profile:", createError);
      return NextResponse.json(
        { error: "Failed to create agent profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Agent profile created successfully", profile: newProfile },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
