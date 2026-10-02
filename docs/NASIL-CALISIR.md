# Indexora nasıl çalışır?

Bu doküman ürünün "otomatik" kısımlarının arkasında gerçekte ne olduğunu anlatır. Kod referansları `server/src/` altındadır.

---

## 1. "Oto backlink" — iki ayrı iş

"Otomatik backlink" iki farklı anlama gelebilir:

| | Ne yapar | Indexora yapıyor mu? |
|---|---|---|
| **Backlink izleme** | Var olan linklerinin hâlâ yerinde olup olmadığını, dofollow olup olmadığını kontrol eder | **Evet** — ürünün kalbi |
| **Backlink keşfi** | Senin bilmediğin, sana yeni link veren sayfaları bulur | **Evet**, harici veri sağlayıcıyla (Pro/Agency) |
| **Otomatik backlink *üretme*** | Forumlara/bloglara otomatik link basar | **Hayır, bilinçli olarak** |

Otomatik link üretmek Google'ın spam politikalarına ("link spam") açıkça aykırıdır. Siteye manuel ceza ya da algoritmik değer kaybı getirebilir. Böyle bir özellik müşterinin sitesini riske atar, ürünün itibarını da öldürür. Bunun yerine "fırsatlar" ekranı var: rakiplerine link verip sana vermeyen siteleri, linksiz marka bahsetmelerini ve kırık linkleri bulup hazır bir e-posta taslağı veriyor. Gönderen yine sen oluyorsun.

### 1.1 Backlinkler sisteme nasıl girer?

1. **Elle ekleme:** linkin bulunduğu sayfanın URL'si (+ istersen hedef URL).
2. **İçe aktarma** (`POST /api/projects/:id/backlinks/import`, `lib/csv.ts`):
   - Search Console → Bağlantılar → **"Son bağlantılar" → Dışa aktar** (ücretsiz, en iyi başlangıç kaynağı)
   - Ahrefs / Semrush / Moz CSV'leri (DR/AS sütunu otorite olarak alınır)
   - Düz URL listesi
   - Sütunlar başlık adına göre değil **içeriğe göre** seçilir. Search Console'un "En çok bağlantı veren siteler" dosyası sadece alan adı içerdiği için doğrulanamaz; kullanıcıya hangi dosyayı indirmesi gerektiği söylenir.
3. **Keşif** (`services/discovery.ts`, sadece Pro/Agency, haftalık): DataForSEO Backlinks API'den alan adına gelen en yeni linkler çekilir. Bunlar **doğrudan "yeni" diye gösterilmez**. Önce kendi tarayıcımızla doğrulanırlar (aşağıya bak).

> Neden keşfi kendimiz yapmıyoruz? Bilinmeyen linkleri bulmak tüm interneti taramayı gerektirir; Ahrefs'in bunun için binlerce sunucusu var. Tek kişilik bir girişim için tek mantıklı yol bu veriyi kiralamak. Arayüz (`BacklinkProvider`) sağlayıcıdan bağımsız: yarın Moz/Majestic'e geçmek tek dosya.

### 1.2 Doğrulama — her gün, her link için

`services/backlinks.ts → verifyBacklink()`

1. **Kibar tarayıcı** (`lib/fetcher.ts`) linkin bulunduğu sayfayı indirir:
   - `robots.txt` kurallarına uyar (6 saat önbellek). Bizi engelleyen sayfa **"blocked"** olarak işaretlenir. "Kayıp" denmez çünkü göremediğimiz bir şey hakkında tahmin yürütmüyoruz.
   - Aynı siteye en az 2 saniye arayla istek atar, kimsenin sitesini yormaz.
   - Yönlendirmeleri tek tek takip eder (en fazla 5). Her adımda **SSRF koruması** var: sunucumuzun iç ağına (127.0.0.1, 10.x, 192.168.x, AWS metadata vb.) asla istek atmaz.
   - En fazla 3 MB ve 15 saniye.
2. **HTML analizi** (`lib/html.ts`): sayfadaki tüm `<a href>` linkleri çıkarılır, `<base>` dikkate alınır ve projenin alan adına (alt alan adları dahil, `www` farkı yok) giden link aranır:
   - `rel="nofollow" | "ugc" | "sponsored"` tespit edilir.
   - Sayfa genelinde `<meta name="robots" content="nofollow">` veya `X-Robots-Tag` varsa link fiilen nofollow sayılır.
   - Sayfa `noindex` ise işaretlenir (Google o sayfayı düşürürse link de değer kaybeder).
   - Birden fazla link varsa dofollow olan ve beklenen hedefe giden tercih edilir.
   - Görsel linklerde anchor olarak `alt` metni kullanılır.
3. **Durum makinesi:**

