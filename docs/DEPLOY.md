# Yayına alma rehberi

Hedef: **aylık ~5 €** ile, tek bir sunucuda, otomatik HTTPS ve sürekli yedekle çalışan bir Indexora.

> Bu ortamda Docker bulunmadığı için Docker imajının kendisini derleyemedim. Üretim derlemesini (`npm run build` + `node dist/index.js`, `NODE_ENV=production`) ise çalıştırıp doğruladım. İlk kurulumda `docker compose build` çıktısını kontrol et.

## Mimari

```
İnternet ──► Caddy (HTTPS, Let's Encrypt) ──► app:8787 (Node: web + API + worker)
                                                  │
                                                  └── /data/indexora.db (SQLite) ──► Litestream ──► R2/B2 (yedek)
```

Tek bir süreç hem arayüzü hem API'yi sunuyor, hem de arka plan işlerini çalıştırıyor. Ayrı bir Redis/Postgres yok.

## 1. Sunucu (Hetzner CX22 veya benzeri)

1. Ubuntu 24.04 ile bir VPS aç (2 vCPU / 4 GB fazlasıyla yeterli).
2. Docker'ı kur: `curl -fsSL https://get.docker.com | sh`
3. DNS: `app.alanadin.com` için A kaydını sunucunun IP'sine yönlendir.

## 2. Kod ve ayarlar

```bash
git clone <repo> indexora && cd indexora/deploy
cp .env.example .env
openssl rand -hex 32        # çıktıyı .env içindeki SECRET_KEY'e yaz — ASLA değiştirme/kaybetme
nano .env                   # DOMAIN, APP_URL, API_URL ve diğerleri
docker compose up -d --build
docker compose logs -f app  # "Indexora API listening" ve "Background worker started" görmelisin
```

`SECRET_KEY` Google token'larını şifreliyor. Kaybedersen tüm kullanıcıların Google bağlantısını yeniden yapması gerekir.

## 3. Google Search Console bağlantısı (OAuth)

1. [Google Cloud Console](https://console.cloud.google.com) → yeni proje.
2. **APIs & Services → Library**: "Google Search Console API"yi etkinleştir.
3. **OAuth consent screen**: External, uygulama adı "Indexora", destek e-postası, gizlilik/şartlar linkleri (`/privacy`, `/terms`).
   Kapsamlar: `.../auth/webmasters.readonly`, `openid`, `email`.
4. **Credentials → OAuth client ID → Web application**
   - Authorized redirect URI: `https://app.alanadin.com/api/google/callback`
5. Client ID ve secret'ı `.env` içine yaz, `docker compose up -d` ile yeniden başlat.

**Önemli — Google doğrulaması:** `webmasters.readonly` "hassas kapsam" sayılıyor. Doğrulanmamış uygulamada:
- en fazla **100 kullanıcı** bağlanabilir,
- kullanıcılar "Google bu uygulamayı doğrulamadı" uyarısı görür.

Lansmanın ilk haftalarında bu kabul edilebilir. Yine de **doğrulama başvurusunu hemen yap** (alan adı doğrulaması, gizlilik politikası, kısa bir demo videosu gerekiyor; süreç birkaç hafta sürebilir).

## 4. E-posta (alarmlar, şifre sıfırlama, haftalık özet)

Herhangi bir SMTP sağlayıcısı çalışır. Ücretsiz katmanı olanlar: Resend, Brevo, Postmark (deneme).
`SMTP_URL=smtps://kullanici:sifre@smtp.saglayici.com:465` ve `MAIL_FROM` ayarla.
Alan adın için SPF/DKIM kayıtlarını eklemeyi unutma, yoksa alarmlar spam'e düşer.

## 5. Ödemeler (Lemon Squeezy)

1. Mağaza aç, kimlik/vergi doğrulamasını tamamla.
2. Ürün: "Indexora" → abonelik varyantları:
   `starter_monthly ($12)`, `starter_yearly ($120)`, `pro_monthly ($29)`, `pro_yearly ($290)`, `agency_monthly ($79)`, `agency_yearly ($790)`
   ve kurucu varyantları: `starter_monthly_founding ($9)`, `pro_monthly_founding ($19)`, `agency_monthly_founding ($49)`.
3. Her varyantın "buy link"ini `LEMONSQUEEZY_CHECKOUT_URLS` JSON'una yaz.
4. Varyant ID → plan eşlemesini `LEMONSQUEEZY_VARIANT_PLANS` içine yaz: `{"123":"starter","124":"starter","125":"pro",...}`
5. Webhook: `https://app.alanadin.com/api/billing/webhooks/lemonsqueezy`
   Olaylar: `subscription_created`, `subscription_updated`, `subscription_resumed`, `subscription_expired`. İmzalama anahtarını `LEMONSQUEEZY_WEBHOOK_SECRET`'e yaz.
6. Müşteri portalı linkini `LEMONSQUEEZY_PORTAL_URL`'e yaz.

## 6. Yedekleme (Litestream)

Cloudflare R2'de (10 GB ücretsiz) bir bucket ve API anahtarı oluştur, `LITESTREAM_*` değişkenlerini doldur. Litestream her yazmayı ~1 saniye içinde yedekler.

**Geri yükleme (yeni sunucuda):**
```bash
docker compose run --rm litestream restore -o /data/indexora.db s3://$LITESTREAM_BUCKET/indexora.db
docker compose up -d
```
Ayda bir geri yükleme provası yap. Test edilmemiş yedek, yedek değildir.

## 7. Güncelleme

```bash
cd indexora && git pull && cd deploy && docker compose up -d --build
```
Veritabanı göçleri (migration) açılışta otomatik çalışır.

## 8. Ne zaman büyütmeli?

| Sinyal | Eylem |
|---|---|
| Worker bir turda vadesi gelen işleri bitiremiyor (loglarda sürekli dolu partiler) | `sweepDueBacklinks` eşzamanlılığını 8 → 16 yap, sonra daha büyük VPS |
| Veritabanı > 20 GB veya birden fazla API sunucusu gerekiyor | Postgres'e geç (`server/src/db/index.ts` tek değişen dosya) |
| Çok sayıda kullanıcı aynı anda | `RUN_WORKER=false` ile web ve worker'ı ayrı konteynerlere böl |

## Alternatif: Fly.io

`deploy/fly.toml` hazır. Worker'ın sürekli çalışması gerektiği için `auto_stop_machines = "off"` olmalı.
