require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or service role key");
  console.error("Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log("Testing database connection...");
  const { data, error } = await supabase
    .from('policies')
    .select('count')
    .limit(1);
  
  if (error) {
    console.error("Database connection failed:", error.message);
    return false;
  }
  console.log("✅ Database connection successful");
  return true;
}

async function backupCheck() {
  console.log("\n⚠️  IMPORTANT: This script will modify your database schema and data.");
  console.log("💡 It's recommended to backup your database before proceeding.");
  console.log("📖 You can create a backup in your Supabase dashboard under Database > Backups");
  
  // In a real scenario, you might want to add a confirmation prompt here
  console.log("Proceeding with the fix...\n");
}

async function inspectCurrentSchema() {
  console.log("Inspecting current commission_due column...");
  
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: `
      SELECT column_name, data_type, is_nullable, column_default, is_generated
      FROM information_schema.columns 
      WHERE table_name = 'policies' AND column_name = 'commission_due';
    `
  });

  if (error) {
    console.error("Error inspecting schema:", error);
    return false;
  }

  if (data && data.length > 0) {
    console.log("Current commission_due column info:", data[0]);
  } else {
    console.log("commission_due column not found - this might be a new database");
  }
  
  return true;
}

async function findRoundingIssues() {
  console.log("Looking for commission amounts that need rounding...");
  
  const { data, error } = await supabase
    .from('policies')
    .select('policy_number, commissionable_annual_premium, commission_rate, commission_due')
    .limit(10);

  if (error) {
    console.error("Error checking data:", error);
    return false;
  }

  const issuesFound = [];
  data.forEach(policy => {
    const expected = Math.round(policy.commissionable_annual_premium * policy.commission_rate * 100) / 100;
    if (policy.commission_due !== expected) {
      issuesFound.push({
        policy: policy.policy_number,
        current: policy.commission_due,
        expected: expected
      });
    }
  });

  if (issuesFound.length > 0) {
    console.log(`Found ${issuesFound.length} policies with rounding issues:`);
    issuesFound.forEach(issue => {
      console.log(`  Policy ${issue.policy}: $${issue.current} → $${issue.expected}`);
    });
  } else {
    console.log("✅ No rounding issues found in the sample data");
  }

  return true;
}

async function applyFix() {
  try {
    // Read the safe fix file
    const fixPath = path.join(__dirname, "../supabase/fix-commission-rounding-safe.sql");
    const fixSql = fs.readFileSync(fixPath, "utf8");

    console.log("Applying safe commission rounding fix...");

    // Split SQL into statements, handling multi-line functions
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    
    fixSql.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        return;
      }
      
      currentStatement += line + '\n';
      
      // Track if we're inside a function definition
      if (trimmedLine.includes('$$')) {
        inFunction = !inFunction;
      }
      
      // End of statement (semicolon outside of function)
      if (trimmedLine.endsWith(';') && !inFunction) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    });

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Step ${i + 1}: ${statement.substring(0, 50).replace(/\n/g, ' ')}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          console.error(`Error in step ${i + 1}:`, error.message);
          throw error;
        }
        console.log(`✅ Step ${i + 1} completed`);
      }
    }

    console.log("\n🎉 Commission rounding fix applied successfully!");
    return true;

  } catch (err) {
    console.error("❌ Error applying fix:", err.message);
    return false;
  }
}

async function verifyFix() {
  console.log("\nVerifying the fix...");
  
  const { data, error } = await supabase
    .from('policies')
    .select('policy_number, commissionable_annual_premium, commission_rate, commission_due')
    .limit(5);

  if (error) {
    console.error("Error verifying fix:", error);
    return false;
  }

  console.log("Sample results after fix:");
  data.forEach(policy => {
    const expected = Math.round(policy.commissionable_annual_premium * policy.commission_rate * 100) / 100;
    const isCorrect = policy.commission_due === expected;
    console.log(`${isCorrect ? '✅' : '❌'} Policy ${policy.policy_number}: $${policy.commissionable_annual_premium} × ${policy.commission_rate} = $${policy.commission_due}`);
  });

  return true;
}

async function main() {
  console.log("=== Commission Rounding Fix - Safe Version ===\n");

  // Step 1: Test connection
  if (!(await testConnection())) {
    process.exit(1);
  }

  // Step 2: Backup warning
  await backupCheck();

  // Step 3: Inspect current schema
  if (!(await inspectCurrentSchema())) {
    process.exit(1);
  }

  // Step 4: Check for rounding issues
  if (!(await findRoundingIssues())) {
    process.exit(1);
  }

  // Step 5: Apply the fix
  if (!(await applyFix())) {
    console.log("\n❌ Fix failed. Your database should be unchanged.");
    process.exit(1);
  }

  // Step 6: Verify the fix
  if (!(await verifyFix())) {
    console.log("\n⚠️  Fix applied but verification failed. Please check your data manually.");
    process.exit(1);
  }

  console.log("\n✅ All done! Commission amounts are now properly rounded to cents.");
  console.log("📝 Future commission calculations will automatically be rounded thanks to the database trigger.");
}

main().catch(console.error); 