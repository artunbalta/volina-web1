# Dashboard'daki Aramaları Kontrol Etme

Dashboard'daki aramaların yeni structured output sistemiyle mi yoksa eski sistemle mi değerlendirildiğini kontrol etmek için yeni bir endpoint oluşturuldu.

## Kontrol Endpoint'i

**GET** `/api/calls/check-structured?userId=USER_ID&limit=100`

### Kullanım

```bash
# Tüm aramaları kontrol et
curl "http://localhost:3003/api/calls/check-structured?userId=YOUR_USER_ID&limit=100"

# Veya sadece son 50 aramayı kontrol et
curl "http://localhost:3003/api/calls/check-structured?userId=YOUR_USER_ID&limit=50"
```

### Response Örneği

**Yeni sistemle değerlendirilmişse:**
```json
{
  "success": true,
  "statistics": {
    "total": 100,
    "withStructuredOutput": 100,
    "withOldFormat": 0,
    "withNoEvaluation": 0,
    "structuredPercentage": "100.0%"
  },
  "message": "✅ Tüm aramalar yeni structured output sistemiyle değerlendirilmiş!"
}
```

**Kısmen yeni sistemle değerlendirilmişse:**
```json
{
  "success": true,
  "statistics": {
    "total": 100,
    "withStructuredOutput": 45,
    "withOldFormat": 30,
    "withNoEvaluation": 25,
    "structuredPercentage": "45.0%"
  },
  "message": "⚠️ 45/100 arama yeni sistemle değerlendirilmiş (45.0%)",
  "breakdown": {
    "newSystem": {
      "count": 45,
      "percentage": "45.0%",
      "calls": [...]
    },
    "oldSystem": {
      "count": 30,
      "calls": [...]
    },
    "noEvaluation": {
      "count": 25,
      "calls": [...]
    }
  }
}
```

**Hiç yeni sistemle değerlendirilmemişse:**
```json
{
  "success": true,
  "statistics": {
    "total": 100,
    "withStructuredOutput": 0,
    "withOldFormat": 75,
    "withNoEvaluation": 25,
    "structuredPercentage": "0.0%"
  },
  "message": "❌ Hiçbir arama yeni structured output sistemiyle değerlendirilmemiş"
}
```

## Frontend'den Kontrol Etme

Calls sayfasına bir kontrol butonu ekleyebilirsiniz:

```typescript
const checkStructuredOutputs = async () => {
  const response = await fetch(
    `/api/calls/check-structured?userId=${user.id}&limit=100`
  );
  const data = await response.json();
  
  if (data.success) {
    const { statistics, message } = data;
    alert(`
      ${message}
      
      İstatistikler:
      - Toplam: ${statistics.total}
      - Yeni Sistem: ${statistics.withStructuredOutput} (${statistics.structuredPercentage})
      - Eski Sistem: ${statistics.withOldFormat}
      - Değerlendirme Yok: ${statistics.withNoEvaluation}
    `);
  }
};
```

## Manuel Kontrol (Supabase SQL)

Supabase SQL Editor'de şu sorguyu çalıştırabilirsiniz:

```sql
-- Yeni sistemle değerlendirilmiş aramalar
SELECT 
  COUNT(*) as yeni_sistem,
  (SELECT COUNT(*) FROM calls WHERE user_id = 'YOUR_USER_ID') as toplam,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM calls WHERE user_id = 'YOUR_USER_ID'), 1) as yuzde
FROM calls
WHERE user_id = 'YOUR_USER_ID'
  AND metadata->'structuredData'->'successEvaluation' IS NOT NULL;

-- Eski sistemle değerlendirilmiş aramalar
SELECT 
  COUNT(*) as eski_sistem
FROM calls
WHERE user_id = 'YOUR_USER_ID'
  AND metadata->'structuredData'->'successEvaluation' IS NULL
  AND metadata->'successEvaluation' IS NOT NULL;

-- Örnek: Son 10 aramayı kontrol et
SELECT 
  id,
  created_at,
  evaluation_score,
  CASE 
    WHEN metadata->'structuredData'->'successEvaluation' IS NOT NULL THEN '✅ Yeni Sistem'
    WHEN metadata->'successEvaluation' IS NOT NULL THEN '⚠️ Eski Sistem'
    ELSE '❌ Değerlendirme Yok'
  END as degerlendirme_durumu,
  metadata->'structuredData' as structured_data
FROM calls
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

## Sonuç

- **✅ 100%**: Tüm aramalar yeni sistemle değerlendirilmiş
- **⚠️ 0-99%**: Bazı aramalar eski sistemle değerlendirilmiş, yeniden değerlendirme gerekebilir
- **❌ 0%**: Hiçbir arama yeni sistemle değerlendirilmemiş, VAPI'de structured output'lar yapılandırılmamış olabilir

## Eğer Eski Sistemle Değerlendirilmiş Aramalar Varsa

Eski aramaları yeni sistemle değerlendirmek için `/api/calls/re-evaluate-structured` endpoint'ini kullanabilirsiniz. Detaylar için `RE_EVALUATE_STRUCTURED_OUTPUTS.md` dosyasına bakın.
