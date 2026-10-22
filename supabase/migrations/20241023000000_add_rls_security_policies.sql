-- =====================================================
-- SECURITY HARDENING: Row Level Security Policies
-- =====================================================
-- This migration adds comprehensive RLS policies to all tables
-- to ensure users can only access their own data.

-- =====================================================
-- 1. Fix agent_profiles RLS policies
-- =====================================================
-- Drop old policies that incorrectly use current_user
DROP POLICY IF EXISTS "Users can view their own profile" ON agent_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON agent_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON agent_profiles;

-- Create new policies using JWT claims (auth.uid())
CREATE POLICY "Users can view their own profile"
  ON agent_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON agent_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON agent_profiles
  FOR UPDATE
  USING (user_id = auth.uid());

-- Add admin read-all policy for admin dashboard
CREATE POLICY "Admins can view all profiles"
  ON agent_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 2. Add RLS policies to policies table
-- =====================================================
-- Enable RLS on policies table if not already enabled
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- Users can view their own policies
CREATE POLICY "Users can view their own policies"
  ON policies
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own policies
CREATE POLICY "Users can insert their own policies"
  ON policies
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own policies
CREATE POLICY "Users can update their own policies"
  ON policies
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own policies
CREATE POLICY "Users can delete their own policies"
  ON policies
  FOR DELETE
  USING (user_id = auth.uid());

-- Admins can view all policies
CREATE POLICY "Admins can view all policies"
  ON policies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all policies (for bulk operations)
CREATE POLICY "Admins can update all policies"
  ON policies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM agent_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 3. Add indexes for performance
-- =====================================================
-- Index on user_id for efficient policy filtering
CREATE INDEX IF NOT EXISTS idx_policies_user_id ON policies(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_user_id ON agent_profiles(user_id);

-- Index on role for admin checks
CREATE INDEX IF NOT EXISTS idx_agent_profiles_role ON agent_profiles(role) WHERE role = 'admin';

-- =====================================================
-- 4. Add security function for JWT validation
-- =====================================================
-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM agent_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION is_admin() IS 'Returns true if the current authenticated user has admin role';
