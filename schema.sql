-- ===========================================
-- VOLINA AI - Supabase Database Schema
-- ===========================================
-- Run this in your Supabase SQL Editor to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. PROFILES TABLE (User Authentication)
-- ===========================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    vapi_org_id TEXT, -- Link to Vapi organization for webhook routing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add vapi_org_id column if it doesn't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vapi_org_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN vapi_org_id TEXT;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles (drop if exists first)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authentication trigger" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Allow inserts during signup (the trigger runs as SECURITY DEFINER)
-- This policy allows the trigger to insert new profiles
CREATE POLICY "Enable insert for authentication trigger" ON profiles
    FOR INSERT WITH CHECK (true);

-- Function to handle new user signup
-- SECURITY DEFINER allows this function to bypass RLS
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- Profile already exists, ignore
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===========================================
-- 2. DOCTORS TABLE (Per-user team members)
-- ===========================================
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    color_code TEXT NOT NULL DEFAULT '#0055FF',
    avatar_url TEXT,
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add user_id column if it doesn't exist (for existing tables)
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'doctors' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE doctors ADD COLUMN user_id UUID;
    END IF;
    
    -- Get first user ID
    SELECT id INTO first_user_id FROM profiles ORDER BY created_at LIMIT 1;
    
    -- Set user_id for all NULL rows (only if we have a user)
    IF first_user_id IS NOT NULL THEN
        UPDATE doctors SET user_id = first_user_id WHERE user_id IS NULL;
    END IF;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'doctors' 
        AND constraint_name = 'doctors_user_id_fkey'
    ) THEN
        IF first_user_id IS NOT NULL THEN
            ALTER TABLE doctors ADD CONSTRAINT doctors_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
    
    -- Make it NOT NULL only if all rows have values
    IF NOT EXISTS (SELECT 1 FROM doctors WHERE user_id IS NULL) THEN
        BEGIN
            ALTER TABLE doctors ALTER COLUMN user_id SET NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN NULL; -- Ignore if already NOT NULL
        END;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own doctors
DROP POLICY IF EXISTS "Users can view their own doctors" ON doctors;
DROP POLICY IF EXISTS "Users can insert their own doctors" ON doctors;
DROP POLICY IF EXISTS "Users can update their own doctors" ON doctors;
DROP POLICY IF EXISTS "Users can delete their own doctors" ON doctors;
DROP POLICY IF EXISTS "Service role can manage doctors" ON doctors;

CREATE POLICY "Users can view their own doctors" ON doctors
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own doctors" ON doctors
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own doctors" ON doctors
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own doctors" ON doctors
    FOR DELETE USING (auth.uid() = user_id);

-- Policy: Service role can manage all doctors (for webhooks)
CREATE POLICY "Service role can manage doctors" ON doctors
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);

-- ===========================================
-- 3. APPOINTMENTS TABLE (Per-user appointments)
-- ===========================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID,
    patient_name TEXT NOT NULL,
    patient_phone TEXT,
    patient_email TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    created_via_ai BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for doctor_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'appointments' 
        AND constraint_name = 'appointments_doctor_id_fkey'
    ) THEN
        ALTER TABLE appointments ADD CONSTRAINT appointments_doctor_id_fkey 
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add user_id column if it doesn't exist (for existing tables)
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE appointments ADD COLUMN user_id UUID;
    END IF;
    
    -- Get first user ID
    SELECT id INTO first_user_id FROM profiles ORDER BY created_at LIMIT 1;
    
    -- Set user_id from doctor's user_id for existing rows
    UPDATE appointments SET user_id = (
        SELECT d.user_id FROM doctors d WHERE d.id = appointments.doctor_id LIMIT 1
    ) WHERE user_id IS NULL AND doctor_id IS NOT NULL;
    
    -- For appointments without doctors, assign to first user
    IF first_user_id IS NOT NULL THEN
        UPDATE appointments SET user_id = first_user_id WHERE user_id IS NULL;
    END IF;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'appointments' 
        AND constraint_name = 'appointments_user_id_fkey'
    ) THEN
        IF first_user_id IS NOT NULL THEN
            ALTER TABLE appointments ADD CONSTRAINT appointments_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
    
    -- Make it NOT NULL only if all rows have values
    IF NOT EXISTS (SELECT 1 FROM appointments WHERE user_id IS NULL) THEN
        BEGIN
            ALTER TABLE appointments ALTER COLUMN user_id SET NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN NULL; -- Ignore if already NOT NULL
        END;
    END IF;
END $$;

-- Make doctor_id NOT NULL if it's not already
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'appointments' 
        AND column_name = 'doctor_id' AND is_nullable = 'YES'
    ) THEN
        -- Set a default doctor for existing rows if needed
        IF EXISTS (SELECT 1 FROM doctors LIMIT 1) THEN
            UPDATE appointments SET doctor_id = (SELECT id FROM doctors LIMIT 1) WHERE doctor_id IS NULL;
        END IF;
        ALTER TABLE appointments ALTER COLUMN doctor_id SET NOT NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own appointments
