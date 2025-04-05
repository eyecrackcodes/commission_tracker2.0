-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON agent_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON agent_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON agent_profiles;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_agent_profiles_updated_at ON agent_profiles;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Create agent_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS agent_profiles (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  start_date DATE,
  license_number TEXT,
  specializations TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON agent_profiles
  FOR SELECT
  USING (user_id = current_user);

-- Policy to allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON agent_profiles
  FOR INSERT
  WITH CHECK (user_id = current_user);

-- Policy to allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON agent_profiles
  FOR UPDATE
  USING (user_id = current_user);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_agent_profiles_updated_at
BEFORE UPDATE ON agent_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 