# Structured Output Kullanımını Kontrol Etme

## Sistem Durumu

Sistem şu anda **her iki formatı da destekliyor**:

1. **Yeni Sistem (Öncelikli):** Structured Output'lar
   - `analysis.structuredData.successEvaluation` → score, sentiment, outcome, tags
   - `analysis.structuredData.callSummary` → arama özeti

2. **Eski Sistem (Geriye Dönük Uyumluluk):** String format
   - `analysis.successEvaluation` → JSON string

## Hangi Sistem Kullanılıyor?

Webhook handler (`/api/vapi`) şu mantıkla çalışıyor:

```typescript
// Öncelik: structuredData > successEvaluation string
if (analysis?.structuredData && typeof analysis.structuredData === 'object') {
  // YENİ SİSTEM: Structured outputs kullanılıyor
  console.log("Using structured output data");
} else {
  // ESKİ SİSTEM: String format kullanılıyor
  console.log("Using legacy successEvaluation string");
}
```

## Kontrol Etme Yöntemleri

### 1. Webhook Loglarını Kontrol Et

Server loglarında şu mesajları ara:

**Yeni sistem kullanılıyorsa:**
```
Using structured output data: {
  hasEvaluation: true,
  hasCallSummary: true,
  structuredDataKeys: ['successEvaluation', 'callSummary']
}
```

**Eski sistem kullanılıyorsa:**
```
Using legacy successEvaluation string
```

### 2. Veritabanını Kontrol Et

Supabase'de `calls` tablosunda `metadata` alanını kontrol et:

```sql
-- Yeni sistem kullanılıyorsa:
SELECT 
  id,
  evaluation_score,
  summary,
  metadata->'structuredData' as structured_data,
  created_at
FROM calls
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;
```

**Yeni sistem kullanılıyorsa:**
- `metadata.structuredData` alanı dolu olmalı
- `metadata.structuredData.successEvaluation` objesi olmalı
- `metadata.structuredData.callSummary` objesi olmalı

**Eski sistem kullanılıyorsa:**
- `metadata.structuredData` NULL veya boş olacak
- `metadata` içinde başka alanlar olabilir

### 3. Test Araması Yap

1. VAPI Dashboard'dan bir test araması yap
2. Webhook loglarını kontrol et
3. Veritabanında yeni kaydı kontrol et

## VAPI'de Structured Output'lar Yapılandırıldı mı?

Eğer structured output'lar VAPI'de yapılandırılmadıysa:
- Sistem otomatik olarak eski formatı kullanır
- Hiçbir hata vermez (backward compatibility)
- Ama yeni sistemin avantajlarını kullanamazsınız

### Kontrol Listesi:

- [ ] VAPI Dashboard'da `successEvaluation` structured output oluşturuldu mu?
- [ ] VAPI Dashboard'da `callSummary` structured output oluşturuldu mu?
- [ ] Asistan prompt'una structured output kullanımı eklendi mi?
- [ ] Test araması yapıldı ve loglar kontrol edildi mi?

## Yeni Aramalar Yeni Sistemle mi Geliyor?

Eğer VAPI'de structured output'lar yapılandırıldıysa:
- ✅ Yeni aramalar otomatik olarak structured output'larla gelecek
- ✅ Eski aramalar eski formatla kalacak (değişmez)
- ✅ Sistem her iki formatı da işleyebilir

## Sorun Giderme

**"Using legacy successEvaluation string" görüyorsanız:**

1. VAPI Dashboard'da structured output'ların oluşturulduğundan emin olun
2. Asistan prompt'una structured output kullanımının eklendiğinden emin olun
3. Test araması yapın ve webhook loglarını kontrol edin
4. VAPI Dashboard'da structured output'ların doğru isimlendirildiğinden emin olun:
   - `successEvaluation` (tam olarak bu isim)
   - `callSummary` (tam olarak bu isim)

**Structured output'lar gelmiyor ama yapılandırıldıysa:**

1. VAPI Dashboard'da structured output'ların "active" olduğundan emin olun
2. Asistan'ın bu structured output'ları kullanacak şekilde yapılandırıldığından emin olun
3. VAPI webhook payload'ını kontrol edin (VAPI Dashboard → Calls → Webhook Logs)
