# VAPI Structured Outputs Konfigürasyonu

Bu dokümantasyon, VAPI asistanınızda structured output'ları nasıl yapılandıracağınızı açıklar.

## Structured Output'lar

Sistem 2 adet structured output bekliyor:

### 1. Success Evaluation (Numeric Scale)
**Amaç:** Arama başarısını 1-10 arası puanla değerlendirmek

**Beklenen Yapı:**
```json
{
  "score": 7,
  "sentiment": "positive",
  "outcome": "interested",
  "tags": ["interested", "warm_lead"],
  "objections": ["price_concern"],
  "nextAction": "Schedule follow-up call"
}
```

**Alanlar:**
- `score` (number, 1-10): Arama puanı
  - 1-2: Çok olumsuz (hemen kapattı, düşmanca)
  - 3-4: Olumsuz (ilgisiz, kaba)
  - 5-6: Nötr (kararsız)
  - 7-8: Olumlu ilgi (sorular sordu, bilgi istedi)
  - 9-10: Çok başarılı (randevu alındı, satış yapıldı)
- `sentiment` (string): "positive" | "neutral" | "negative"
- `outcome` (string): "appointment_set" | "callback_requested" | "interested" | "not_interested" | "needs_info" | "no_answer" | "voicemail" | "wrong_number" | "busy"
- `tags` (array): İlgili etiketler
- `objections` (array, optional): Müşteri itirazları
- `nextAction` (string, optional): Önerilen sonraki adım

### 2. Call Summary
**Amaç:** Arama özetini oluşturmak

**Beklenen Yapı:**
```json
{
  "callSummary": "Müşteri randevu almak istiyor. Pazartesi sabahı uygun. Fiyat bilgisi gönderilecek."
}
```

**Alanlar:**
- `callSummary` (string): Arama özeti (maksimum 2-3 cümle)

## VAPI'de Yapılandırma

### Adım 1: VAPI Dashboard'a Gidin
1. VAPI Dashboard'da asistanınızı açın
2. "Structured Outputs" veya "Tools" bölümüne gidin

### Adım 2: Success Evaluation Structured Output'u Oluşturun

**Name:** `successEvaluation`

**Schema (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "score": {
      "type": "number",
      "description": "Arama başarı puanı (1-10 arası)",
      "minimum": 1,
      "maximum": 10
    },
    "sentiment": {
      "type": "string",
      "enum": ["positive", "neutral", "negative"],
      "description": "Arama duygu durumu"
    },
    "outcome": {
      "type": "string",
      "enum": ["appointment_set", "callback_requested", "interested", "not_interested", "needs_info", "no_answer", "voicemail", "wrong_number", "busy"],
      "description": "Arama sonucu"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Arama etiketleri"
    },
    "objections": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Müşteri itirazları (opsiyonel)"
    },
    "nextAction": {
      "type": "string",
      "description": "Önerilen sonraki adım (opsiyonel)"
    }
  },
  "required": ["score", "sentiment", "outcome"]
}
```

**Prompt/Description:**
```
Arama sona erdiğinde, aramayı analiz edip başarı puanını (1-10) ve sonucunu belirle.

Puanlama Kuralları:
- 1-2: Çok olumsuz (hemen kapattı, düşmanca, yanlış numara)
- 3-4: Olumsuz (ilgisiz, kaba, hiç etkileşim yok)
- 5-6: Nötr (dinledi ama kararsız, ilgi belirsiz)
- 7-8: Olumlu ilgi (sorular sordu, bilgi istedi, takip istedi)
- 9-10: Çok başarılı (randevu alındı, satış yapıldı, kesin taahhüt)

Özel Durumlar:
- Sesli mesaja düştüyse: outcome = "voicemail", score = 1
- Cevap verilmediyse: outcome = "no_answer", score = 1
- Hat meşgulse: outcome = "busy", score = 1
```

### Adım 3: Call Summary Structured Output'u Oluşturun

**Name:** `callSummary`

**Schema (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "callSummary": {
      "type": "string",
      "description": "Aramanın kısa özeti (maksimum 2-3 cümle)"
    }
  },
  "required": ["callSummary"]
}
```

**Prompt/Description:**
```
Arama sona erdiğinde, aramanın kısa bir özetini oluştur (maksimum 2-3 cümle).
Özet şunları içermeli:
- Müşterinin ilgi durumu
- Önemli konuşma noktaları
- Alınan kararlar veya taahhütler
- Sonraki adımlar (varsa)
```

### Adım 4: Asistan Prompt'una Structured Output Kullanımını Ekleyin

Asistanınızın system prompt'una şunu ekleyin:

```
Arama sona erdiğinde:
1. successEvaluation structured output'unu kullanarak aramayı değerlendir
2. callSummary structured output'unu kullanarak arama özetini oluştur

Her iki structured output'u da mutlaka doldur.
```

## Webhook'ta Nasıl İşleniyor?

Webhook handler (`/api/vapi`) structured output'ları şu şekilde işler:

1. **Structured Data Kontrolü:** `analysis.structuredData` içinde structured output'ları arar
2. **Success Evaluation Parse:** `successEvaluation` structured output'undan score, sentiment, outcome, tags çıkarılır
3. **Call Summary Parse:** `callSummary` structured output'undan arama özeti çıkarılır
4. **Veritabanına Kayıt:** 
   - `evaluation_score`: successEvaluation.score
   - `sentiment`: successEvaluation.sentiment
   - `evaluation_summary`: successEvaluation.summary (varsa)
   - `tags`: successEvaluation.tags
   - `summary`: callSummary.callSummary (öncelikli) veya analysis.summary

## Geriye Dönük Uyumluluk

Eğer structured output'lar yoksa, sistem eski formatı (`successEvaluation` string) kullanmaya devam eder. Bu sayede mevcut asistanlar çalışmaya devam eder.

## Test Etme

1. VAPI'de bir test araması yapın
2. Webhook loglarını kontrol edin (`console.log` çıktıları)
3. Veritabanında `calls` tablosunda kaydın doğru şekilde oluşturulduğunu kontrol edin
4. `/lumiaclinic/calls` sayfasında aramanın doğru puan ve özetle göründüğünü kontrol edin

## Sorun Giderme

**Structured output'lar gelmiyor:**
- VAPI Dashboard'da structured output'ların doğru yapılandırıldığından emin olun
- Asistan prompt'unda structured output kullanımının belirtildiğinden emin olun
- Webhook loglarında `structuredDataKeys` çıktısını kontrol edin

**Puan yanlış:**
- Success evaluation structured output'unun `score` alanının 1-10 arası olduğundan emin olun
- Prompt'ta puanlama kurallarının net olduğundan emin olun

**Özet gelmiyor:**
- Call summary structured output'unun `callSummary` alanının doldurulduğundan emin olun
- Webhook loglarında `callSummaryFromStructured` değerini kontrol edin
