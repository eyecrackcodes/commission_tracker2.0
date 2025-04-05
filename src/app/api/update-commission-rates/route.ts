import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  shouldUpdateCommissionRate,
  calculateCommissionRate,
} from "@/lib/commission";
import {
  hasBeenNotifiedRecently,
  recordNotification,
} from "@/lib/notification-tracker-server";

// Define types for our data
interface AgentProfile {
  user_id: string;
  start_date: string;
}

interface Policy {
  id: string;
  user_id: string;
  commission_rate: number;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    console.log("Starting commission rate update check...");

    // Fetch all agent profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("agent_profiles")
      .select("user_id, start_date");

    if (profilesError) {
      console.error("Error fetching agent profiles:", profilesError);
      throw profilesError;
    }

    const typedProfiles = profiles as AgentProfile[];
    console.log(`Found ${typedProfiles.length} agent profiles to check`);
    const updates = [];

    // Check each profile for commission rate updates
    for (const profile of typedProfiles) {
      console.log(
        `Checking profile for user ${profile.user_id} with start date ${profile.start_date}`
      );

      if (shouldUpdateCommissionRate(profile.start_date)) {
        console.log(
          `Agent ${profile.user_id} qualifies for commission rate update`
        );
        const newRate = calculateCommissionRate(profile.start_date);
        console.log(`New commission rate will be ${newRate * 100}%`);

        // Update all policies for this agent
        const { data: updatedPolicies, error: updateError } = await supabase
          .from("policies")
          .update({ commission_rate: newRate })
          .eq("user_id", profile.user_id)
          .eq("commission_rate", 0.05)
          .select(); // Add .select() to return the updated records

        if (updateError) {
          console.error(
            `Error updating policies for user ${profile.user_id}:`,
            updateError
          );
          continue;
        }

        const typedUpdatedPolicies = updatedPolicies as Policy[];
        console.log(
          `Updated ${typedUpdatedPolicies?.length || 0} policies for user ${
            profile.user_id
          }`
        );

        // Check if we've already notified this agent recently
        const shouldNotify = !hasBeenNotifiedRecently(profile.user_id);

        if (shouldNotify) {
          // Send Slack notification using our API route
          try {
            console.log(
              `Sending Slack notification for user ${profile.user_id}`
            );
            const appUrl =
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const response = await fetch(`${appUrl}/api/slack/notify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "commission_rate_change",
                data: {
                  userId: profile.user_id,
                  oldRate: 0.05,
                  newRate,
                },
              }),
            });

            if (!response.ok) {
              console.error(
                `Error sending Slack notification: ${await response.text()}`
              );
            } else {
              console.log(
                `Slack notification sent successfully for user ${profile.user_id}`
              );

              // Record the notification to prevent duplicate notifications
              recordNotification(profile.user_id, newRate);
              console.log(`Recorded notification for user ${profile.user_id}`);
            }
          } catch (slackError) {
            console.error("Error sending Slack notification:", slackError);
            // Continue with the rest of the function even if Slack notification fails
          }
        } else {
          console.log(
            `Skipping notification for user ${profile.user_id} as they were recently notified`
          );
        }

        updates.push({
          userId: profile.user_id,
          oldRate: 0.05,
          newRate,
          policiesUpdated: typedUpdatedPolicies?.length || 0,
          notificationSent: shouldNotify,
        });
      } else {
        console.log(
          `Agent ${profile.user_id} does not qualify for commission rate update`
        );
      }
    }

    console.log(
      `Commission rate update check completed. Updated ${updates.length} agents.`
    );
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
