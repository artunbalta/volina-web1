-- Add tags column to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for tags
CREATE INDEX IF NOT EXISTS idx_calls_tags ON calls USING GIN(tags);
