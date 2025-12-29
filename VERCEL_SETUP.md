# Vercel Deployment Setup Guide

Bu dokümantasyon, projenizi Vercel'de çalıştırmak için gerekli adımları içerir.

## 📋 Adım Adım Kurulum

### 1. Supabase Storage Bucket Oluşturma

1. **Supabase Dashboard'a gidin**: https://app.supabase.com
2. **Projenizi seçin**
3. **Storage** sekmesine gidin
4. **"New bucket"** butonuna tıklayın
5. **Bucket bilgilerini girin**:
   - **Name**: `incoming-papers` (tam olarak bu isim olmalı)
   - **Public bucket**: ✅ **Açık** (Public olmalı, dosyalara erişim için)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `application/pdf`
6. **"Create bucket"** butonuna tıklayın

### 2. Supabase API Anahtarlarını Alma

1. Supabase Dashboard'da **Project Settings** > **API** sekmesine gidin
2. Şu bilgileri kopyalayın:
   - **Project URL**: `https://[project-ref].supabase.co`
   - **service_role key** (secret): Bu anahtarı güvenli tutun, sadece server-side kullanılmalı

### 3. Vercel Environment Variables Ayarlama

1. **Vercel Dashboard'a gidin**: https://vercel.com
2. **Projenizi seçin**
3. **Settings** > **Environment Variables** sekmesine gidin
4. Aşağıdaki environment variable'ları ekleyin:

#### Zorunlu Değişkenler:

```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
AUTH_SECRET=[openssl rand -base64 32 ile oluşturulan secret]
NEXTAUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service_role key]
```

#### Environment Variables Açıklamaları:

- **DATABASE_URL**: Supabase PostgreSQL connection string
- **AUTH_SECRET**: NextAuth için secret key (terminal'de `openssl rand -base64 32` ile oluşturun)
- **NEXTAUTH_URL**: Production URL'iniz (örn: `https://your-app.vercel.app`)
- **NEXT_PUBLIC_SUPABASE_URL**: Supabase project URL (public, client-side erişilebilir)
- **SUPABASE_URL**: Supabase project URL (server-side için)
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase service role key (secret, sadece server-side)

### 4. Vercel'de Deploy

1. **GitHub/GitLab/Bitbucket** repository'nizi Vercel'e bağlayın
2. **Deploy** butonuna tıklayın
3. Vercel otomatik olarak build ve deploy işlemini başlatacak

### 5. Build Ayarları Kontrolü

Vercel otomatik olarak Next.js projelerini algılar, ancak kontrol etmek için:

1. **Settings** > **General** > **Build & Development Settings**
2. Şu ayarların olduğundan emin olun:
   - **Framework Preset**: Next.js
   - **Build Command**: `pnpm run build` (veya `npm run build`)
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install` (veya `npm install`)

### 6. Post-Deploy Kontrolleri

Deploy tamamlandıktan sonra:

1. ✅ **Incoming Correspondences formunu test edin**: PDF yükleme çalışıyor mu?
2. ✅ **Hazard Report formunu test edin**: Rapor gönderme çalışıyor mu?
3. ✅ **Login/Logout işlemlerini test edin**: Authentication çalışıyor mu?
4. ✅ **Database bağlantısını kontrol edin**: Veriler kaydediliyor mu?

## 🔧 Sorun Giderme

### "File upload failed" Hatası

- ✅ Supabase Storage bucket'ının oluşturulduğundan emin olun
- ✅ Bucket'ın **public** olduğunu kontrol edin
- ✅ `SUPABASE_SERVICE_ROLE_KEY` environment variable'ının doğru olduğunu kontrol edin
- ✅ Bucket adının `incoming-papers` olduğunu kontrol edin

### "Unauthorized" Hatası

- ✅ `AUTH_SECRET` environment variable'ının set edildiğini kontrol edin
- ✅ `NEXTAUTH_URL` environment variable'ının production URL'inize işaret ettiğini kontrol edin

### Database Connection Hatası

- ✅ `DATABASE_URL` environment variable'ının doğru olduğunu kontrol edin
- ✅ Supabase database'inin aktif olduğunu kontrol edin
- ✅ Connection string'de `pgbouncer=true` parametresinin olduğunu kontrol edin

### Build Hatası

- ✅ `prisma generate` komutunun build sırasında çalıştığını kontrol edin (`package.json`'da `postinstall` script'i var)
- ✅ Tüm environment variable'ların set edildiğini kontrol edin

## 📝 Notlar

- **Supabase Storage**: Dosyalar Supabase Storage'da saklanır, Vercel'in read-only filesystem'inden bağımsızdır
- **Service Role Key**: Bu anahtar admin yetkilerine sahiptir, asla client-side kodda kullanmayın
- **Public Bucket**: Bucket public olmalı ki dosyalara erişilebilsin, ancak authentication kontrolü API route'larında yapılıyor
- **File Size Limit**: Maksimum 50MB PDF dosyası yüklenebilir

## 🚀 Production Checklist

- [ ] Tüm environment variable'lar set edildi
- [ ] Supabase Storage bucket oluşturuldu ve public yapıldı
- [ ] Database migration'ları çalıştırıldı (`prisma db push` veya `prisma migrate deploy`)
- [ ] Seed data yüklendi (gerekirse)
- [ ] Production URL test edildi
- [ ] File upload test edildi
- [ ] Authentication test edildi
- [ ] Error logging kontrol edildi

## 📚 Ek Kaynaklar

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

