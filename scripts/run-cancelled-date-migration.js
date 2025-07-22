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

async function runCancelledDateMigration() {
  try {
    console.log("Running cancelled_date migration...");

    // First, let's check if the column already exists
    console.log("Checking if cancelled_date column exists...");
    
    const { data: existingData, error: checkError } = await supabase
      .from("policies")
      .select("cancelled_date")
      .limit(1);

    if (!checkError) {
      console.log("cancelled_date column already exists!");
      return;
    }

    // If we get an error, the column probably doesn't exist, so let's add it
    console.log("Column doesn't exist, adding it...");

    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "../supabase/migrations/20241222000001_add_cancelled_date_column.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    console.log("Migration SQL:", migrationSql);

    // For Supabase, we need to execute each statement separately
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement}`);
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        });

        if (error) {
          console.error("Error executing statement:", error);
          console.log("Trying direct query execution...");
          
          // If exec_sql doesn't work, try direct execution for ALTER TABLE
          if (statement.includes('ALTER TABLE')) {
            // This might not work with regular client, but let's try
            const { error: directError } = await supabase
              .from('policies')
              .select('*')
              .limit(0); // This is just to test connection
              
            console.log("Direct execution not supported, please run this manually in Supabase SQL editor:");
            console.log(migrationSql);
            return;
          }
        } else {
          console.log("Statement executed successfully");
        }
      }
    }

    console.log("Migration completed successfully!");
    
    // Test the new column
    console.log("Testing the new column...");
    const { data: testData, error: testError } = await supabase
      .from("policies")
      .select("id, cancelled_date")
      .limit(1);
      
    if (testError) {
      console.error("Error testing new column:", testError);
    } else {
      console.log("New column is working correctly!");
    }

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

runCancelledDateMigration(); 