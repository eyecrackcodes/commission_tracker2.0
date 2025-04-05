import { auth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    const { userId } = auth();

    if (!userId) {
      console.error("No user ID found in auth()");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Fetching profile for user:", userId);
    const { data: profile, error } = await supabaseClient
      .from("agent_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "PGRST116" ? 404 : 500 }
      );
    }

    if (!profile) {
      console.log("No profile found, attempting to create one");
      // Try to create a profile if it doesn't exist
      const { data: newProfile, error: createError } = await supabaseClient
        .from("agent_profiles")
        .insert([
          {
            user_id: userId,
            start_date: new Date().toISOString().split("T")[0],
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
        return NextResponse.json(
          { error: createError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(newProfile);
    }

    return NextResponse.json(profile);
  } catch (err) {
    console.error("Error in GET /api/agent-profile:", err);
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
      try {
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
      } catch (updateError) {
        console.error("Exception updating profile:", updateError);
        return NextResponse.json(
          {
            error: `Exception updating profile: ${
              updateError instanceof Error
                ? updateError.message
                : String(updateError)
            }`,
          },
          { status: 500 }
        );
      }
    } else {
      // Create new profile
      console.log("Creating new profile for user:", userId);
      try {
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
      } catch (createError) {
        console.error("Exception creating profile:", createError);
        return NextResponse.json(
          {
            error: `Exception creating profile: ${
              createError instanceof Error
                ? createError.message
                : String(createError)
            }`,
          },
          { status: 500 }
        );
      }
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
