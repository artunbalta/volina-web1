-- ===========================================
-- Add 'outbound' to calls.type CHECK constraint
-- ===========================================
-- Run this ONCE in Supabase SQL Editor

-- Step 1: Drop the existing constraint
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_type_check;

-- Step 2: Add the new constraint with 'outbound' included
ALTER TABLE calls ADD CONSTRAINT calls_type_check 
    CHECK (type IN ('appointment', 'inquiry', 'follow_up', 'cancellation', 'outbound'));
