-- Rename date_commission_paid column to date_policy_verified
-- This better reflects the business process where agents verify policy status
-- rather than tracking when commission was actually paid

ALTER TABLE policies 
RENAME COLUMN date_commission_paid TO date_policy_verified;

-- Add comment explaining the field
COMMENT ON COLUMN policies.date_policy_verified IS 'Timestamp when the agent verified that the policy is active and will be included in the upcoming commission cycle';

-- Update index if it exists
DROP INDEX IF EXISTS idx_policies_date_commission_paid;
CREATE INDEX idx_policies_date_policy_verified ON policies(date_policy_verified) WHERE date_policy_verified IS NOT NULL; 