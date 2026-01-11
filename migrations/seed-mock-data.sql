-- ===========================================
-- VOLINA AI - Mock Data for Outbound Dashboard
-- ===========================================
-- Run this in Supabase SQL Editor to populate mock data
-- This simulates outbound calls that were made and reached

-- First, we need to get the user ID. This script assumes you have at least one user.
-- If you want to use a specific user, replace the user_id variable below.

DO $$
DECLARE
    v_user_id UUID;
    v_campaign_id UUID;
    v_lead_ids UUID[];
    v_lead_id UUID;
    i INT;
    j INT;
    random_status TEXT;
    random_result TEXT;
    random_sentiment TEXT;
    random_duration INT;
    random_score INT;
    call_date TIMESTAMP;
    call_names TEXT[] := ARRAY[
        'Ahmet Yılmaz', 'Mehmet Demir', 'Ayşe Kaya', 'Fatma Çelik', 'Ali Öztürk',
        'Zeynep Arslan', 'Mustafa Şahin', 'Elif Aydın', 'Hüseyin Koç', 'Hatice Yıldız',
        'Emre Polat', 'Selin Aktaş', 'Oğuz Erdem', 'Deniz Korkmaz', 'Burak Özkan',
        'Ceren Güneş', 'Kaan Yavuz', 'Esra Taş', 'Murat Aksoy', 'Gizem Sarı',
        'John Smith', 'Emily Johnson', 'Michael Brown', 'Sarah Davis', 'David Wilson',
        'Emma Martinez', 'James Anderson', 'Olivia Taylor', 'Robert Thomas', 'Sophia Moore'
    ];
    call_phones TEXT[] := ARRAY[
        '+905551234501', '+905551234502', '+905551234503', '+905551234504', '+905551234505',
        '+905551234506', '+905551234507', '+905551234508', '+905551234509', '+905551234510',
        '+905551234511', '+905551234512', '+905551234513', '+905551234514', '+905551234515',
        '+905551234516', '+905551234517', '+905551234518', '+905551234519', '+905551234520',
        '+447551234501', '+447551234502', '+447551234503', '+447551234504', '+447551234505',
        '+447551234506', '+447551234507', '+447551234508', '+447551234509', '+447551234510'
    ];
    treatments TEXT[] := ARRAY[
        'Diş İmplantı', 'Saç Ekimi', 'Burun Estetiği', 'Göz Kapağı', 'Yüz Germe',
        'Dental Veneers', 'Hair Transplant', 'Rhinoplasty', 'Blepharoplasty', 'Facelift',
        'Hollywood Smile', 'Zirkonyum', 'Diş Beyazlatma', 'All-on-4', 'All-on-6'
    ];
    sources TEXT[] := ARRAY['web_form', 'instagram', 'referral', 'facebook', 'google_ads'];
    summaries_tr TEXT[] := ARRAY[
        'Hasta diş implantı fiyatları hakkında bilgi aldı. Online randevu için istekli.',
        'Saç ekimi prosedürü detaylı anlatıldı. 3 ay sonra Türkiye''ye gelmek istiyor.',
        'Hollywood Smile paketimiz hakkında bilgi verildi. Fotoğraf göndermesini bekleyeceğiz.',
        'Burun estetiği öncesi konsültasyon istedi. Online doktor görüşmesi ayarlandı.',
        'Fiyat teklifimizi değerlendirecek. Hafta sonuna kadar dönüş yapacak.',
        'Tedavi planı gönderildi. Çok ilgili, ailesine danışacak.',
        'All-on-4 implant tedavisi için hazır. Randevu tarihi belirlendi.',
        'Bütçe konusunda tereddütlü. Taksit seçenekleri sunuldu.',
        'Daha önce başka klinikten teklif almış. Fiyatlarımız daha uygun.',
        'Hemen gelmek istiyor. Acil randevu ayarlandı.'
    ];
    summaries_en TEXT[] := ARRAY[
        'Patient inquired about dental implant prices. Willing to schedule online consultation.',
        'Hair transplant procedure explained in detail. Wants to visit Turkey in 3 months.',
        'Provided information about Hollywood Smile package. Waiting for photos.',
        'Requested pre-rhinoplasty consultation. Online doctor meeting scheduled.',
        'Will evaluate our price quote. Will respond by weekend.',
        'Treatment plan sent. Very interested, will consult with family.',
        'Ready for All-on-4 implant treatment. Appointment date set.',
        'Hesitant about budget. Installment options presented.',
        'Got quote from another clinic before. Our prices are better.',
        'Wants to come immediately. Urgent appointment scheduled.'
    ];
    evaluations_tr TEXT[] := ARRAY[
        'Yüksek ilgi. Hemen takip edilmeli. Online randevu için çok istekli.',
        'Orta ilgi. Fiyat karşılaştırması yapıyor. 2 gün içinde takip önerilir.',
        'Çok ilgili hasta. Tedavi planı istedi. Öncelikli takip.',
        'Düşük ilgi. Sadece fiyat sorguluyor. Standart takip yeterli.',
        'Sıcak lead. Aile onayı bekliyor. 3 gün sonra aranmalı.',
        'Çok motive. Tarih belirleme aşamasında. Bugün takip et.',
        'Bütçe sıkıntısı var. Taksit planı ile ikna edilebilir.',
        'Rakip klinik ile karşılaştırıyor. Avantajlarımız anlatıldı.',
        'Acil hasta. 1 hafta içinde gelmek istiyor. Öncelikli.',
        'İlgili ama kararsız. Detaylı bilgi paketi gönderilmeli.'
    ];
