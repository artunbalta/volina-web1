-- ===========================================
-- VOLINA AI - Seed Data
-- ===========================================
-- Run this AFTER schema.sql and AFTER creating users in Supabase Auth

-- ===========================================
-- INSTRUCTIONS:
-- 1. First, create users in Supabase Dashboard > Authentication > Users:
--    - artunbalta1@gmail.com (password: Ardu0307)
--    - admin@volina.online (password: Volina1313.)
-- 2. Get the UUID of each user from the Users table
-- 3. Replace the UUIDs below with the actual UUIDs
-- 4. Run this script in the SQL Editor
-- ===========================================

-- Replace these with actual user UUIDs from auth.users
-- After creating users, find their IDs in Supabase Dashboard > Authentication > Users
DO $$
DECLARE
    artun_user_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get user IDs from auth.users table
    SELECT id INTO artun_user_id FROM auth.users WHERE email = 'artunbalta1@gmail.com' LIMIT 1;
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@volina.online' LIMIT 1;
    
    -- Update profiles with full names
    UPDATE profiles SET full_name = 'Artun Balta' WHERE id = artun_user_id;
    UPDATE profiles SET full_name = 'Volina Admin', role = 'admin' WHERE id = admin_user_id;
    
    -- ===========================================
    -- SEED DATA FOR admin@volina.online ONLY
    -- (artunbalta1@gmail.com will have real data from VAPI)
    -- ===========================================
    
    IF admin_user_id IS NOT NULL THEN
        -- Insert demo doctors for admin user
        INSERT INTO doctors (id, user_id, name, specialty, color_code, email, phone) VALUES
            ('d1a2b3c4-5678-90ab-cdef-111111111111', admin_user_id, 'Sarah Chen', 'Sales', '#0055FF', 'sarah.chen@volina.ai', '+1 (555) 123-4567'),
            ('d1a2b3c4-5678-90ab-cdef-222222222222', admin_user_id, 'Michael Torres', 'Support', '#10B981', 'michael.torres@volina.ai', '+1 (555) 234-5678'),
            ('d1a2b3c4-5678-90ab-cdef-333333333333', admin_user_id, 'Emily Watson', 'Consulting', '#F59E0B', 'emily.watson@volina.ai', '+1 (555) 345-6789')
        ON CONFLICT DO NOTHING;
        
        -- Insert demo appointments for admin user
        INSERT INTO appointments (user_id, doctor_id, patient_name, patient_phone, start_time, end_time, status, created_via_ai) VALUES
            -- Dr. Sarah Chen appointments
            (admin_user_id, 'd1a2b3c4-5678-90ab-cdef-111111111111', 'John Smith', '+1 (555) 111-0001', NOW()::date + INTERVAL '9 hours', NOW()::date + INTERVAL '9 hours 30 minutes', 'scheduled', false),
            (admin_user_id, 'd1a2b3c4-5678-90ab-cdef-111111111111', 'Maria Garcia', '+1 (555) 111-0002', NOW()::date + INTERVAL '10 hours', NOW()::date + INTERVAL '10 hours 30 minutes', 'confirmed', true),
            (admin_user_id, 'd1a2b3c4-5678-90ab-cdef-111111111111', 'Robert Johnson', '+1 (555) 111-0003', NOW()::date + INTERVAL '14 hours', NOW()::date + INTERVAL '14 hours 30 minutes', 'scheduled', true),
            
            -- Dr. Michael Torres appointments
            (admin_user_id, 'd1a2b3c4-5678-90ab-cdef-222222222222', 'Lisa Anderson', '+1 (555) 222-0001', NOW()::date + INTERVAL '11 hours', NOW()::date + INTERVAL '11 hours 30 minutes', 'scheduled', false),
            (admin_user_id, 'd1a2b3c4-5678-90ab-cdef-222222222222', 'David Wilson', '+1 (555) 222-0002', NOW()::date + INTERVAL '15 hours', NOW()::date + INTERVAL '15 hours 30 minutes', 'confirmed', true),
            
            -- Dr. Emily Watson appointments
            (admin_user_id, 'd1a2b3c4-5678-90ab-cdef-333333333333', 'Jennifer Brown', '+1 (555) 333-0001', NOW()::date + INTERVAL '9 hours 30 minutes', NOW()::date + INTERVAL '10 hours', 'scheduled', true),
            (admin_user_id, 'd1a2b3c4-5678-90ab-cdef-333333333333', 'Chris Martinez', '+1 (555) 333-0002', NOW()::date + INTERVAL '13 hours', NOW()::date + INTERVAL '13 hours 30 minutes', 'scheduled', false)
        ON CONFLICT DO NOTHING;
        
        -- Insert demo calls for admin user
        INSERT INTO calls (user_id, vapi_call_id, recording_url, transcript, summary, sentiment, duration, type, caller_phone) VALUES
            (admin_user_id, 'vapi_demo_001', 'https://api.vapi.ai/recordings/sample1.mp3', 
             'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: Hi, I''d like to schedule an appointment with Sarah.\nAgent: Of course! I have availability tomorrow at 9 AM or 2 PM. Which works better for you?\nCaller: 9 AM works great.\nAgent: Perfect! I''ve scheduled your appointment with Sarah Chen for tomorrow at 9 AM. You''ll receive a confirmation shortly.',
             'Patient scheduled a sales consultation with Sarah Chen for 9 AM tomorrow.',
             'positive', 145, 'appointment', '+1 (555) 111-0002'),
            
            (admin_user_id, 'vapi_demo_002', 'https://api.vapi.ai/recordings/sample2.mp3',
             'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I have a question about your services.\nAgent: Of course! What would you like to know?\nCaller: What are your operating hours?\nAgent: We''re open Monday to Friday, 9 AM to 6 PM. Is there anything else I can help with?\nCaller: No, that''s all. Thank you!',
             'Customer inquired about operating hours and service availability.',
             'neutral', 98, 'inquiry', '+1 (555) 444-5555'),
            
            (admin_user_id, 'vapi_demo_003', 'https://api.vapi.ai/recordings/sample3.mp3',
             'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I need to see a consultant as soon as possible.\nAgent: I can help with that. Emily Watson has an opening today at 1 PM. Would that work?\nCaller: Yes, that''s perfect!\nAgent: Great! I''ve booked your appointment with Emily Watson for 1 PM today.',
             'Urgent consultation scheduled with Emily Watson for same day.',
             'positive', 112, 'appointment', '+1 (555) 333-0002'),
            
            (admin_user_id, 'vapi_demo_004', 'https://api.vapi.ai/recordings/sample4.mp3',
             'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I need to cancel my appointment.\nAgent: I understand. Can you provide your name and appointment date?\nCaller: John Smith, tomorrow at 3 PM.\nAgent: I''ve cancelled your appointment. Would you like to reschedule?\nCaller: No, I''ll call back later.',
             'Customer John Smith cancelled their appointment scheduled for tomorrow.',
             'neutral', 87, 'cancellation', '+1 (555) 111-0001'),
            
            (admin_user_id, 'vapi_demo_005', 'https://api.vapi.ai/recordings/sample5.mp3',
             'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: I want to book with Michael for support.\nAgent: Michael Torres is available this Thursday at 11 AM.\nCaller: That works for me.\nAgent: Wonderful! Your support session with Michael Torres is confirmed for Thursday at 11 AM.',
             'Support session booked with Michael Torres for consultation.',
             'positive', 134, 'appointment', '+1 (555) 222-0001'),
            
            (admin_user_id, 'vapi_demo_006', 'https://api.vapi.ai/recordings/sample6.mp3',
             'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: Just following up on my previous consultation.\nAgent: Of course! Let me pull up your records. How can I assist you with your follow-up?\nCaller: I wanted to schedule another meeting.\nAgent: I can help with that. When would work best for you?',
             'Follow-up call regarding previous consultation.',
             'positive', 156, 'follow_up', '+1 (555) 666-7777'),
            
            (admin_user_id, 'vapi_demo_007', 'https://api.vapi.ai/recordings/sample7.mp3',
             'Agent: Hello, this is Volina AI. How can I help you today?\nCaller: What services do you offer?\nAgent: We offer sales consultations, technical support, and business consulting. Would you like more details on any specific service?\nCaller: Tell me more about consulting.\nAgent: Our consulting services include strategy sessions, project planning, and business optimization.',
             'Customer inquired about consulting services offered.',
             'neutral', 189, 'inquiry', '+1 (555) 888-9999')
        ON CONFLICT DO NOTHING;
        
        -- Add some historical calls (past dates) for better demo charts
        INSERT INTO calls (user_id, vapi_call_id, transcript, summary, sentiment, duration, type, caller_phone, created_at) VALUES
            (admin_user_id, 'vapi_demo_hist_001', 'Sample historical call', 'Appointment scheduled', 'positive', 120, 'appointment', '+1 (555) 100-0001', NOW() - INTERVAL '1 day'),
            (admin_user_id, 'vapi_demo_hist_002', 'Sample historical call', 'Inquiry about services', 'neutral', 90, 'inquiry', '+1 (555) 100-0002', NOW() - INTERVAL '1 day'),
            (admin_user_id, 'vapi_demo_hist_003', 'Sample historical call', 'Appointment scheduled', 'positive', 150, 'appointment', '+1 (555) 100-0003', NOW() - INTERVAL '2 days'),
            (admin_user_id, 'vapi_demo_hist_004', 'Sample historical call', 'Support follow-up', 'positive', 110, 'follow_up', '+1 (555) 100-0004', NOW() - INTERVAL '2 days'),
            (admin_user_id, 'vapi_demo_hist_005', 'Sample historical call', 'Cancellation request', 'neutral', 75, 'cancellation', '+1 (555) 100-0005', NOW() - INTERVAL '3 days'),
            (admin_user_id, 'vapi_demo_hist_006', 'Sample historical call', 'Appointment scheduled', 'positive', 130, 'appointment', '+1 (555) 100-0006', NOW() - INTERVAL '3 days'),
            (admin_user_id, 'vapi_demo_hist_007', 'Sample historical call', 'Inquiry call', 'neutral', 95, 'inquiry', '+1 (555) 100-0007', NOW() - INTERVAL '4 days'),
            (admin_user_id, 'vapi_demo_hist_008', 'Sample historical call', 'Appointment scheduled', 'positive', 140, 'appointment', '+1 (555) 100-0008', NOW() - INTERVAL '4 days'),
            (admin_user_id, 'vapi_demo_hist_009', 'Sample historical call', 'Negative experience', 'negative', 200, 'inquiry', '+1 (555) 100-0009', NOW() - INTERVAL '5 days'),
            (admin_user_id, 'vapi_demo_hist_010', 'Sample historical call', 'Appointment scheduled', 'positive', 125, 'appointment', '+1 (555) 100-0010', NOW() - INTERVAL '5 days'),
            (admin_user_id, 'vapi_demo_hist_011', 'Sample historical call', 'Follow-up call', 'positive', 115, 'follow_up', '+1 (555) 100-0011', NOW() - INTERVAL '6 days'),
            (admin_user_id, 'vapi_demo_hist_012', 'Sample historical call', 'Appointment scheduled', 'positive', 135, 'appointment', '+1 (555) 100-0012', NOW() - INTERVAL '6 days')
        ON CONFLICT DO NOTHING;
    END IF;
    
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE 'Artun user ID: %', artun_user_id;
    RAISE NOTICE 'Admin user ID: %', admin_user_id;
END $$;