```
            bulundu
pending ─────────────► active ◄──────────── (tekrar bulundu: "recovered" alarmı)
                         │
     link yok (1. kez) ──┤  hâlâ active, 6 saat sonra tekrar dene
     link yok (2. kez) ──┼──► lost      → alarm
     sayfa 4xx/5xx (2x) ─┼──► broken    → alarm
     ağ hatası (3x) ─────┘──► broken
     robots.txt engeli ──────► blocked  (alarm yok, tahmin yok)
```

   **Neden iki ardışık kontrol?** CDN önbelleği, A/B testi, geçici bakım sayfası gibi sebeplerle bir link bir kere görünmeyebilir. Tek seferde "kayıp" demek yanlış alarm üretir. Yanlış alarm veren bir izleme aracını da kimse ciddiye almaz.

4. **Alarmlar toplu üretilir** (`alertForEvents`): 5 link kaybolursa 5 e-posta değil, "5 backlink kaybedildi, en önemlileri: X (otorite 82), Y, Z" diye tek alarm gelir. Dofollow link kaybı **kritik**, nofollow **uyarı** seviyesindedir. Ayrıca şu durumlarda da alarm var: link dofollow→nofollow olduğunda ve linkin bulunduğu sayfa noindex olduğunda.

5. Her kontrol `backlink_checks` tablosuna yazılır (180 gün saklanır), yani linkin geçmişini gün gün görebilirsin.

### 1.3 Zamanlama

`jobs/worker.ts` her dakika vadesi gelen linkleri 200'lük partiler halinde işler. Farklı siteler paralel (8 eşzamanlı), aynı site sırayla gider. Kontrol aralığı plana bağlı: Free haftada bir, ücretli planlar günde bir (`plans.ts`). Sıralamaya ±%10 rastgelelik eklenir ki büyük bir içe aktarma sonsuza kadar aynı saniyede tetiklenmesin.

---

## 2. İndeks izleme

İki katman var (`services/urls.ts`):

**a) Kendi kontrollerimiz — Google'ın gözünden "indekslenebilir mi?"**
- HTTP durumu (yönlendirme varsa ilk adımın kodu)
- `noindex` (meta veya `X-Robots-Tag`)
- canonical: kendisi mi, başka sayfa mı, eksik mi
- `robots.txt` **Googlebot** için bu sayfayı engelliyor mu (bizim botumuz için değil)
- başlık, kelime sayısı, yükleme süresi

**b) Google'ın kendisine sormak — URL Inspection API**
- Kullanıcı Search Console'u **salt okunur** izinle bağlar. Token'lar AES-256-GCM ile şifreli saklanır.
- Google'ın verdiği durum ("Submitted and indexed", "Crawled – currently not indexed" …) bizim 6 kovamıza eşlenir (`mapCoverage`).
- Google mülk başına günde 2.000 sorguya izin veriyor; biz 1.500'de dururuz ve her URL'yi en fazla günde bir kez sorarız.

**Dürüst olmamız gereken bir nokta:** Google normal sayfalar için "indekslemeyi zorla" diye bir API sunmuyor. Indexing API sadece iş ilanı ve canlı yayın sayfaları için ve başka amaçla kullanmak kurallara aykırı. "Garantili indeksleme" vaat eden araçlar ya bu API'yi kötüye kullanıyor ya da hiçbir şey yapmıyor. Indexora sorunu bulur ve neyi düzelteceğini söyler; indeksleme talebini kullanıcı Search Console'dan kendisi yapar.

**Sitemap'ler** (`services/sitemaps.ts`): proje oluşturulunca `robots.txt`'teki `Sitemap:` satırları (yoksa `/sitemap.xml`) bulunur, sitemap index'leri özyinelemeli okunur, URL'ler plan limiti dahilinde izlemeye alınır. Sonraki okumalarda yeni eklenen URL'ler için "12 yeni URL tespit edildi" alarmı gelir.

---

## 3. Bildirimler

`services/notifier.ts`: e-posta (SMTP), Slack, genel webhook. Kullanıcı minimum önem seviyesi seçebilir ya da her şeyi günde bir kez 08:00'de özet olarak alabilir. Gönderilemeyen bildirimler bir sonraki turda tekrar denenir.

---

## 4. Çalıştırma

```bash
cd server
cp .env.example .env      # en azından SECRET_KEY doldur
npm install
npm run dev               # API + arka plan işçisi, http://localhost:8787
npm test                  # 39+ test, internete çıkmadan sahte bir site üzerinde
```

Tek sunucu + SQLite dosyası yeterli. Yedek almak için tek dosyayı kopyalamak yetiyor. Postgres'e geçiş gerektiğinde SQL standart tutuldu.
