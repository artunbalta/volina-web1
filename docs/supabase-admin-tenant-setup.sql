-- ===========================================
-- Volina: Admin + Multi-tenant VAPI (Supabase)
-- Postman/curl GEREKMEZ. Kullanıcıları Dashboard'dan ekleyip sonra bu SQL ile güncellersin.
-- ===========================================

-- ---------- ADIM 1: Bunu önce çalıştır (şema) ----------

-- 1) profiles tablosuna VAPI alanları
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vapi_assistant_id') THEN
        ALTER TABLE profiles ADD COLUMN vapi_assistant_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vapi_phone_number_id') THEN
        ALTER TABLE profiles ADD COLUMN vapi_phone_number_id TEXT;
    END IF;
    -- Farklı VAPI hesabı (tenant başına API key)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vapi_private_key') THEN
        ALTER TABLE profiles ADD COLUMN vapi_private_key TEXT;
    END IF;
END $$;

-- 2) Yeni kullanıcı eklenince profile otomatik oluşsun
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ---------- ADIM 2: Supabase Dashboard'dan kullanıcı ekle ----------
-- Supabase → Authentication → Users → "Add user" →
--   - admin@volina.online  /  Volina1313.
--   - info@lumiaclinic.com /  Deneme123
-- Her eklediğinde profiles tablosuna bir satır otomatik düşer (trigger sayesinde).


-- ---------- ADIM 3: Aşağıdaki UPDATE'leri çalıştır (profile'ları tenant bilgisiyle güncelle) ----------

-- Volina Admin: slug + role + company
UPDATE profiles
SET slug = 'volina',
    role = 'admin',
    company_name = 'Volina AI',
    dashboard_type = 'outbound',
    full_name = 'Volina Admin'
WHERE email = 'admin@volina.online';

-- Lumia Clinic: slug + company
UPDATE profiles
SET slug = 'lumiaclinic',
    role = 'user',
    company_name = 'Lumia Clinic',
    dashboard_type = 'outbound',
    full_name = 'Lumia Clinic'
WHERE email = 'info@lumiaclinic.com';

-- Bitti. admin@volina.online ile giriş → /admin, info@lumiaclinic.com ile giriş → /lumiaclinic
