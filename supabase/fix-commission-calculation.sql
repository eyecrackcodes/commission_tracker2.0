-- Fix commission_due calculation to use actual commission_rate field
-- This script addresses the issue where commission_due was hardcoded to 20% instead of using the stored commission_rate

-- First, let's see the current policies table structure
-- (This is a comment for reference - you'd run this separately to check)
-- \d policies;

-- Drop the existing commission_due column if it's a generated column
ALTER TABLE policies 
DROP COLUMN IF EXISTS commission_due;

-- Add the commission_due column back as a proper generated column
-- that uses the actual commission_rate field
ALTER TABLE policies 
ADD COLUMN commission_due NUMERIC GENERATED ALWAYS AS (
  commissionable_annual_premium * commission_rate
) STORED;

-- Add a check constraint to ensure commission_rate is within valid range
ALTER TABLE policies 
ADD CONSTRAINT policies_commission_rate_check 
CHECK (commission_rate IN (0.025, 0.05, 0.1, 0.2));

-- Update any existing policies to recalculate commission_due
-- (This might not be needed if it's a generated column, but just in case)
-- UPDATE policies SET commission_rate = commission_rate;

-- Verify the fix with a sample query (run this separately to test)
-- SELECT 
--   policy_number,
--   commissionable_annual_premium,
--   commission_rate,
--   commission_due,
--   (commissionable_annual_premium * commission_rate) AS calculated_commission
-- FROM policies 
-- LIMIT 5; 