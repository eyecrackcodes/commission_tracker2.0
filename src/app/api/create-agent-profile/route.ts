import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key for admin access
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

    // Check if agent profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from("agent_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is fine
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

    // Create new agent profile with today's date
    const today = new Date().toISOString().split("T")[0];
    const { data: newProfile, error: createError } = await supabase
      .from("agent_profiles")
      .insert([
        {
          user_id: userId,
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
