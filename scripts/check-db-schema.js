require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseSchema() {
  try {
    console.log("Checking database schema...");

    // Check if the agent_profiles table exists
    const { data: tableInfo, error: tableError } = await supabase
      .from("agent_profiles")
      .select("*")
      .limit(1);

    if (tableError) {
      console.error("Error checking agent_profiles table:", tableError);
      return;
    }

    console.log("agent_profiles table exists and is accessible.");

    // Get a sample record to see the structure
    if (tableInfo && tableInfo.length > 0) {
      console.log("Sample record:", tableInfo[0]);
    } else {
      console.log("No records found in the agent_profiles table.");
    }

    // Try to insert a test record
    console.log("Attempting to insert a test record...");
    const testUserId = "test_user_" + Date.now();
    const { data: insertData, error: insertError } = await supabase
      .from("agent_profiles")
      .insert({
        user_id: testUserId,
        start_date: new Date().toISOString(),
        license_number: "TEST123",
        specializations: ["Test"],
        notes: "Test record",
      })
      .select();

    if (insertError) {
      console.error("Error inserting test record:", insertError);
    } else {
      console.log("Test record inserted successfully:", insertData);

      // Delete the test record
      console.log("Deleting test record...");
      const { error: deleteError } = await supabase
        .from("agent_profiles")
        .delete()
        .eq("user_id", testUserId);

      if (deleteError) {
        console.error("Error deleting test record:", deleteError);
      } else {
        console.log("Test record deleted successfully.");
      }
    }

    console.log("Database schema check completed successfully.");
  } catch (error) {
    console.error("Error checking database schema:", error);
  }
}

checkDatabaseSchema();
