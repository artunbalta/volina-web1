# Eski Aramaları Structured Output Formatında Yeniden Değerlendirme

Eski aramaları (structured output'u olmayan) yeni structured output formatında değerlendirmek için yeni bir endpoint oluşturuldu.

## Endpoint: `/api/calls/re-evaluate-structured`

### 1. Tek Bir Aramayı Yeniden Değerlendirme

**POST** `/api/calls/re-evaluate-structured`

```json
{
  "callId": "call-id-here",
  "force": false  // optional: true ise zaten structured output'u olan aramaları da yeniden değerlendirir
}
```

**Örnek:**
```bash
curl -X POST http://localhost:3003/api/calls/re-evaluate-structured \
  -H "Content-Type: application/json" \
  -d '{"callId": "abc-123-def"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Call re-evaluated with structured output format",
  "evaluation": {
    "successEvaluation": {
      "score": 7,
      "sentiment": "positive",
      "outcome": "interested",
      "tags": ["interested", "warm_lead"],
      "objections": [],
      "nextAction": "Schedule follow-up call"
    },
    "callSummary": {
      "callSummary": "Müşteri randevu almak istiyor. Pazartesi sabahı uygun. Fiyat bilgisi gönderilecek."
    }
  }
}
```

### 2. Toplu Yeniden Değerlendirme

**PUT** `/api/calls/re-evaluate-structured`

```json
{
  "callIds": ["call-id-1", "call-id-2", "call-id-3"],
  "force": false,  // optional: true ise zaten structured output'u olan aramaları da yeniden değerlendirir
  "limit": 50      // optional: maksimum kaç arama değerlendirilecek
}
```

**Örnek:**
```bash
curl -X PUT http://localhost:3003/api/calls/re-evaluate-structured \
  -H "Content-Type: application/json" \
  -d '{
    "callIds": ["id1", "id2", "id3"],
    "limit": 10
  }'
```

**Response:**
```json
{
  "success": true,
  "results": {
    "evaluated": 8,
    "failed": 1,
    "skipped": 1,
    "errors": ["Error evaluating call id3: ..."]
  }
}
```

### 3. Yeniden Değerlendirme Gereken Aramaları Bulma

**GET** `/api/calls/re-evaluate-structured?userId=USER_ID&limit=50`

**Örnek:**
```bash
curl "http://localhost:3003/api/calls/re-evaluate-structured?userId=user-123&limit=50"
```

**Response:**
```json
{
  "success": true,
  "total": 100,
  "needingReEvaluation": 45,
  "calls": [
    {
      "id": "call-id-1",
      "created_at": "2024-01-15T10:00:00Z",
      "hasStructuredOutput": false
    },
    ...
  ]
}
```

## Nasıl Çalışıyor?

1. **Eski Aramayı Bulur:** Structured output'u olmayan aramaları bulur
2. **OpenAI ile Değerlendirir:** VAPI'nin structured output formatına uygun şekilde değerlendirir
3. **Metadata'ya Kaydeder:** Sonuçları `metadata.structuredData` alanına kaydeder:
   ```json
   {
     "structuredData": {
       "successEvaluation": {
         "score": 7,
         "sentiment": "positive",
         "outcome": "interested",
         "tags": ["interested", "warm_lead"]
       },
       "callSummary": {
         "callSummary": "Arama özeti..."
       }
     }
   }
   ```
4. **Veritabanını Günceller:**
   - `evaluation_score`: successEvaluation.score
   - `sentiment`: successEvaluation.sentiment
   - `summary`: callSummary.callSummary
   - `tags`: successEvaluation.tags
   - `metadata.structuredData`: Tüm structured output verisi

## Kullanım Senaryoları

### Senaryo 1: Tüm Eski Aramaları Yeniden Değerlendirme

```javascript
// 1. Önce hangi aramaların yeniden değerlendirme gerektirdiğini bul
const response = await fetch('/api/calls/re-evaluate-structured?userId=USER_ID&limit=100');
const { calls } = await response.json();

// 2. Toplu olarak yeniden değerlendir
const callIds = calls.map(c => c.id);
const reEvaluateResponse = await fetch('/api/calls/re-evaluate-structured', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ callIds, limit: 50 })
});

const { results } = await reEvaluateResponse.json();
console.log(`Değerlendirildi: ${results.evaluated}, Atlandı: ${results.skipped}, Hata: ${results.failed}`);
```

### Senaryo 2: Belirli Bir Aramayı Zorla Yeniden Değerlendirme

```javascript
// Zaten structured output'u olsa bile yeniden değerlendir
const response = await fetch('/api/calls/re-evaluate-structured', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    callId: 'call-id-here',
    force: true 
  })
});
```

## Önemli Notlar

1. **Rate Limiting:** OpenAI API rate limit'leri nedeniyle toplu işlemlerde her arama arasında 1 saniye bekleme var
2. **Maliyet:** Her arama için OpenAI API çağrısı yapılır (gpt-4o-mini kullanılıyor)
3. **Mevcut Veriler:** Eğer arama zaten structured output'a sahipse, `force=true` olmadan atlanır
4. **Transcript Gereksinimi:** Sadece transcript veya summary'si olan aramalar değerlendirilebilir

## Frontend'den Kullanım

Calls sayfasına bir buton ekleyebilirsiniz:

```typescript
const handleReEvaluateAll = async () => {
  // 1. Yeniden değerlendirme gereken aramaları bul
  const checkResponse = await fetch(
    `/api/calls/re-evaluate-structured?userId=${user.id}&limit=100`
  );
  const { calls } = await checkResponse.json();
  
  if (calls.length === 0) {
    alert('Tüm aramalar zaten structured output formatında!');
    return;
  }
  
  // 2. Onay al
  if (!confirm(`${calls.length} arama yeniden değerlendirilecek. Devam edilsin mi?`)) {
    return;
  }
  
  // 3. Toplu yeniden değerlendir
  const callIds = calls.map(c => c.id);
  const response = await fetch('/api/calls/re-evaluate-structured', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callIds, limit: 50 })
  });
  
  const { results } = await response.json();
  alert(`Tamamlandı! Değerlendirildi: ${results.evaluated}, Atlandı: ${results.skipped}`);
  
  // 4. Sayfayı yenile
  loadCalls();
};
```

## Sonuç

Artık eski aramaları yeni structured output formatında değerlendirebilirsiniz! Bu sayede:
- ✅ Tüm aramalar aynı formatı kullanır
- ✅ Daha tutarlı değerlendirmeler yapılır
- ✅ Yeni sistemin avantajlarından faydalanılır
- ✅ Eski aramalar da yeni formatla uyumlu hale gelir
