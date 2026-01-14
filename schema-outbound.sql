-- ===========================================
-- SMILE AND HOLIDAY - Outbound Sales Dashboard
-- Supabase Database Schema
-- ===========================================
-- Run this in Supabase SQL Editor AFTER the main schema.sql

-- ===========================================
-- 1. LEADS TABLE (Potential Patients)
-- ===========================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Contact Information
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    instagram TEXT,
    
    -- Lead Details
    language TEXT DEFAULT 'tr' CHECK (language IN ('tr', 'en')),
    source TEXT DEFAULT 'web_form' CHECK (source IN ('web_form', 'instagram', 'referral', 'facebook', 'google_ads', 'other')),
    treatment_interest TEXT, -- e.g., "dental implants", "hair transplant", "rhinoplasty"
    notes TEXT,
    
    -- Status Tracking
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'appointment_set', 'converted', 'lost', 'unreachable')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    
    -- Follow-up Tracking
    first_contact_date TIMESTAMP WITH TIME ZONE,
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_contact_date TIMESTAMP WITH TIME ZONE,
    contact_attempts INTEGER DEFAULT 0,
    unreachable_since TIMESTAMP WITH TIME ZONE, -- When we started being unable to reach them
    
    -- Campaign Assignment
    campaign_id UUID,
    campaign_day INTEGER DEFAULT 0, -- Current day in the campaign (0, 15, 30, etc.)
    
    -- Metadata
    form_data JSONB DEFAULT '{}', -- Original form submission data
    tags TEXT[] DEFAULT '{}',
    assigned_to TEXT, -- Agent name or "AI"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON leads;
DROP POLICY IF EXISTS "Service role can manage leads" ON leads;

CREATE POLICY "Users can view their own leads" ON leads
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own leads" ON leads
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own leads" ON leads
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own leads" ON leads
    FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage leads" ON leads
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_contact ON leads(next_contact_date);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);

-- ===========================================
-- 2. CAMPAIGNS TABLE (Follow-up Sequences)
-- ===========================================
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Campaign Settings
    duration_days INTEGER DEFAULT 730, -- 2 years = 730 days
    max_attempts_per_period INTEGER DEFAULT 3, -- Max attempts before moving to next period
    unreachable_threshold_days INTEGER DEFAULT 30, -- Mark as unreachable after X days
    
    -- Schedule (JSONB array of touchpoints)
    -- Example: [{"day": 0, "channel": "whatsapp", "template": "welcome"}, {"day": 15, "channel": "email"}, {"day": 30, "channel": "call"}]
    schedule JSONB DEFAULT '[]',
    
    -- Default templates
    default_language TEXT DEFAULT 'tr',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON campaigns;

CREATE POLICY "Users can view their own campaigns" ON campaigns
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own campaigns" ON campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own campaigns" ON campaigns
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own campaigns" ON campaigns
    FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);

-- Add foreign key for leads.campaign_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'leads_campaign_id_fkey'
    ) THEN
        ALTER TABLE leads ADD CONSTRAINT leads_campaign_id_fkey 
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ===========================================
-- 3. OUTREACH TABLE (All Communication Attempts)
-- ===========================================
CREATE TABLE IF NOT EXISTS outreach (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    -- Channel & Type
    channel TEXT NOT NULL CHECK (channel IN ('call', 'whatsapp', 'email', 'sms', 'instagram_dm')),
    direction TEXT DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
    
    -- Status & Result
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'scheduled')),
    result TEXT CHECK (result IN (
        'answered_interested', 
        'answered_not_interested', 
        'answered_callback_requested',
        'answered_appointment_set',
        'no_answer', 
        'busy', 
        'voicemail', 
        'wrong_number',
        'message_sent',
        'message_delivered',
        'message_read',
        'message_replied'
    )),
    
    -- Call specific
    duration INTEGER, -- seconds
    recording_url TEXT,
    transcript TEXT,
    
    -- Message specific
    message_content TEXT,
    template_used TEXT,
    
    -- AI specific
    ai_summary TEXT,
    ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
    ai_next_action TEXT, -- Suggested next action
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- VAPI specific
    vapi_call_id TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    performed_by TEXT DEFAULT 'AI', -- 'AI' or agent name
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own outreach" ON outreach;
DROP POLICY IF EXISTS "Users can insert their own outreach" ON outreach;
DROP POLICY IF EXISTS "Users can update their own outreach" ON outreach;
DROP POLICY IF EXISTS "Service role can manage outreach" ON outreach;

