# Tüm Aramaları Yeniden Değerlendirme Kılavuzu

Bu kılavuz, iyileştirilmiş prompt'larla tüm aramaları yeniden değerlendirmek için kullanılır.

## Önemli Notlar

⚠️ **DİKKAT**: Bu işlem:
- Tüm aramaları OpenAI API ile yeniden değerlendirecek
- API maliyeti oluşturacak (her arama için ~$0.001-0.002)
- Uzun sürebilir (1000 arama için ~15-20 dakika)
- Rate limiting nedeniyle batch'ler halinde işlenecek

## Kullanım

### 1. Tüm Aramaları Yeniden Değerlendir (Force Mode)

```bash
curl -X POST http://localhost:3000/api/calls/re-evaluate-all \
  -H "Content-Type: application/json" \
  -d '{
    "force": true,
    "limit": 10000,
    "batchSize": 50
  }'
```

### 2. Belirli Bir Kullanıcının Aramalarını Yeniden Değerlendir

```bash
curl -X POST http://localhost:3000/api/calls/re-evaluate-all \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-here",
    "force": true,
    "limit": 10000,
    "batchSize": 50
  }'
```

### 3. Sadece Structured Output'u Olmayan Aramaları Değerlendir

```bash
curl -X POST http://localhost:3000/api/calls/re-evaluate-all \
  -H "Content-Type: application/json" \
  -d '{
    "force": false,
    "limit": 10000,
    "batchSize": 50
  }'
```

## Parametreler

- `force` (boolean, default: `true`): 
  - `true`: Tüm aramaları yeniden değerlendir (mevcut structured output olsa bile)
  - `false`: Sadece structured output'u olmayan aramaları değerlendir

- `limit` (number, default: `10000`): 
  - Maksimum kaç arama işlenecek
  - Tüm aramalar için yüksek bir değer kullanın (örn: 10000)

- `batchSize` (number, default: `50`): 
  - Her batch'te kaç arama işlenecek
  - Rate limiting için önerilen: 20-50 arası

- `userId` (string, optional): 
  - Belirli bir kullanıcının aramalarını işlemek için
  - Belirtilmezse tüm kullanıcıların aramaları işlenir

## Response Format

```json
{
  "success": true,
  "message": "Re-evaluation complete for 1234 calls",
  "total": 1500,
  "needingReEvaluation": 1234,
  "results": {
    "evaluated": 1200,
    "failed": 20,
    "skipped": 14,
    "errors": ["Error message 1", "Error message 2"]
  }
}
```

## İlerleme Takibi

İşlem sırasında console'da batch'lerin işlenmesi görülebilir:
```
Processing batch 1/25 (50 calls)...
Processing batch 2/25 (50 calls)...
...
```

## Örnek Kullanım Senaryoları

### Senaryo 1: Tüm Aramaları Yeniden Değerlendir

Yeni prompt'ları VAPI'ye ekledikten sonra, tüm mevcut aramaları yeni prompt'larla yeniden değerlendirmek için:

```bash
curl -X POST http://localhost:3000/api/calls/re-evaluate-all \
  -H "Content-Type: application/json" \
  -d '{"force": true, "limit": 10000, "batchSize": 50}'
```

### Senaryo 2: Sadece Yeni Aramaları Değerlendir

Sadece henüz değerlendirilmemiş aramaları değerlendirmek için:

```bash
curl -X POST http://localhost:3000/api/calls/re-evaluate-all \
  -H "Content-Type: application/json" \
  -d '{"force": false, "limit": 10000, "batchSize": 50}'
```

### Senaryo 3: Belirli Bir Tenant'ın Aramalarını Değerlendir

```bash
curl -X POST http://localhost:3000/api/calls/re-evaluate-all \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "tenant-user-id",
    "force": true,
    "limit": 5000,
    "batchSize": 30
  }'
```

## Hata Yönetimi

Eğer bir batch başarısız olursa:
- Hata mesajları `results.errors` içinde döner
- İşlem devam eder, sadece başarısız batch'ler atlanır
- Başarısız aramaları tekrar çalıştırmak için `force: true` ile tekrar deneyin

## Performans İpuçları

1. **Batch Size**: 
   - Küçük batch'ler (20-30): Daha güvenli, daha yavaş
   - Büyük batch'ler (50-100): Daha hızlı, rate limiting riski

2. **Rate Limiting**:
   - Her batch arasında 2 saniye bekleme var
   - OpenAI API rate limit'lerine dikkat edin

3. **Limit**:
   - İlk test için küçük bir limit kullanın (örn: 100)
   - Tüm aramalar için yüksek limit kullanın (örn: 10000)

## Örnek Response

```json
{
  "success": true,
  "message": "Re-evaluation complete for 1234 calls",
  "total": 1500,
  "needingReEvaluation": 1234,
  "results": {
    "evaluated": 1200,
    "failed": 20,
    "skipped": 14,
    "errors": [
      "Batch 5 failed: Rate limit exceeded",
      "Call abc123 not found"
    ]
  }
}
```

## Sonraki Adımlar

1. VAPI Dashboard'da structured output prompt'larını güncelleyin
2. Bu endpoint'i çağırarak tüm aramaları yeniden değerlendirin
3. Sonuçları kontrol edin ve gerekirse başarısız aramaları tekrar değerlendirin
