import { auth, clerkClient } from "@clerk/nextjs";
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

// Helper function to parse specializations
function parseSpecializations(specializations: unknown): string[] | null {
  if (!specializations) return null;
  
  if (Array.isArray(specializations)) {
    return specializations;
  }
  
  if (typeof specializations === 'string') {
    try {
      const parsed = JSON.parse(specializations);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      // If it's not valid JSON, treat it as a comma-separated string
      return specializations.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  
  return null;
}

// GET handler to fetch the agent profile
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    let effectiveUserId = userId;

    if (targetUserId && targetUserId !== userId) {
      const { data: adminProfile } = await supabaseClient
        .from("agent_profiles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (!adminProfile || adminProfile.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      effectiveUserId = targetUserId;
    }

    const { data: profile, error } = await supabaseClient
      .from("agent_profiles")
      .select("*")
      .eq("user_id", effectiveUserId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching profile:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!profile) {
      let firstName: string | null = null;
      let lastName: string | null = null;
      try {
        const clerkUser = await clerkClient.users.getUser(effectiveUserId);
        firstName = clerkUser.firstName || null;
        lastName = clerkUser.lastName || null;
      } catch { /* ignore */ }

      return NextResponse.json({
        id: null,
        user_id: effectiveUserId,
        first_name: firstName,
        last_name: lastName,
        license_number: null,
        specializations: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (!profile.first_name && !profile.last_name) {
      try {
        const clerkUser = await clerkClient.users.getUser(profile.user_id);
        const firstName = clerkUser.firstName || null;
        const lastName = clerkUser.lastName || null;
        if (firstName || lastName) {
          await supabaseClient
            .from("agent_profiles")
            .update({ first_name: firstName, last_name: lastName })
            .eq("id", profile.id);
          profile.first_name = firstName;
          profile.last_name = lastName;
        }
      } catch { /* ignore */ }
    }

    const parsedProfile = {
      ...profile,
      specializations: parseSpecializations(profile.specializations)
    };

    return NextResponse.json(parsedProfile);
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
    const { license_number, specializations, notes } = body;

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
            license_number: license_number || null,
            specializations: processedSpecializations
              ? JSON.stringify(processedSpecializations)
              : null,
            notes: notes || null,
            updated_at: new Date().toISOString(),
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
            license_number: license_number || null,
            specializations: processedSpecializations
              ? JSON.stringify(processedSpecializations)
              : null,
            notes: notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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

    // Parse specializations in the result to ensure it's an array
    const parsedResult = {
      ...result,
      specializations: parseSpecializations(result.specializations)
    };

    return NextResponse.json(parsedResult);
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
