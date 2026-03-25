import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
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
