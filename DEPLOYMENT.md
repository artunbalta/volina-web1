# 🚀 Volina Deployment Guide

## Vercel'e Deploy Etme

### 1. GitHub Repository'ye Push

```bash
# GitHub'da repo oluşturduktan sonra:
git remote add origin https://github.com/KULLANICI_ADIN/volina-web.git
git branch -M main
git push -u origin main
```

### 2. Vercel'e Bağlama

1. [vercel.com](https://vercel.com) → "Add New Project"
2. GitHub'dan `volina-web` repository'sini seç
3. Framework Preset: **Next.js** (otomatik algılanır)
4. Root Directory: `./` (varsayılan)
5. Build Command: `npm run build` (varsayılan)
6. Output Directory: `.next` (varsayılan)

### 3. Environment Variables Ekle

Vercel Dashboard → Project Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your-vapi-public-key
VAPI_PRIVATE_KEY=your-vapi-private-key
API_SECRET_KEY=volina-secret-key-change-this
```

⚠️ **ÖNEMLİ:** Production, Preview ve Development için ayrı ayrı ekle!

### 4. Domain Bağlama

1. Vercel Dashboard → Project → Settings → Domains
2. "Add Domain" → Domain'ini gir
3. DNS ayarlarını yap:
   - **A Record:** `@` → `76.76.21.21` (Vercel IP)
   - **CNAME:** `www` → `cname.vercel-dns.com`

Veya Vercel'in gösterdiği DNS kayıtlarını kullan.

### 5. SSL Sertifikası

Vercel otomatik olarak Let's Encrypt SSL ekler (5-10 dakika sürer).

---

## İlk Deploy Sonrası Kontrol

✅ Site açılıyor mu?  
✅ Dashboard'a giriş yapılabiliyor mu?  
✅ API routes çalışıyor mu?  
✅ SSL aktif mi? (https://)

---

## Sorun Giderme

### Build Hatası
- Environment variables eksik olabilir
- `npm run build` lokal olarak çalıştır, hataları gör

### Domain Çalışmıyor
- DNS propagation 24-48 saat sürebilir
- [whatsmydns.net](https://www.whatsmydns.net) ile kontrol et

### API 500 Hatası
- Vercel Function Logs'a bak
- Environment variables doğru mu kontrol et

