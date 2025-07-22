require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "../supabase/migrations/20240101000000_create_agent_profiles.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    console.log("Running migration...");

    // Execute the SQL
    const { error } = await supabase.rpc("exec_sql", { sql: migrationSql });

    if (error) {
      console.error("Error running migration:", error);
      process.exit(1);
    }

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

runMigration();
