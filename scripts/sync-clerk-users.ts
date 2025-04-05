import { createClerkClient } from "@clerk/clerk-sdk-node";
import { createClient } from "@supabase/supabase-js";

// Initialize Clerk client
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncUsers() {
  try {
    console.log("Starting user sync...");

    // Get all users from Clerk
    const clerkUsers = await clerk.users.getUserList();
    console.log(`Found ${clerkUsers.length} users in Clerk`);

    // Get existing users from Supabase
    const { data: existingProfiles, error: fetchError } = await supabase
      .from("agent_profiles")
      .select("user_id");

    if (fetchError) {
      throw new Error(
        `Error fetching existing profiles: ${fetchError.message}`
      );
    }

    const existingUserIds = new Set(
      existingProfiles?.map((p) => p.user_id) || []
    );
    const usersToSync = clerkUsers.filter(
      (user) => !existingUserIds.has(user.id)
    );

    console.log(`Found ${usersToSync.length} users to sync`);

    // Create profiles for users that don't have one
    for (const user of usersToSync) {
      console.log(`Creating profile for user ${user.id}`);

      const { error } = await supabase.from("agent_profiles").insert({
        user_id: user.id,
        start_date: new Date().toISOString().split("T")[0], // Today's date
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error(`Error creating profile for user ${user.id}:`, error);
        continue;
      }

      console.log(`Successfully created profile for user ${user.id}`);
    }

    console.log("Sync completed!");
  } catch (error) {
    console.error("Error during sync:", error);
    process.exit(1);
  }
}

// Run the sync
syncUsers();