CREATE POLICY "Users can view their own outreach" ON outreach
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own outreach" ON outreach
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own outreach" ON outreach
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage outreach" ON outreach
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outreach_user_id ON outreach(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_lead_id ON outreach(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_channel ON outreach(channel);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(status);
CREATE INDEX IF NOT EXISTS idx_outreach_scheduled ON outreach(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_outreach_created ON outreach(created_at DESC);

-- ===========================================
-- 4. MESSAGE_TEMPLATES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'instagram_dm', 'call_script')),
    language TEXT DEFAULT 'tr' CHECK (language IN ('tr', 'en')),
    
    -- Content
    subject TEXT, -- For emails
    content TEXT NOT NULL,
    
    -- Variables: {{name}}, {{treatment}}, etc.
    variables TEXT[] DEFAULT '{}',
    
    -- Usage
    is_active BOOLEAN DEFAULT TRUE,
    use_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own templates" ON message_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON message_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON message_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON message_templates;

CREATE POLICY "Users can view their own templates" ON message_templates
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own templates" ON message_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own templates" ON message_templates
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own templates" ON message_templates
    FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_channel ON message_templates(channel);

-- ===========================================
-- 5. AI_SETTINGS TABLE (Per-user AI configuration)
-- ===========================================
CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Company Info
    company_name TEXT DEFAULT 'Smile and Holiday',
    agent_name TEXT DEFAULT 'AI Asistan',
    
    -- Call Settings
    opening_script_tr TEXT DEFAULT 'Merhaba, ben Smile and Holiday''den arıyorum. Size Türkiye''yi neden tercih ettiğinizi sorabilir miyim?',
    opening_script_en TEXT DEFAULT 'Hello, I''m calling from Smile and Holiday. May I ask why you chose Turkey?',
    
    -- AI Behavior
    announce_ai BOOLEAN DEFAULT TRUE, -- Should AI announce it's an AI?
    persistence_level TEXT DEFAULT 'medium' CHECK (persistence_level IN ('low', 'medium', 'high')), -- How persistent on "no"
    curiosity_questions JSONB DEFAULT '["Tedavi hakkında daha fazla bilgi almak ister misiniz?", "Online doktor randevusu ayarlamamızı ister misiniz?"]',
    
    -- Goals
    primary_goal TEXT DEFAULT 'online_appointment', -- What's the main conversion goal
    
    -- Restrictions
    call_hours_start TIME DEFAULT '09:00',
    call_hours_end TIME DEFAULT '20:00',
    call_days TEXT[] DEFAULT '{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}',
    
    -- VAPI Configuration
    vapi_assistant_id TEXT,
    vapi_phone_number TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ai_settings" ON ai_settings;
DROP POLICY IF EXISTS "Users can insert their own ai_settings" ON ai_settings;
DROP POLICY IF EXISTS "Users can update their own ai_settings" ON ai_settings;

CREATE POLICY "Users can view their own ai_settings" ON ai_settings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own ai_settings" ON ai_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ai_settings" ON ai_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- ===========================================
-- 6. MESSAGES TABLE (Multi-channel messages)
-- ===========================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    outreach_id UUID REFERENCES outreach(id) ON DELETE SET NULL,
    
    -- Channel & Direction
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'instagram_dm', 'call')),
    direction TEXT DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
    
    -- Content
    recipient TEXT NOT NULL,
    subject TEXT, -- For emails
    content TEXT NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    
    -- Tracking
    read_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Service role can manage messages" ON messages;

CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own messages" ON messages
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage messages" ON messages
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 8. ONLINE_APPOINTMENTS TABLE (Goal conversions)
-- ===========================================
CREATE TABLE IF NOT EXISTS online_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    outreach_id UUID REFERENCES outreach(id) ON DELETE SET NULL,
    
    -- Appointment Details
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    doctor_name TEXT,
    treatment_type TEXT,
    
    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    
    -- Meeting Info
    meeting_link TEXT,
    meeting_platform TEXT DEFAULT 'zoom' CHECK (meeting_platform IN ('zoom', 'google_meet', 'teams', 'whatsapp_video', 'other')),
    
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE online_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own online_appointments" ON online_appointments;
DROP POLICY IF EXISTS "Users can insert their own online_appointments" ON online_appointments;
DROP POLICY IF EXISTS "Users can update their own online_appointments" ON online_appointments;

