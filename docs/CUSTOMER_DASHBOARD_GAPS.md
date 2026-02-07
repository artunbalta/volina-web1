# Dashboard: Müşteri Gözüyle Gerekenler ve Eksikler

*Bir müşteri (satış / lead yöneticisi) olarak dashboard’u kullanırken ihtiyaç duyduğum ve eksik gördüğüm noktalar.*

---

## 1. LEADS (Leadler)

### Şu an iyi olanlar
- Lead ekleme, düzenleme, silme
- Durum ve öncelik filtreleme
- Arama (isim, telefon, e-posta)
- Sayfalama ve sıralama
- Toplu silme ve toplu arama (Call Selected)
- CSV ile toplu import
- Lead detayında notlar ve son temas tarihi

### Eksik / gerekli olanlar

| İhtiyaç | Açıklama |
|--------|----------|
| **Listede son temas / bir sonraki temas** | Tabloda "Son temas" ve "Bir sonraki temas" kolonları yok. Hangi lead’e ne zaman dönmem gerektiğini listeden göremiyorum. |
| **Excel/CSV export** | Lead listesini dışarı aktaramıyorum. Rapor veya yedek için export (Excel/CSV) gerekli. |
| **Takip gerektiren lead’ler** | "Takip gerektiriyor" veya "Bu hafta aranacak" gibi hızlı filtreler yok. Sadece status/priority var. |
| **Aramadan Lead’e gitme** | Calls ekranında bir arama gördüğümde, o aramayı yapan lead’in kartına tıklayıp geçemiyorum. Lead ile arama bağlantısı (link) eksik. |
| **Etiketler (tags) listede** | Lead’de tags var ama listede görünmüyor ve hızlı düzenlenemiyor. |
| **Toplu durum güncelleme** | Birden fazla lead seçip tek seferde status/priority değiştiremiyorum. |
| **Son aktivite** | "Bu lead’e en son ne yaptım?" (arama, WhatsApp, not) listede veya detayda net değil. |

---

## 2. CALLS (Aramalar)

### Şu an iyi olanlar
- Tarih seçerek filtreleme
- Sıralama (tarih, puana göre)
- Arama (isim, telefon, özet)
- Kayıt dinleme, transcript, özet, puan
- İstatistikler (toplam, başarılı arama sayısı)

### Eksik / gerekli olanlar

| İhtiyaç | Açıklama |
|--------|----------|
| **Lead’e link** | Aramaya tıklayınca ilgili lead’in sayfasına/detayına gidemiyorum. "Bu arama hangi lead?" ve "Bu lead’in tüm aramaları" bağı kurulmalı. |
| **Tarih aralığı** | Sadece tek gün seçebiliyorum. "Bu hafta" / "Bu ay" veya "şu tarihten – şu tarihe" aralığı olmalı. |
| **Export** | Aramalar listesini (tarih, lead, süre, puan, özet) Excel/CSV olarak indiremiyorum. |
| **"Transferred" gerçek veri** | Transferred sayısı hep 0. Gerçekten transfer varsa sayı güncellenmeli, yoksa bu kutu kaldırılabilir veya açıklanmalı. |
| **Puana göre filtre** | Örn. "7+ puan", "4–6 arası" gibi puan bandına göre filtre isterim. |
| **Tekil arama silme** | Sadece "tümünü sil" var. Tek bir aramayı silmek isteyebilirim. |

---

## 3. DASHBOARD (Ana sayfa)

### Şu an iyi olanlar
- Aylık/günlük arama sayıları ve trendler
- Ortalama süre ve dönüşüm oranı
- Çağrı dağılımı (donut)
- Haftalık aktivite (bar)
- Önemli son lead’ler (7+ puan, son 7 gün)

### Eksik / gerekli olanlar

| İhtiyaç | Açıklama |
|--------|----------|
| **Lead özeti** | Toplam lead, yeni lead, bu hafta aranan sayısı gibi lead odaklı KPI’lar yok. Sadece arama metrikleri var. |
| **Önemli lead’e tıklayınca** | "Important Recent Leads"te bir satıra tıklayınca ilgili lead’in detayına veya arama kaydına gidemiyorum. Tıklanabilir olmalı. |
| **Hızlı aksiyon** | "Şimdi ara", "Yeni lead ekle", "Bugünkü takipler" gibi tek tıkla sayfa/akış açan butonlar yok. |
| **Hedef / karşılaştırma** | Günlük/hedeflenen arama sayısı gibi bir hedef ve "hedefe ne kadar kaldı?" gösterilmiyor. |
| **Zaman aralığı seçimi** | KPI’lar sabit (aylık/günlük). "Son 7 gün", "Bu ay", "Son 3 ay" gibi seçenek olabilir. |
| **Özet mesaj** | "Bugün 12 arama yapıldı, 3 randevu alındı" gibi kısa bir cümle özeti faydalı olur. |

---

## Öncelik özeti (müşteri perspektifi)

1. **Yüksek:** Lead listesinde son temas / bir sonraki temas; Calls’tan lead’e link; Important Leads’e tıklayınca lead’e gitme; Lead listesini export (Excel/CSV).
2. **Orta:** Tarih aralığı (Calls); puana göre filtre (Calls); Dashboard’da lead sayıları ve hızlı aksiyonlar.
3. **Düşük:** Transferred’ı düzeltmek veya kaldırmak; tek arama silme; toplu durum güncelleme (Leads); etiketlerin listede görünmesi.

Bu liste, müşteri olarak "ne eksik, ne gerekli?" sorusuna verilen yanıt; geliştirme önceliği product/teknik tarafına bırakılabilir.
