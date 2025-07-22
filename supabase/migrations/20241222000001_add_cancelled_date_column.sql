-- Add cancelled_date column to policies table for proper cancellation follow-up tracking
-- This allows us to track exactly when a policy was cancelled, separate from created_at

ALTER TABLE policies 
ADD COLUMN cancelled_date TIMESTAMPTZ NULL;

-- Add comment explaining the field
COMMENT ON COLUMN policies.cancelled_date IS 'Timestamp when policy status was changed to Cancelled, used for follow-up tracking';

-- Create index for efficient querying of recent cancellations
CREATE INDEX idx_policies_cancelled_date ON policies(cancelled_date) WHERE cancelled_date IS NOT NULL; 