BEGIN
    -- Get the first user
    SELECT id INTO v_user_id FROM profiles ORDER BY created_at LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found. Please create a user first.';
    END IF;

    -- Clean existing mock data (optional - comment out if you want to keep existing data)
    DELETE FROM online_appointments WHERE user_id = v_user_id;
    DELETE FROM outreach WHERE user_id = v_user_id;
    DELETE FROM messages WHERE user_id = v_user_id;
    DELETE FROM message_templates WHERE user_id = v_user_id;
    DELETE FROM calls WHERE user_id = v_user_id;
    DELETE FROM leads WHERE user_id = v_user_id;
    DELETE FROM campaigns WHERE user_id = v_user_id;

    -- Create a campaign
    INSERT INTO campaigns (id, user_id, name, description, is_active, duration_days, schedule, default_language)
    VALUES (
        uuid_generate_v4(),
        v_user_id,
        'Medical Tourism 2024',
        'Ana satış kampanyası - Diş ve estetik tedavileri',
        true,
        730,
        '[{"day": 0, "channel": "call", "description": "İlk arama"}, {"day": 1, "channel": "whatsapp", "description": "Takip mesajı"}, {"day": 7, "channel": "call", "description": "Haftalık takip"}, {"day": 15, "channel": "email", "description": "Bilgi paketi"}]'::jsonb,
        'tr'
    )
    RETURNING id INTO v_campaign_id;

    -- Insert leads with various statuses
    FOR i IN 1..30 LOOP
        -- Determine status distribution: more in early stages
        CASE 
            WHEN i <= 8 THEN random_status := 'new';
            WHEN i <= 14 THEN random_status := 'contacted';
            WHEN i <= 20 THEN random_status := 'interested';
            WHEN i <= 24 THEN random_status := 'appointment_set';
            WHEN i <= 27 THEN random_status := 'converted';
            WHEN i <= 29 THEN random_status := 'unreachable';
            ELSE random_status := 'lost';
        END CASE;

        INSERT INTO leads (
            id, user_id, full_name, email, phone, whatsapp, instagram,
            language, source, treatment_interest, notes, status, priority,
            first_contact_date, last_contact_date, next_contact_date,
            contact_attempts, campaign_id, campaign_day, assigned_to, created_at
        )
        VALUES (
            uuid_generate_v4(),
            v_user_id,
            call_names[i],
            LOWER(REPLACE(call_names[i], ' ', '.')) || '@email.com',
            call_phones[i],
            call_phones[i],
            CASE WHEN random() > 0.5 THEN '@' || LOWER(REPLACE(call_names[i], ' ', '_')) ELSE NULL END,
            CASE WHEN i <= 20 THEN 'tr' ELSE 'en' END,
            sources[1 + floor(random() * 5)::int],
            treatments[1 + floor(random() * 15)::int],
            CASE WHEN random() > 0.3 THEN 'Lead ' || call_names[i] || ' için notlar.' ELSE NULL END,
            random_status,
            CASE WHEN random() < 0.3 THEN 'high' WHEN random() < 0.6 THEN 'medium' ELSE 'low' END,
            NOW() - (random() * INTERVAL '30 days'),
            NOW() - (random() * INTERVAL '7 days'),
            CASE WHEN random_status IN ('new', 'contacted', 'interested') THEN NOW() + (random() * INTERVAL '3 days') ELSE NULL END,
            floor(random() * 5)::int,
            v_campaign_id,
            CASE 
                WHEN random_status = 'new' THEN 0
                WHEN random_status = 'contacted' THEN 1
                WHEN random_status = 'interested' THEN 7
                ELSE 15
            END,
            'AI Asistan',
            NOW() - (random() * INTERVAL '60 days')
        )
        RETURNING id INTO v_lead_id;
        
        v_lead_ids := array_append(v_lead_ids, v_lead_id);
    END LOOP;

    -- Insert calls with realistic data (simulating completed outbound calls)
    FOR i IN 1..50 LOOP
        -- Random call outcome
        CASE floor(random() * 10)::int
            WHEN 0, 1, 2 THEN 
                random_sentiment := 'positive';
                random_duration := 120 + floor(random() * 300)::int; -- 2-7 minutes
                random_score := 7 + floor(random() * 4)::int; -- 7-10
            WHEN 3, 4, 5 THEN
                random_sentiment := 'neutral';
                random_duration := 60 + floor(random() * 180)::int; -- 1-4 minutes  
                random_score := 4 + floor(random() * 4)::int; -- 4-7
            WHEN 6, 7 THEN
                random_sentiment := 'negative';
                random_duration := 30 + floor(random() * 90)::int; -- 0.5-2 minutes
                random_score := 1 + floor(random() * 4)::int; -- 1-4
            ELSE
                random_sentiment := 'neutral';
                random_duration := 0; -- No answer
                random_score := NULL;
        END CASE;

        -- Distribute calls over the past 30 days, more recent = more calls
        call_date := NOW() - ((30 - (i::float / 50 * 30)) * INTERVAL '1 day') + (random() * INTERVAL '12 hours');

        INSERT INTO calls (
            user_id, vapi_call_id, recording_url, transcript, summary, sentiment,
            duration, type, caller_phone, caller_name, 
            evaluation_summary, evaluation_score, metadata, created_at
        )
        VALUES (
            v_user_id,
            'mock_call_' || i || '_' || extract(epoch from NOW())::text,
            CASE WHEN random_duration > 0 THEN 'https://storage.vapi.ai/mock-recording-' || i || '.mp3' ELSE NULL END,
            CASE WHEN random_duration > 60 THEN 'Merhaba, ben Volina AI asistanınızım. Size nasıl yardımcı olabilirim? [Transkript devamı...]' ELSE NULL END,
            CASE 
                WHEN i <= 20 THEN summaries_tr[1 + floor(random() * 10)::int]
                ELSE summaries_en[1 + floor(random() * 10)::int]
            END,
            random_sentiment,
            random_duration,
            CASE 
                WHEN random_score >= 7 THEN 'appointment'
                WHEN random_score >= 4 THEN 'inquiry'
                WHEN random_score >= 1 THEN 'follow_up'
                ELSE 'inquiry'
            END,
            call_phones[1 + floor(random() * 30)::int],
            call_names[1 + floor(random() * 30)::int],
            CASE WHEN random_score IS NOT NULL THEN evaluations_tr[1 + floor(random() * 10)::int] ELSE NULL END,
            random_score,
            jsonb_build_object(
                'appointmentBooked', random_score >= 8,
                'callbackRequested', random_score BETWEEN 5 AND 7,
                'source', 'outbound_campaign'
            ),
            call_date
        );
    END LOOP;

    -- Insert outreach records (call attempts + results)
    FOR i IN 1..40 LOOP
        -- Random outreach result
        CASE floor(random() * 12)::int
            WHEN 0, 1, 2 THEN random_result := 'answered_interested';
            WHEN 3 THEN random_result := 'answered_appointment_set';
            WHEN 4, 5 THEN random_result := 'answered_not_interested';
            WHEN 6 THEN random_result := 'answered_callback_requested';
            WHEN 7, 8 THEN random_result := 'no_answer';
            WHEN 9 THEN random_result := 'busy';
            WHEN 10 THEN random_result := 'voicemail';
            ELSE random_result := 'message_sent';
        END CASE;

        random_sentiment := CASE 
            WHEN random_result IN ('answered_interested', 'answered_appointment_set') THEN 'positive'
            WHEN random_result = 'answered_not_interested' THEN 'negative'
            ELSE 'neutral'
        END;

        random_duration := CASE
            WHEN random_result LIKE 'answered%' THEN 60 + floor(random() * 300)::int
            ELSE 0
        END;

        call_date := NOW() - (random() * INTERVAL '30 days');

        INSERT INTO outreach (
            user_id, lead_id, campaign_id, channel, direction, status, result,
            duration, recording_url, transcript, ai_summary, ai_sentiment, ai_next_action,
            scheduled_for, completed_at, vapi_call_id, notes, performed_by, created_at
        )
        VALUES (
            v_user_id,
            v_lead_ids[1 + floor(random() * 30)::int],
            v_campaign_id,
            CASE WHEN floor(random() * 10)::int < 7 THEN 'call' ELSE 'whatsapp' END,
            'outbound',
            'completed',
            random_result,
            random_duration,
            CASE WHEN random_duration > 0 THEN 'https://storage.vapi.ai/outreach-' || i || '.mp3' ELSE NULL END,
            CASE WHEN random_duration > 60 THEN 'Merhaba, Smile and Holiday''den arıyorum...' ELSE NULL END,
            CASE WHEN random_duration > 0 THEN summaries_tr[1 + floor(random() * 10)::int] ELSE NULL END,
            random_sentiment,
            CASE 
                WHEN random_result = 'answered_interested' THEN 'Tedavi planı gönder'
                WHEN random_result = 'answered_callback_requested' THEN '2 gün sonra tekrar ara'
                WHEN random_result = 'no_answer' THEN 'Yarın tekrar dene'
                ELSE NULL
            END,
            call_date - INTERVAL '1 hour',
            call_date,
            'outreach_' || i || '_' || extract(epoch from NOW())::text,
            CASE WHEN random() > 0.5 THEN 'Müşteri ' || CASE WHEN random_result LIKE 'answered%' THEN 'görüşme yapıldı' ELSE 'ulaşılamadı' END ELSE NULL END,
            'AI Asistan',
            call_date
        );
    END LOOP;

    -- Insert messages for each channel (WhatsApp, Email, SMS, Instagram DM)
    -- WhatsApp messages (15)
    FOR i IN 1..15 LOOP
        INSERT INTO messages (
            user_id, lead_id, channel, direction, recipient, subject, content, status, 
            read_at, replied_at, created_at
        )
        VALUES (
            v_user_id,
            v_lead_ids[1 + floor(random() * 30)::int],
            'whatsapp',
            CASE WHEN floor(random() * 5)::int = 0 THEN 'inbound' ELSE 'outbound' END,
            call_phones[1 + floor(random() * 30)::int],
            NULL,
            CASE floor(random() * 8)::int
                WHEN 0 THEN 'Merhaba! 👋 Smile and Holiday''den arıyoruz. Tedavi planınız hazır.'
                WHEN 1 THEN 'İyi günler! Size özel fiyat teklifimizi paylaşmak istiyoruz. 💰'
                WHEN 2 THEN 'Randevunuz için onay bekliyoruz. Tarihi uygun mu? 📅'
                WHEN 3 THEN 'Tedavi hakkında sorularınız varsa yanıtlamaktan memnuniyet duyarız. 😊'
                WHEN 4 THEN 'Takip mesajımızdır. Kararınızı merak ediyoruz. 🤔'
                WHEN 5 THEN 'Merhaba! Daha önce görüştüğümüz tedavi konusunda bilgi almak ister misiniz?'
                WHEN 6 THEN 'Kampanyamızdan yararlanmak için son 3 gün! 🎉'
                ELSE 'Online randevunuz yarın saat 14:00''da. Hatırlatma mesajı. ⏰'
            END,
            CASE floor(random() * 4)::int WHEN 0 THEN 'pending' WHEN 1 THEN 'sent' ELSE 'delivered' END,
            CASE WHEN random() > 0.4 THEN NOW() - (random() * INTERVAL '5 days') ELSE NULL END,
            CASE WHEN random() > 0.7 THEN NOW() - (random() * INTERVAL '3 days') ELSE NULL END,
            NOW() - (random() * INTERVAL '30 days')
        );
    END LOOP;
    
    -- Email messages (15)
    FOR i IN 1..15 LOOP
        INSERT INTO messages (
            user_id, lead_id, channel, direction, recipient, subject, content, status, 
            read_at, replied_at, created_at
        )
        VALUES (
            v_user_id,
            v_lead_ids[1 + floor(random() * 30)::int],
            'email',
            CASE WHEN floor(random() * 5)::int = 0 THEN 'inbound' ELSE 'outbound' END,
            LOWER(REPLACE(call_names[1 + floor(random() * 30)::int], ' ', '.')) || '@email.com',
            'Tedavi Planınız - ' || treatments[1 + floor(random() * 15)::int],
            CASE floor(random() * 5)::int
                WHEN 0 THEN 'Değerli hastamız, tedavi planınız ekte yer almaktadır. Detayları incelemenizi rica ederiz.'
                WHEN 1 THEN 'Size özel hazırladığımız fiyat teklifini ekte bulabilirsiniz.'
                WHEN 2 THEN 'Randevu talebiniz alınmıştır. Onay için lütfen yanıt verin.'
                WHEN 3 THEN 'Sağlık turizmi hakkında bilgilendirme dosyamız ektedir.'
                ELSE 'Hollywood Smile tedavisi hakkında detaylı bilgi için tıklayın.'
            END,
            CASE floor(random() * 4)::int WHEN 0 THEN 'pending' WHEN 1 THEN 'sent' ELSE 'delivered' END,
            CASE WHEN random() > 0.4 THEN NOW() - (random() * INTERVAL '5 days') ELSE NULL END,
            CASE WHEN random() > 0.7 THEN NOW() - (random() * INTERVAL '3 days') ELSE NULL END,
            NOW() - (random() * INTERVAL '30 days')
        );
    END LOOP;
    
    -- SMS messages (15)
    FOR i IN 1..15 LOOP
        INSERT INTO messages (
            user_id, lead_id, channel, direction, recipient, subject, content, status, 
            read_at, replied_at, created_at
        )
        VALUES (
            v_user_id,
            v_lead_ids[1 + floor(random() * 30)::int],
            'sms',
            CASE WHEN floor(random() * 5)::int = 0 THEN 'inbound' ELSE 'outbound' END,
            call_phones[1 + floor(random() * 30)::int],
            NULL,
            CASE floor(random() * 4)::int
                WHEN 0 THEN 'Smile and Holiday: Randevunuz 15 Ocak 14:00. Onay için 1 yanıtlayın.'
                WHEN 1 THEN 'Tedavi fiyat teklifiniz hazır. Detaylar WhatsApp''tan gönderildi.'
                WHEN 2 THEN 'Hatırlatma: Online görüşmeniz yarın!'
                ELSE 'Smile and Holiday''e hoşgeldiniz. Size nasıl yardımcı olabiliriz?'
            END,
            CASE floor(random() * 4)::int WHEN 0 THEN 'pending' WHEN 1 THEN 'sent' ELSE 'delivered' END,
            CASE WHEN random() > 0.4 THEN NOW() - (random() * INTERVAL '5 days') ELSE NULL END,
            CASE WHEN random() > 0.7 THEN NOW() - (random() * INTERVAL '3 days') ELSE NULL END,
            NOW() - (random() * INTERVAL '30 days')
        );
    END LOOP;
    
    -- Instagram DM messages (15)
    FOR i IN 1..15 LOOP
        INSERT INTO messages (
            user_id, lead_id, channel, direction, recipient, subject, content, status, 
            read_at, replied_at, created_at
        )
        VALUES (
            v_user_id,
            v_lead_ids[1 + floor(random() * 30)::int],
            'instagram_dm',
            CASE WHEN floor(random() * 5)::int = 0 THEN 'inbound' ELSE 'outbound' END,
            '@' || LOWER(REPLACE(call_names[1 + floor(random() * 30)::int], ' ', '_')),
            NULL,
            CASE floor(random() * 4)::int
                WHEN 0 THEN 'Merhaba! DM''iniz için teşekkürler 🙏 Size yardımcı olmak isteriz.'
                WHEN 1 THEN 'Profilimizdeki highlight''lardan tedavi öncesi-sonrası görsellere ulaşabilirsiniz!'
                WHEN 2 THEN 'Ücretsiz online konsültasyon için bize yazın ✨'
                ELSE 'Tedavi sürecinizle ilgili sorularınızı yanıtlamaktan mutluluk duyarız 😊'
            END,
            CASE floor(random() * 4)::int WHEN 0 THEN 'pending' WHEN 1 THEN 'sent' ELSE 'delivered' END,
            CASE WHEN random() > 0.4 THEN NOW() - (random() * INTERVAL '5 days') ELSE NULL END,
            CASE WHEN random() > 0.7 THEN NOW() - (random() * INTERVAL '3 days') ELSE NULL END,
            NOW() - (random() * INTERVAL '30 days')
        );
    END LOOP;
    
    -- Insert message templates
    INSERT INTO message_templates (user_id, name, channel, language, subject, content, variables, is_active, use_count) VALUES
    (v_user_id, 'Hoş Geldiniz', 'whatsapp', 'tr', NULL, 'Merhaba {{name}}! 👋 Smile and Holiday ailesine hoş geldiniz. Size nasıl yardımcı olabiliriz?', ARRAY['name'], true, 45),
    (v_user_id, 'Fiyat Teklifi', 'whatsapp', 'tr', NULL, 'Merhaba {{name}}, {{treatment}} için hazırladığımız özel fiyat teklifimiz: {{price}}. Detaylar için arayabilir misiniz?', ARRAY['name', 'treatment', 'price'], true, 32),
    (v_user_id, 'Randevu Hatırlatma', 'whatsapp', 'tr', NULL, '⏰ Randevu Hatırlatma: Sayın {{name}}, {{date}} tarihli online görüşmeniz için hazır mısınız?', ARRAY['name', 'date'], true, 28),
    (v_user_id, 'Tedavi Bilgi Paketi', 'email', 'tr', '{{treatment}} Tedavisi Hakkında Detaylı Bilgi', 'Sayın {{name}},\n\n{{treatment}} tedavisi hakkında hazırladığımız bilgi paketini ekte bulabilirsiniz.\n\nSorularınız için bize ulaşmaktan çekinmeyin.\n\nSaygılarımızla,\nSmile and Holiday', ARRAY['name', 'treatment'], true, 22),
    (v_user_id, 'Welcome Message', 'whatsapp', 'en', NULL, 'Hello {{name}}! 👋 Welcome to Smile and Holiday. How can we help you today?', ARRAY['name'], true, 18),
    (v_user_id, 'Follow-up', 'whatsapp', 'tr', NULL, 'Merhaba {{name}}, geçen görüşmemizin ardından düşündünüz mü? Size yardımcı olabilecek başka bilgi var mı?', ARRAY['name'], true, 35),
    (v_user_id, 'SMS Randevu Onay', 'sms', 'tr', NULL, 'Smile and Holiday: {{date}} tarihli randevunuz için onay bekliyoruz. Onay için 1, iptal için 2 yanıtlayın.', ARRAY['date'], true, 15),
    (v_user_id, 'Instagram DM Response', 'instagram_dm', 'tr', NULL, 'Merhaba! 🙏 Mesajınız için teşekkürler. {{treatment}} hakkında size özel bilgi göndermemi ister misiniz?', ARRAY['treatment'], true, 12);

    -- Insert online appointments (conversions)
    FOR i IN 1..8 LOOP
        INSERT INTO online_appointments (
            user_id, lead_id, appointment_date, doctor_name, treatment_type,
            status, meeting_link, meeting_platform, notes, created_at
        )
        VALUES (
            v_user_id,
            v_lead_ids[20 + i], -- Use leads that have appointment_set or converted status
            NOW() + ((i * 3) * INTERVAL '1 day') + (random() * INTERVAL '8 hours'),
            CASE floor(random() * 4)::int
                WHEN 0 THEN 'Dr. Ahmet Yılmaz'
                WHEN 1 THEN 'Dr. Ayşe Demir'
                WHEN 2 THEN 'Dr. Mehmet Kaya'
                ELSE 'Dr. Zeynep Öztürk'
            END,
            treatments[1 + floor(random() * 15)::int],
            CASE floor(random() * 5)::int
                WHEN 0 THEN 'scheduled'
                WHEN 1 THEN 'confirmed'
                WHEN 2 THEN 'completed'
                ELSE 'scheduled'
            END,
            'https://meet.google.com/abc-defg-' || i,
            CASE floor(random() * 3)::int
                WHEN 0 THEN 'zoom'
                WHEN 1 THEN 'google_meet'
                ELSE 'whatsapp_video'
            END,
            'Online konsültasyon - ' || treatments[1 + floor(random() * 10)::int],
            NOW() - (random() * INTERVAL '14 days')
        );
    END LOOP;

    -- Update AI settings for the user
    INSERT INTO ai_settings (
        user_id, company_name, agent_name, 
        opening_script_tr, opening_script_en,
        announce_ai, persistence_level, primary_goal,
        call_hours_start, call_hours_end
    )
    VALUES (
        v_user_id,
        'Smile and Holiday',
        'Volina AI Asistan',
        'Merhaba! Ben Smile and Holiday''den arıyorum. Sağlık turizmimiz hakkında size bilgi vermek istiyorum. Uygun musunuz?',
        'Hello! I am calling from Smile and Holiday. I would like to share information about our medical tourism services. Is this a good time?',
        true,
        'medium',
        'online_appointment',
        '09:00',
        '20:00'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        agent_name = EXCLUDED.agent_name,
        updated_at = NOW();

    RAISE NOTICE 'Mock data created successfully for user %', v_user_id;
    RAISE NOTICE 'Created: 30 leads, 50 calls, 40 outreach records, 60 messages, 8 templates, 8 appointments';
END $$;

-- Verify the data
SELECT 'Leads' as table_name, count(*) as count FROM leads
UNION ALL
SELECT 'Calls', count(*) FROM calls
UNION ALL
SELECT 'Outreach', count(*) FROM outreach
UNION ALL
SELECT 'Messages', count(*) FROM messages
UNION ALL
SELECT 'Message Templates', count(*) FROM message_templates
UNION ALL
SELECT 'Online Appointments', count(*) FROM online_appointments
UNION ALL
SELECT 'Campaigns', count(*) FROM campaigns;

