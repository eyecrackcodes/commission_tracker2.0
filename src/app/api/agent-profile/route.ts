import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// GET handler to fetch the agent profile
export async function GET() {
  try {
    const { data } = await supabase.from("agent_profiles").select("*").single();

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching agent profile:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST handler to create or update the agent profile
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      console.error("No user ID found in auth()");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Processing POST request for user:", userId);
    const body = await request.json();
    console.log("Request body:", body);
    const { start_date, license_number, specializations, notes } = body;

    // Process specializations
    let processedSpecializations = null;
    if (specializations) {
      if (Array.isArray(specializations)) {
        processedSpecializations = specializations.filter(Boolean);
      } else if (typeof specializations === "string") {
        processedSpecializations = specializations
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    console.log("Processed specializations:", processedSpecializations);

    // Check if profile exists
    const { data: existingProfile, error: checkError } = await supabaseClient
      .from("agent_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking for existing profile:", checkError);
      return NextResponse.json(
        {
          error: `Failed to check for existing profile: ${checkError.message}`,
        },
        { status: 500 }
      );
    }

    console.log("Existing profile:", existingProfile);

    let result;

    if (existingProfile) {
      // Update existing profile
      console.log("Updating existing profile with ID:", existingProfile.id);
      const { data, error } = await supabaseClient
        .from("agent_profiles")
        .update({
          start_date: start_date || null,
          license_number: license_number || null,
          specializations: processedSpecializations
            ? JSON.stringify(processedSpecializations)
            : null,
          notes: notes || null,
        })
        .eq("id", existingProfile.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json(
          { error: `Failed to update profile: ${error.message}` },
          { status: 500 }
        );
      }
      result = data;
      console.log("Profile updated successfully:", result);
    } else {
      // Create new profile
      console.log("Creating new profile for user:", userId);
      const { data, error } = await supabaseClient
        .from("agent_profiles")
        .insert({
          user_id: userId,
          start_date: start_date || null,
          license_number: license_number || null,
          specializations: processedSpecializations
            ? JSON.stringify(processedSpecializations)
            : null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating profile:", error);
        return NextResponse.json(
          { error: `Failed to create profile: ${error.message}` },
          { status: 500 }
        );
      }
      result = data;
      console.log("Profile created successfully:", result);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in POST /api/agent-profile:", error);
    return NextResponse.json(
      {
        error: `Failed to save profile: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
