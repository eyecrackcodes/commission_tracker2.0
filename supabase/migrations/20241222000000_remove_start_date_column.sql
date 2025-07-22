-- Remove start_date column from agent_profiles table since tenure is no longer used
-- Agents now control their own commission rates

ALTER TABLE agent_profiles 
DROP COLUMN IF EXISTS start_date; 