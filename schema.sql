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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===========================================
-- 2. DOCTORS TABLE
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

-- Enable RLS
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can view doctors
CREATE POLICY "Authenticated users can view doctors" ON doctors
    FOR SELECT TO authenticated USING (true);

-- ===========================================
-- 3. APPOINTMENTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
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

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view appointments
CREATE POLICY "Authenticated users can view appointments" ON appointments
    FOR SELECT TO authenticated USING (true);

-- Policy: Allow insert from service role (for n8n webhooks)
CREATE POLICY "Service role can insert appointments" ON appointments
    FOR INSERT WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ===========================================
-- 4. CALLS TABLE (Voice Call Logs)
-- ===========================================
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vapi_call_id TEXT UNIQUE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
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

-- Enable RLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view calls
CREATE POLICY "Authenticated users can view calls" ON calls
    FOR SELECT TO authenticated USING (true);

-- Policy: Allow insert from service role (for n8n webhooks)
CREATE POLICY "Service role can insert calls" ON calls
    FOR INSERT WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id ON calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_type ON calls(type);

-- ===========================================
-- 5. SEED DATA - Mock Doctors
-- ===========================================
INSERT INTO doctors (id, name, specialty, color_code, email, phone) VALUES
    ('d1a2b3c4-5678-90ab-cdef-111111111111', 'Dr. Sarah Chen', 'Cardiology', '#0055FF', 'sarah.chen@volina.health', '+1 (555) 123-4567'),
    ('d1a2b3c4-5678-90ab-cdef-222222222222', 'Dr. Michael Torres', 'Neurology', '#10B981', 'michael.torres@volina.health', '+1 (555) 234-5678'),
    ('d1a2b3c4-5678-90ab-cdef-333333333333', 'Dr. Emily Watson', 'Dermatology', '#F59E0B', 'emily.watson@volina.health', '+1 (555) 345-6789')
ON CONFLICT DO NOTHING;

-- ===========================================
-- 6. SEED DATA - Mock Appointments (for demo)
-- ===========================================
INSERT INTO appointments (doctor_id, patient_name, patient_phone, start_time, end_time, status, created_via_ai) VALUES
    -- Dr. Sarah Chen appointments
    ('d1a2b3c4-5678-90ab-cdef-111111111111', 'John Smith', '+1 (555) 111-0001', NOW()::date + INTERVAL '9 hours', NOW()::date + INTERVAL '9 hours 30 minutes', 'scheduled', false),
    ('d1a2b3c4-5678-90ab-cdef-111111111111', 'Maria Garcia', '+1 (555) 111-0002', NOW()::date + INTERVAL '10 hours', NOW()::date + INTERVAL '10 hours 30 minutes', 'confirmed', true),
    ('d1a2b3c4-5678-90ab-cdef-111111111111', 'Robert Johnson', '+1 (555) 111-0003', NOW()::date + INTERVAL '14 hours', NOW()::date + INTERVAL '14 hours 30 minutes', 'scheduled', true),
    
    -- Dr. Michael Torres appointments
    ('d1a2b3c4-5678-90ab-cdef-222222222222', 'Lisa Anderson', '+1 (555) 222-0001', NOW()::date + INTERVAL '11 hours', NOW()::date + INTERVAL '11 hours 30 minutes', 'scheduled', false),
    ('d1a2b3c4-5678-90ab-cdef-222222222222', 'David Wilson', '+1 (555) 222-0002', NOW()::date + INTERVAL '15 hours', NOW()::date + INTERVAL '15 hours 30 minutes', 'confirmed', true),
    
    -- Dr. Emily Watson appointments
    ('d1a2b3c4-5678-90ab-cdef-333333333333', 'Jennifer Brown', '+1 (555) 333-0001', NOW()::date + INTERVAL '9 hours 30 minutes', NOW()::date + INTERVAL '10 hours', 'scheduled', true),
    ('d1a2b3c4-5678-90ab-cdef-333333333333', 'Chris Martinez', '+1 (555) 333-0002', NOW()::date + INTERVAL '13 hours', NOW()::date + INTERVAL '13 hours 30 minutes', 'scheduled', false)
ON CONFLICT DO NOTHING;

-- ===========================================
-- 7. SEED DATA - Mock Calls (for demo)
-- ===========================================
INSERT INTO calls (vapi_call_id, recording_url, transcript, summary, sentiment, duration, type, caller_phone) VALUES
    ('vapi_call_001', 'https://api.vapi.ai/recordings/sample1.mp3', 
     'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: Hi, I''d like to schedule an appointment with Dr. Chen.\nAgent: Of course! I have availability tomorrow at 9 AM or 2 PM. Which works better for you?\nCaller: 9 AM works great.\nAgent: Perfect! I''ve scheduled your appointment with Dr. Sarah Chen for tomorrow at 9 AM. You''ll receive a confirmation shortly.',
     'Patient scheduled a cardiology appointment with Dr. Chen for 9 AM tomorrow.',
     'positive', 145, 'appointment', '+1 (555) 111-0002'),
    
    ('vapi_call_002', 'https://api.vapi.ai/recordings/sample2.mp3',
     'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I have a question about my upcoming appointment.\nAgent: Of course! What would you like to know?\nCaller: What should I bring to my first visit?\nAgent: Please bring your ID, insurance card, and any relevant medical records. Is there anything else I can help with?\nCaller: No, that''s all. Thank you!',
     'Patient inquired about what to bring to their first appointment.',
     'neutral', 98, 'inquiry', '+1 (555) 444-5555'),
    
    ('vapi_call_003', 'https://api.vapi.ai/recordings/sample3.mp3',
     'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I need to see a dermatologist as soon as possible.\nAgent: I can help with that. Dr. Emily Watson has an opening today at 1 PM. Would that work?\nCaller: Yes, that''s perfect!\nAgent: Great! I''ve booked your appointment with Dr. Watson for 1 PM today.',
     'Urgent dermatology appointment scheduled with Dr. Watson for same day.',
     'positive', 112, 'appointment', '+1 (555) 333-0002'),
    
    ('vapi_call_004', 'https://api.vapi.ai/recordings/sample4.mp3',
     'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I need to cancel my appointment.\nAgent: I understand. Can you provide your name and appointment date?\nCaller: John Smith, tomorrow at 3 PM.\nAgent: I''ve cancelled your appointment. Would you like to reschedule?\nCaller: No, I''ll call back later.',
     'Patient John Smith cancelled their appointment scheduled for tomorrow.',
     'neutral', 87, 'cancellation', '+1 (555) 111-0001'),
    
    ('vapi_call_005', 'https://api.vapi.ai/recordings/sample5.mp3',
     'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I want to book with Dr. Torres for my migraines.\nAgent: Dr. Torres specializes in neurology and can definitely help. I have availability this Thursday at 11 AM.\nCaller: That works for me.\nAgent: Wonderful! Your appointment with Dr. Michael Torres is confirmed for Thursday at 11 AM.',
     'Neurology appointment booked with Dr. Torres for migraine consultation.',
     'positive', 134, 'appointment', '+1 (555) 222-0001')
ON CONFLICT DO NOTHING;

-- ===========================================
-- 8. REALTIME SETUP
-- ===========================================
-- Enable realtime for appointments table
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;

-- ===========================================
-- 9. UPDATED_AT TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at
    BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
