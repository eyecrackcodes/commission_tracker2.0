-- Change specializations column from TEXT[] to TEXT
-- This is to match how the API is storing specializations as JSON string
ALTER TABLE agent_profiles 
ALTER COLUMN specializations TYPE TEXT 
USING CASE 
  WHEN specializations IS NULL THEN NULL
  WHEN array_length(specializations, 1) IS NULL THEN NULL
  ELSE array_to_json(specializations)::TEXT
END; 