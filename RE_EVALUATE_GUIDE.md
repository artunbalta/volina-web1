# Aramaları Yeniden Değerlendirme Kılavuzu

## Hızlı Başlangıç

### 1. Yeniden Değerlendirme Gereken Aramaları Bul

```bash
# Tüm kullanıcılar için
curl "http://localhost:3003/api/calls/re-evaluate-structured?limit=100"

# Belirli bir kullanıcı için
curl "http://localhost:3003/api/calls/re-evaluate-structured?userId=USER_ID&limit=100"
```

### 2. Tek Bir Aramayı Yeniden Değerlendir

```bash
curl -X POST http://localhost:3003/api/calls/re-evaluate-structured \
  -H "Content-Type: application/json" \
  -d '{"callId": "CALL_ID_HERE", "force": true}'
```

**Not:** `force: true` kullanırsanız, zaten structured output'u olan aramalar da yeniden değerlendirilir.

### 3. Toplu Yeniden Değerlendirme

```bash
# Önce hangi aramaların yeniden değerlendirme gerektirdiğini bul
curl "http://localhost:3003/api/calls/re-evaluate-structured?userId=USER_ID&limit=100" > calls.json

# Sonra toplu olarak yeniden değerlendir
curl -X PUT http://localhost:3003/api/calls/re-evaluate-structured \
  -H "Content-Type: application/json" \
  -d '{
    "callIds": ["id1", "id2", "id3"],
    "force": true,
    "limit": 50
  }'
```

## Son Bahsettiğimiz Arama İçin

"Hello? / Someone speak Spanish / Okay" aramasını yeniden değerlendirmek için:

1. **Arama ID'sini bulun:** Dashboard'da bu aramayı bulup ID'sini kopyalayın
2. **Yeniden değerlendirin:**
   ```bash
   curl -X POST http://localhost:3003/api/calls/re-evaluate-structured \
     -H "Content-Type: application/json" \
     -d '{"callId": "ARAMA_ID_BURAYA", "force": true}'
   ```

## Yeni Kurallar

Yeniden değerlendirme sırasında şu yeni kurallar uygulanacak:

- ✅ Dil uyumsuzluğu tespiti ("someone speak Spanish" → max 3-4 puan)
- ✅ Minimal pasif cevaplar tespiti ("okay", "hello?" → max 3 puan)
- ✅ Voicemail tespiti ("leave me a message" → V)
- ✅ Daha sıkı yüksek puan kuralları (7-10 puan için gerçek ilgi gerekli)

## Örnek Response

```json
{
  "success": true,
  "message": "Call re-evaluated with structured output format",
  "evaluation": {
    "successEvaluation": {
      "score": 3,
      "sentiment": "neutral",
      "outcome": "not_interested",
      "tags": ["cold_lead"],
      "nextAction": "No follow-up needed"
    },
    "callSummary": {
      "callSummary": "Customer asked for Spanish speaker, showed minimal engagement with only passive responses like 'okay' and 'hello?'. No real interest in the conversation."
    }
  }
}
```
