-- Migration: Add assistant_id filtering for multi-assistant support
-- Run this in Supabase SQL Editor

-- 1. Add vapi_assistant_id to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT;

-- 2. Add assistant_id to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS assistant_id TEXT;

-- 3. Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_calls_assistant_id ON calls(assistant_id);
CREATE INDEX IF NOT EXISTS idx_calls_user_assistant ON calls(user_id, assistant_id);

-- 4. Update existing calls to extract assistant_id from metadata if available
-- (VAPI stores it in the metadata as assistantId)
UPDATE calls 
SET assistant_id = metadata->>'assistantId'
WHERE assistant_id IS NULL 
AND metadata->>'assistantId' IS NOT NULL;

-- MANUAL STEP: Set your user's assistant_id in profiles
-- Replace YOUR_USER_ID and YOUR_ASSISTANT_ID with actual values
-- Example:
-- UPDATE profiles 
-- SET vapi_assistant_id = 'your-assistant-id-here'
-- WHERE slug = 'smileandholiday';

-- To find your assistant IDs, go to VAPI Dashboard > Assistants
-- Each assistant has a unique ID like: 'abc123-def456-...'
