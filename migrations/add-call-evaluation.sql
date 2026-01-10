-- ===========================================
-- Add Call Evaluation Fields to Calls Table
-- ===========================================
-- Run this ONCE in Supabase SQL Editor
-- After this, the app will auto-seed data when needed

-- Step 1: Add new columns for caller info and evaluation
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_summary TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_score INTEGER;

-- Add check constraint for score (0-10)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'calls' AND constraint_name = 'calls_evaluation_score_check'
    ) THEN
        ALTER TABLE calls ADD CONSTRAINT calls_evaluation_score_check 
        CHECK (evaluation_score >= 0 AND evaluation_score <= 10);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Step 2: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_calls_evaluation_score ON calls(evaluation_score);
CREATE INDEX IF NOT EXISTS idx_calls_caller_name ON calls(caller_name);

-- Step 3: Create RPC function for auto-setup (allows app to add columns if missing)
CREATE OR REPLACE FUNCTION setup_calls_evaluation_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Add columns if they don't exist
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name TEXT;
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_summary TEXT;
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS evaluation_score INTEGER;
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_calls_evaluation_score ON calls(evaluation_score);
    CREATE INDEX IF NOT EXISTS idx_calls_caller_name ON calls(caller_name);
    
    RETURN jsonb_build_object('success', true, 'message', 'Schema updated');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ===========================================
-- Step 3: Add Sample/Mock Data
-- ===========================================
-- This inserts sample data linked to your user account

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the first user ID from profiles
    SELECT id INTO v_user_id FROM profiles LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Insert sample call data
        INSERT INTO calls (user_id, caller_name, caller_phone, summary, evaluation_summary, evaluation_score, duration, type, sentiment, created_at)
        VALUES 
        (v_user_id, 'Ahmet Yılmaz', '0532 123 4567', 
         'Müşteri diş implantı hakkında bilgi almak istedi. Fiyat ve süreç hakkında sorular sordu.',
         'Müşteri çok ilgili, fiyat bilgisi aldıktan sonra randevu almak istiyor. Yüksek dönüşüm potansiyeli.',
         9, 180, 'inquiry', 'positive', NOW() - INTERVAL '2 hours'),
        
        (v_user_id, 'Ayşe Demir', '0535 987 6543',
         'Saç ekimi prosedürü hakkında genel bilgi talebi. Başka klinikleri de araştırıyor.',
         'Orta düzeyde ilgi. Fiyat karşılaştırması yapıyor, tekrar araması bekleniyor.',
         6, 240, 'inquiry', 'neutral', NOW() - INTERVAL '5 hours'),
        
        (v_user_id, 'Mehmet Kaya', '0542 456 7890',
         'Acil diş ağrısı şikayeti. Bugün için randevu istedi.',
         'Acil hasta, bugün gelmek istiyor. Kesin randevu.',
         10, 120, 'appointment', 'positive', NOW() - INTERVAL '1 day'),
        
        (v_user_id, 'Fatma Şahin', '0555 321 0987',
         'Daha önce aldığı tedavi hakkında şikayet. Memnun değil.',
         'Müşteri memnuniyetsiz, şikayet yönetimi gerekli. Dikkatli takip edilmeli.',
         3, 300, 'follow_up', 'negative', NOW() - INTERVAL '1 day'),
        
        (v_user_id, 'Ali Öztürk', '0533 654 3210',
         'Randevu iptal etmek istedi. Yoğun iş temposu nedeniyle.',
         'Randevu iptal edildi. 2 hafta sonra tekrar aramak için not alındı.',
         4, 90, 'cancellation', 'neutral', NOW() - INTERVAL '3 days'),
        
        (v_user_id, 'Zeynep Arslan', '0544 789 0123',
         'Estetik dolgu ve botox hakkında detaylı bilgi istedi.',
         'Çok ilgili müşteri, hafta sonu için randevu almak istiyor. Premium hizmet potansiyeli.',
         8, 420, 'inquiry', 'positive', NOW() - INTERVAL '4 hours'),
        
        (v_user_id, 'Mustafa Çelik', '0536 012 3456',
         'Diş beyazlatma işlemi için fiyat sorgusu.',
         'Fiyat hassasiyeti yüksek. Kampanya olursa arayacağını söyledi.',
         5, 150, 'inquiry', 'neutral', NOW() - INTERVAL '6 hours'),
        
        (v_user_id, 'Elif Yıldız', '0545 234 5678',
         'Çocuğu için ortodonti tedavisi hakkında danışma.',
         'Anne çok araştırmacı, detaylı bilgi istedi. Yüz yüze görüşme için randevu aldı.',
         9, 360, 'appointment', 'positive', NOW() - INTERVAL '2 days'),
         
        (v_user_id, 'Hakan Koç', '0537 111 2233',
         'Hollywood smile paketi hakkında detaylı bilgi istedi. Yurt dışından geliyor.',
         'Yabancı turist, 2 hafta sonra İstanbul''a geliyor. VIP paket önerildi.',
         10, 480, 'appointment', 'positive', NOW() - INTERVAL '3 hours'),
         
        (v_user_id, 'Selin Ak', '0538 444 5566',
         'Diş teli tedavisi süreci ve maliyeti soruldu.',
         'Genç hasta, ödeme planı konusunda bilgi istedi. Orta seviye ilgi.',
         7, 200, 'inquiry', 'neutral', NOW() - INTERVAL '8 hours')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Sample call data inserted for user: %', v_user_id;
    ELSE
        RAISE NOTICE 'No user found in profiles table. Please create a user first.';
    END IF;
END $$;

-- ===========================================
-- Verify the data
-- ===========================================
SELECT 
    caller_name,
    caller_phone,
    LEFT(summary, 40) || '...' as summary,
    evaluation_score as score,
    sentiment,
    type,
    to_char(created_at, 'DD Mon HH24:MI') as time
FROM calls 
WHERE caller_name IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

