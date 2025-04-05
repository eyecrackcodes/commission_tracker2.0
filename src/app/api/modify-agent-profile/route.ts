import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const { userId, startDate } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { error: "Start date is required" },
        { status: 400 }
      );
    }

    // Check if agent profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from("agent_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      console.error("Error checking for existing profile:", fetchError);
      return NextResponse.json(
        { error: "Failed to check for existing profile" },
        { status: 500 }
      );
    }

    if (!existingProfile) {
      return NextResponse.json(
        { error: "Agent profile not found" },
        { status: 404 }
      );
    }

    // Update the agent profile with the new start date
    const { data: updatedProfile, error: updateError } = await supabase
      .from("agent_profiles")
      .update({ start_date: startDate })
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating agent profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update agent profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Agent profile updated successfully",
        profile: updatedProfile,
        startDate: startDate,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
