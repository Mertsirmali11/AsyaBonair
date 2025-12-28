# Vercel Deployment Guide / Vercel'e Yükleme Rehberi

## 🇹🇷 Türkçe

### Ön Gereksinimler

1. **GitHub Hesabı** - Projenizi GitHub'a yüklemeniz gerekiyor
2. **Vercel Hesabı** - [vercel.com](https://vercel.com) adresinden ücretsiz hesap oluşturun
3. **Supabase Hesabı** - Veritabanı için [supabase.com](https://supabase.com) kullanıyorsanız

---

### Adım 1: Projeyi GitHub'a Yükleyin

```bash
# Git repository başlatın (eğer yoksa)
git init

# Tüm dosyaları ekleyin
git add .

# İlk commit
git commit -m "Initial commit"

# GitHub'da yeni repository oluşturun ve bağlayın
git remote add origin https://github.com/KULLANICI_ADINIZ/REPO_ADINIZ.git

# Yükleyin
git push -u origin main
```

---

### Adım 2: Vercel'e Bağlanın

1. [vercel.com](https://vercel.com) adresine gidin
2. **"Sign Up"** veya **"Log In"** ile giriş yapın (GitHub ile giriş önerilir)
3. **"Add New..."** → **"Project"** butonuna tıklayın
4. **"Import Git Repository"** bölümünden GitHub repository'nizi seçin
5. Projenizi seçin ve **"Import"** butonuna tıklayın

---

### Adım 3: Environment Variables (Ortam Değişkenleri) Ayarlayın

Vercel proje ayarlarında aşağıdaki ortam değişkenlerini ekleyin:

| Değişken Adı | Değer | Açıklama |
|--------------|-------|----------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@...` | Supabase veritabanı bağlantı URL'i |
| `AUTH_SECRET` | `rastgele-guvenli-anahtar` | NextAuth için gizli anahtar |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Deploy sonrası Vercel domain'iniz |

#### DATABASE_URL Nasıl Alınır (Supabase):
1. [Supabase Dashboard](https://supabase.com/dashboard) açın
2. Projenizi seçin
3. **Project Settings** → **Database** → **Connection string**
4. **"Session mode"** seçeneğini kopyalayın

#### AUTH_SECRET Nasıl Oluşturulur:
```bash
# Terminal'de çalıştırın:
openssl rand -base64 32
```

---

### Adım 4: Deploy (Yükleme)

1. Environment variables'ları girdikten sonra **"Deploy"** butonuna tıklayın
2. Vercel otomatik olarak:
   - Dependencies'leri yükleyecek
   - Prisma Client oluşturacak
   - Next.js projesini build edecek
   - Projeyi deploy edecek

3. Deploy tamamlandığında size bir URL verilecek (örn: `https://asya-xyz.vercel.app`)

---

### Adım 5: Veritabanı Şemasını Senkronize Edin

Deploy sonrası veritabanı şemasını güncellemek için:

**Seçenek A: Lokal bilgisayardan**
```bash
# .env dosyasında production DATABASE_URL olduğundan emin olun
npx prisma db push
```

**Seçenek B: Vercel CLI ile**
```bash
# Vercel CLI kurulumu
npm i -g vercel

# Giriş yapın
vercel login

# Production ortamında komut çalıştırın
vercel env pull .env.local
npx prisma db push
```

---

### Adım 6: Seed Data (Test Verileri) Ekleyin

```bash
# Lokal bilgisayardan (production DATABASE_URL ile)
pnpm db:seed
```

---

### Sorun Giderme

#### Build Hatası Alıyorsanız:
1. Vercel Dashboard → Project → **Deployments** → Son deployment'a tıklayın
2. **"Build Logs"** sekmesinden hata detaylarını inceleyin

#### Veritabanı Bağlantı Hatası:
- DATABASE_URL'in doğru olduğundan emin olun
- Supabase'de **"Connection Pooling"** aktif olmalı
- URL'de `?pgbouncer=true` parametresi olmalı

#### Authentication Çalışmıyorsa:
- `AUTH_SECRET` değişkeninin ayarlı olduğundan emin olun
- `NEXTAUTH_URL`'in Vercel domain'inizle eşleştiğinden emin olun

---

### Güncelleme Yayınlama

GitHub'a her push yaptığınızda Vercel otomatik olarak yeni bir deploy başlatır:

```bash
git add .
git commit -m "Yeni özellik eklendi"
git push origin main
```

---

## 🇬🇧 English

### Prerequisites

1. **GitHub Account** - You need to upload your project to GitHub
2. **Vercel Account** - Create a free account at [vercel.com](https://vercel.com)
3. **Supabase Account** - If you're using [supabase.com](https://supabase.com) for database

### Quick Steps

1. Push your project to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `AUTH_SECRET` - A secure random string
   - `NEXTAUTH_URL` - Your Vercel deployment URL
4. Click "Deploy"
5. After deployment, sync your database schema: `npx prisma db push`

---

## Environment Variables Reference

```env
# Required
DATABASE_URL="postgresql://..."
AUTH_SECRET="your-secret-key"

# Optional (auto-set by Vercel)
NEXTAUTH_URL="https://your-app.vercel.app"
```

---

## Useful Commands

```bash
# Build locally
pnpm build

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed database
pnpm db:seed

# View database in browser
pnpm db:studio
```