DROP POLICY IF EXISTS "Users can view their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can insert their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can delete their own appointments" ON appointments;
DROP POLICY IF EXISTS "Service role can manage appointments" ON appointments;

CREATE POLICY "Users can view their own appointments" ON appointments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own appointments" ON appointments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments" ON appointments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments" ON appointments
    FOR DELETE USING (auth.uid() = user_id);

-- Policy: Service role can manage all appointments (for webhooks/API)
CREATE POLICY "Service role can manage appointments" ON appointments
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ===========================================
-- 4. CALLS TABLE (Voice Call Logs - Per-user)
-- ===========================================
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vapi_call_id TEXT UNIQUE,
    appointment_id UUID,
    recording_url TEXT,
    transcript TEXT,
    summary TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    duration INTEGER, -- Duration in seconds
    type TEXT DEFAULT 'inquiry' CHECK (type IN ('appointment', 'inquiry', 'follow_up', 'cancellation')),
    caller_phone TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for appointment_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'calls' 
        AND constraint_name = 'calls_appointment_id_fkey'
    ) THEN
        ALTER TABLE calls ADD CONSTRAINT calls_appointment_id_fkey 
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add user_id column if it doesn't exist (for existing tables)
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE calls ADD COLUMN user_id UUID;
    END IF;
    
    -- Get first user ID
    SELECT id INTO first_user_id FROM profiles ORDER BY created_at LIMIT 1;
    
    -- Set user_id from appointment's user_id for existing rows
    UPDATE calls SET user_id = (
        SELECT a.user_id FROM appointments a WHERE a.id = calls.appointment_id LIMIT 1
    ) WHERE user_id IS NULL AND appointment_id IS NOT NULL;
    
    -- For calls without appointments, assign to first user
    IF first_user_id IS NOT NULL THEN
        UPDATE calls SET user_id = first_user_id WHERE user_id IS NULL;
    END IF;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name = 'calls' 
        AND constraint_name = 'calls_user_id_fkey'
    ) THEN
        IF first_user_id IS NOT NULL THEN
            ALTER TABLE calls ADD CONSTRAINT calls_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
    
    -- Make it NOT NULL only if all rows have values
    IF NOT EXISTS (SELECT 1 FROM calls WHERE user_id IS NULL) THEN
        BEGIN
            ALTER TABLE calls ALTER COLUMN user_id SET NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN NULL; -- Ignore if already NOT NULL
        END;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own calls
DROP POLICY IF EXISTS "Users can view their own calls" ON calls;
DROP POLICY IF EXISTS "Users can insert their own calls" ON calls;
DROP POLICY IF EXISTS "Users can update their own calls" ON calls;
DROP POLICY IF EXISTS "Service role can manage calls" ON calls;

CREATE POLICY "Users can view their own calls" ON calls
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calls" ON calls
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calls" ON calls
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Service role can manage all calls (for webhooks)
CREATE POLICY "Service role can manage calls" ON calls
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id ON calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_type ON calls(type);

-- ===========================================
-- 5. REALTIME SETUP
-- ===========================================
-- Enable realtime for appointments table (ignore errors if already added)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 6. UPDATED_AT TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_doctors_updated_at ON doctors;
CREATE TRIGGER update_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;
CREATE TRIGGER update_calls_updated_at
    BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 7. HELPER FUNCTIONS
-- ===========================================

-- Function to get user by vapi_org_id (for webhook routing)
CREATE OR REPLACE FUNCTION get_user_by_vapi_org(org_id TEXT)
RETURNS UUID AS $$
DECLARE
    user_uuid UUID;
BEGIN
    SELECT id INTO user_uuid FROM profiles WHERE vapi_org_id = org_id LIMIT 1;
    RETURN user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get call stats for a user
CREATE OR REPLACE FUNCTION get_call_stats(p_user_id UUID)
RETURNS TABLE (
    monthly_calls BIGINT,
    daily_calls BIGINT,
    avg_duration NUMERIC,
    appointment_count BIGINT,
    inquiry_count BIGINT,
    follow_up_count BIGINT,
    cancellation_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) as monthly_calls,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) as daily_calls,
        COALESCE(AVG(duration) FILTER (WHERE duration IS NOT NULL), 0) as avg_duration,
        COUNT(*) FILTER (WHERE type = 'appointment') as appointment_count,
        COUNT(*) FILTER (WHERE type = 'inquiry') as inquiry_count,
        COUNT(*) FILTER (WHERE type = 'follow_up') as follow_up_count,
        COUNT(*) FILTER (WHERE type = 'cancellation') as cancellation_count
    FROM calls
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
