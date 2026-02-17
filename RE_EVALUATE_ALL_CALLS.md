# Tüm Aramaları Yeniden Değerlendirme

## Hızlı Başlangıç

### Adım 1: User ID'nizi Bulun

Dashboard'da kendi user ID'nizi bulmak için:
1. Tarayıcı console'unu açın (F12)
2. Şu komutu çalıştırın:
   ```javascript
   // Auth context'ten user ID'yi al
   localStorage.getItem('sb-...-auth-token') // veya
   // Network tab'ında /api/dashboard/calls isteğine bakın, userId parametresini göreceksiniz
   ```

Veya Supabase'de:
```sql
SELECT id, email FROM profiles WHERE email = 'your-email@example.com';
```

### Adım 2: Yeniden Değerlendirme Gereken Aramaları Bulun

```bash
# Belirli kullanıcı için
curl "http://localhost:3003/api/calls/re-evaluate-structured?userId=YOUR_USER_ID&limit=1000" | jq

# Tüm kullanıcılar için (user_id belirtmeden)
curl "http://localhost:3003/api/calls/re-evaluate-structured?limit=1000" | jq
```

### Adım 3: Toplu Yeniden Değerlendirme

**Yöntem 1: Script Kullanarak (Önerilen)**

```bash
# Script'i çalıştırın
./scripts/re-evaluate-all.sh YOUR_USER_ID

# Veya tüm kullanıcılar için (user_id olmadan)
./scripts/re-evaluate-all.sh
```

**Yöntem 2: API Endpoint Kullanarak**

```bash
# 1. Önce call ID'lerini al
CALL_IDS=$(curl -s "http://localhost:3003/api/calls/re-evaluate-structured?userId=YOUR_USER_ID&limit=100" | jq -r '.calls[].id' | tr '\n' ',' | sed 's/,$//')

# 2. Toplu yeniden değerlendir
curl -X PUT http://localhost:3003/api/calls/re-evaluate-structured \
  -H "Content-Type: application/json" \
  -d "{
    \"callIds\": [$(echo $CALL_IDS | sed 's/,/","/g' | sed 's/^/"/' | sed 's/$/"/')],
    \"force\": true,
    \"limit\": 100
  }"
```

**Yöntem 3: Node.js Script (Daha Kontrollü)**

```bash
# Script'i çalıştırın
npx tsx scripts/re-evaluate-all-calls.ts YOUR_USER_ID

# Veya tüm kullanıcılar için
npx tsx scripts/re-evaluate-all-calls.ts
```

## Önemli Notlar

1. **Rate Limiting:** Her arama arasında 1 saniye bekleme var (OpenAI API rate limit'i için)
2. **Maliyet:** Her arama için OpenAI API çağrısı yapılır (gpt-4o-mini kullanılıyor)
3. **Süre:** 100 arama için yaklaşık 100 saniye (1.5 dakika)
4. **Force Mode:** `force: true` kullanırsanız, zaten structured output'u olan aramalar da yeniden değerlendirilir

## Yeni Kurallar Uygulanacak

Yeniden değerlendirme sırasında şu yeni kurallar uygulanacak:

- ✅ Dil uyumsuzluğu ("someone speak Spanish") → max 3-4 puan
- ✅ Minimal pasif cevaplar ("okay", "hello?") → max 3 puan  
- ✅ Voicemail tespiti ("leave me a message") → V
- ✅ Daha sıkı yüksek puan kuralları (7-10 için gerçek ilgi gerekli)

## Örnek Çıktı

```
🔍 Finding calls that need re-evaluation...
📊 Total calls: 150
🔄 Calls needing re-evaluation: 120
📋 Found 120 calls to re-evaluate

⚠️  This will make 120 API calls to OpenAI.
    Estimated time: ~120 seconds (1 call per second)
    Press Ctrl+C to cancel, or wait 5 seconds to continue...

📦 Processing batch 1/24...
🔄 Evaluating: abc-123
  ✅ Success - Score: 3
🔄 Evaluating: def-456
  ✅ Success - Score: 4
...

✅ Re-evaluation complete!
   ✅ Evaluated: 115
   ⏭️  Skipped: 3
   ❌ Failed: 2
   📊 Total: 120
```
