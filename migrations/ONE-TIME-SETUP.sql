-- ===========================================
-- ONE-TIME SETUP - Run this ONCE in Supabase
-- ===========================================
-- After running this, the app will automatically:
-- 1. Detect if data is missing
-- 2. Seed sample call data
-- 3. Re-seed if data gets deleted

-- Step 1: Add columns to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_summary TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_score INTEGER;

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_calls_evaluation_score ON calls(evaluation_score);
CREATE INDEX IF NOT EXISTS idx_calls_caller_name ON calls(caller_name);

-- Step 3: Create auto-setup RPC function
CREATE OR REPLACE FUNCTION setup_calls_evaluation_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_summary TEXT;
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_score INTEGER;
    CREATE INDEX IF NOT EXISTS idx_calls_evaluation_score ON calls(evaluation_score);
    CREATE INDEX IF NOT EXISTS idx_calls_caller_name ON calls(caller_name);
    RETURN jsonb_build_object('success', true, 'message', 'Schema ready');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Done! The app will now auto-seed sample data when you visit the Aramalar page.
SELECT 'Setup complete! Visit your dashboard to see sample call data.' as status;

