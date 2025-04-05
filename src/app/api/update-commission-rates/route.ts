import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  shouldUpdateCommissionRate,
  calculateCommissionRate,
} from "@/lib/commission";
import { sendCommissionRateChangeNotification } from "@/lib/slack";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Fetch all agent profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("agent_profiles")
      .select("user_id, start_date");

    if (profilesError) {
      throw profilesError;
    }

    const updates = [];

    // Check each profile for commission rate updates
    for (const profile of profiles) {
      if (shouldUpdateCommissionRate(profile.start_date)) {
        const newRate = calculateCommissionRate(profile.start_date);

        // Update all policies for this agent
        const { error: updateError } = await supabase
          .from("policies")
          .update({ commission_rate: newRate })
          .eq("user_id", profile.user_id)
          .eq("commission_rate", 0.05); // Only update policies at 5%

        if (updateError) {
          console.error(
            `Error updating policies for user ${profile.user_id}:`,
            updateError
          );
          continue;
        }

        // Send Slack notification
        await sendCommissionRateChangeNotification(0.05, newRate);

        updates.push({
          userId: profile.user_id,
          oldRate: 0.05,
          newRate,
        });
      }
    }

    return NextResponse.json({
      message: "Commission rate update check completed",
      updates,
    });
  } catch (error) {
    console.error("Error updating commission rates:", error);
    return NextResponse.json(
      { error: "Failed to update commission rates" },
      { status: 500 }
    );
  }
}