CREATE POLICY "Users can view their own online_appointments" ON online_appointments
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own online_appointments" ON online_appointments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own online_appointments" ON online_appointments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_online_appointments_user_id ON online_appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_online_appointments_lead_id ON online_appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_online_appointments_date ON online_appointments(appointment_date);

-- ===========================================
-- 9. ADD DASHBOARD_TYPE TO PROFILES
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'dashboard_type'
    ) THEN
        ALTER TABLE profiles ADD COLUMN dashboard_type TEXT DEFAULT 'inbound' 
        CHECK (dashboard_type IN ('inbound', 'outbound'));
    END IF;
END $$;

-- ===========================================
-- 10. REALTIME SETUP
-- ===========================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE outreach;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE online_appointments;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ===========================================
-- 11. UPDATED_AT TRIGGERS
-- ===========================================
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outreach_updated_at ON outreach;
CREATE TRIGGER update_outreach_updated_at
    BEFORE UPDATE ON outreach
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON message_templates;
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON ai_settings;
CREATE TRIGGER update_ai_settings_updated_at
    BEFORE UPDATE ON ai_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_online_appointments_updated_at ON online_appointments;
CREATE TRIGGER update_online_appointments_updated_at
    BEFORE UPDATE ON online_appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 12. HELPER FUNCTIONS
-- ===========================================

-- Get leads that need to be contacted today
CREATE OR REPLACE FUNCTION get_todays_outreach_leads(p_user_id UUID)
RETURNS TABLE (
    lead_id UUID,
    full_name TEXT,
    phone TEXT,
    whatsapp TEXT,
    language TEXT,
    status TEXT,
    campaign_day INTEGER,
    next_contact_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as lead_id,
        l.full_name,
        l.phone,
        l.whatsapp,
        l.language,
        l.status,
        l.campaign_day,
        l.next_contact_date
    FROM leads l
    WHERE l.user_id = p_user_id
    AND l.status NOT IN ('converted', 'lost', 'unreachable')
    AND l.next_contact_date <= NOW()
    ORDER BY l.priority DESC, l.next_contact_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get outbound stats for dashboard
CREATE OR REPLACE FUNCTION get_outbound_stats(p_user_id UUID)
RETURNS TABLE (
    total_leads BIGINT,
    new_leads BIGINT,
    contacted_leads BIGINT,
    interested_leads BIGINT,
    appointments_set BIGINT,
    converted_leads BIGINT,
    unreachable_leads BIGINT,
    todays_calls BIGINT,
    completed_calls_today BIGINT,
    conversion_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE l.status = 'new') as new_leads,
        COUNT(*) FILTER (WHERE l.status = 'contacted') as contacted_leads,
        COUNT(*) FILTER (WHERE l.status = 'interested') as interested_leads,
        COUNT(*) FILTER (WHERE l.status = 'appointment_set') as appointments_set,
        COUNT(*) FILTER (WHERE l.status = 'converted') as converted_leads,
        COUNT(*) FILTER (WHERE l.status = 'unreachable') as unreachable_leads,
        (SELECT COUNT(*) FROM outreach o WHERE o.user_id = p_user_id AND o.channel = 'call' AND DATE(o.scheduled_for) = CURRENT_DATE) as todays_calls,
        (SELECT COUNT(*) FROM outreach o WHERE o.user_id = p_user_id AND o.channel = 'call' AND DATE(o.completed_at) = CURRENT_DATE AND o.status = 'completed') as completed_calls_today,
        CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE l.status = 'converted')::NUMERIC / COUNT(*)) * 100, 2)
            ELSE 0
        END as conversion_rate
    FROM leads l
    WHERE l.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- DONE! Now create the user in Supabase Auth
-- ===========================================
-- After running this schema:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" > "Create New User"
-- 3. Email: info@smileandholiday.com
-- 4. Password: Deneme123
-- 5. Click "Create User"
-- 6. Then run the following to set their dashboard type:

-- UPDATE profiles 
-- SET dashboard_type = 'outbound', full_name = 'Smile and Holiday'
-- WHERE email = 'info@smileandholiday.com';
