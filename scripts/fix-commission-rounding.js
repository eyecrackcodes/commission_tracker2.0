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

async function fixCommissionRounding() {
  try {
    // Read the fix file
    const fixPath = path.join(
      __dirname,
      "../supabase/fix-commission-rounding.sql"
    );
    const fixSql = fs.readFileSync(fixPath, "utf8");

    console.log("Applying commission rounding fix...");
    console.log("This will update the commission_due column to round to 2 decimal places");

    // Split the SQL into individual statements
    const statements = fixSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        });

        if (error) {
          console.error("Error executing statement:", error);
          throw error;
        }
      }
    }

    console.log("Commission rounding fix applied successfully!");
    console.log("All commission amounts will now be rounded to 2 decimal places (cents)");
    
    // Test the fix
    console.log("\nTesting the fix...");
    const { data, error: testError } = await supabase
      .from('policies')
      .select('policy_number, commissionable_annual_premium, commission_rate, commission_due')
      .limit(3);

    if (testError) {
      console.error("Error testing fix:", testError);
    } else {
      console.log("Sample results:");
      data.forEach(policy => {
        console.log(`Policy ${policy.policy_number}: $${policy.commissionable_annual_premium} × ${policy.commission_rate} = $${policy.commission_due}`);
      });
    }

  } catch (err) {
    console.error("Error applying fix:", err);
    process.exit(1);
  }
}

fixCommissionRounding(); 