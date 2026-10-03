# Karar günlüğü

Her kararda önce seçenekleri, sonra kendi itirazlarımı yazıyorum. Yeni kararlar en alta eklenir.

---

### K1 · Backend dili ve çatısı → TypeScript + Hono
- **Seçenekler:** Python (mevcut `main.py` Python), Go, TypeScript.
- **Python lehine:** depoda zaten Python betiği var.
- **İtiraz:** Frontend TypeScript. Tek dil = tipleri paylaşmak, tek kişinin iki ekosistem yönetmemesi. `main.py` 200 satırlık bir prototip, korunacak bir mimari değil.
- **Karar:** TypeScript. Express yerine Hono: daha küçük, tipli ve test etmesi kolay (`app.request()` ile sunucu açmadan test).

### K2 · Veritabanı → Node'un yerleşik SQLite'ı (`node:sqlite`)
- **Postgres lehine:** ölçeklenir, çok sunucu.
- **İtiraz:** 0 müşteride ayrı bir veritabanı sunucusu = ek maliyet ve bakım. SQLite tek dosya; WAL modunda saniyede binlerce yazma kaldırır. `better-sqlite3` native derleme istiyor, `node:sqlite` hiçbir şey istemiyor.
- **Risk:** `node:sqlite` hâlâ "experimental" uyarısı veriyor. → Tüm erişim `db/index.ts`'teki ince bir sarmalayıcıdan geçiyor; sürücü değişirse tek dosya değişir. SQL standart tutuldu.
- **Ne zaman değiştir:** birden fazla API sunucusu gerektiğinde ya da ~50 GB'ı geçtiğinde.

### K3 · İş kuyruğu → SQLite tablosu
- **Redis/BullMQ lehine:** olgun.
- **İtiraz:** Bir altyapı parçası daha. Bizim işler dakikada bir "vadesi gelenleri işle" türünde, saniyede binlerce iş yok.
- **Karar:** `jobs` tablosu + atomik `UPDATE … RETURNING` ile iş alma, `dedupe_key`, üstel geri çekilme, çöken işleri kurtarma.

### K4 · Backlink keşfi → kiralık veri, doğrulama bizde
- Tüm web'i taramak imkânsız. Ama başkasının verisini körü körüne göstermek de yanlış: o veriler haftalar gecikmeli olabiliyor.
- **Karar:** Keşif sağlayıcıdan gelir, ama her link **bizim tarayıcımızla doğrulanmadan** "yeni" olarak gösterilmez. Bu ürünün farkı: "Ahrefs'in söylediği değil, şu an sayfada gerçekten olan."

### K5 · "Kayıp" kaç kontrolde?
- 1 kontrol: hızlı ama yanlış alarm çok. 3 kontrol: güvenilir ama 3 gün gecikme.
- **Karar:** Sayfa açılıyor ama link yoksa 2 kontrol, ikinci kontrol 6 saat sonra (yani kayıp en geç ~6 saatte doğrulanır). Ağ hataları daha gürültülü olduğu için 3 kontrol. robots.txt engeli asla "kayıp" sayılmaz.

### K6 · Search Console izni → salt okunur
- Tam izinle sitemap gönderebilirdik.
- **İtiraz:** Tanınmamış bir ürünün "Search Console'una yazma izni istiyoruz" demesi kayıt oranını düşürür. Sitemap göndermek zaten yılda birkaç kez yapılan bir iş.
- **Karar:** `webmasters.readonly`. Landing sayfasında güven argümanı olarak kullanılıyor.

### K7 · "İndekslemeyi zorla" butonu → yok
- Rakiplerin bir kısmı Indexing API'yi kurallara aykırı şekilde kullanıyor.
- **Karar:** Yapmıyoruz. Arayüzdeki "Request indexing" butonu Search Console'daki ilgili sayfaya yönlendirecek. Dürüstlük, uzun vadede "garantili indeksleme" vaadinden daha çok satar. Yalan vaat iade ve kötü yorum demek.

### K8 · Otomatik link üretme → asla
- Kullanıcı istese bile: Google spam politikası, müşterinin sitesine zarar. Bunun yerine "fırsatlar + outreach taslağı" sunuyoruz.

### K9 · Ödeme → Lemon Squeezy (bkz. PRICING.md §7)

### K10 · Fiyatlar → Free/$12/$29/$79, kurucu fiyatı $9/$19/$49 (bkz. PRICING.md)

### K11 · Agency keşfi günlük → haftalık
- Maliyet hesabı yapınca günlük keşfin marjı yiyebileceği çıktı. Haftalık, link izleme için zaten yeterli bir sıklık.

### K12 · CSRF koruması → SameSite=Lax + Origin kontrolü
- CSRF token'ı SPA için ekstra karmaşa. Lax çerez + durum değiştiren her istekte `Origin` başlığının uygulamanın kendisi olması zorunlu. İmzalı webhook'lar hariç.

### K13 · Test ederken bulunan hatalar
- Alt router'lardaki `use('*', requireUser)`, `/api` altındaki **tüm** yolları (herkese açık fiyat uç noktası dahil) kilitliyordu → yol bazlı ara katmana geçildi.
- `node:sqlite` kullanılmayan isimli parametrede hata veriyor → sarmalayıcı sadece SQL'de geçen parametreleri bağlıyor.
- Hız sınırlayıcı modül seviyesindeydi → uygulama örneği başına.

### K14 · Tek kaynaktan iki mod: /app (gerçek) ve /demo (örnek veri)
- İki ayrı arayüz yazmak kodu ikiye katlar. Sayfalar bir `DataSource` arayüzü üzerinden konuşuyor; `live` API'yi, `demo` örnek veriyi kullanıyor. Demo'da yazma işlemleri dürüst bir "bu bir demo" mesajı veriyor.

### K15 · Backend, derlenmiş frontend'i de sunar
- Ayrı CDN + API yerine tek origin: çerezler birinci taraf kalır, CORS sorunu yok, tek deploy.

### K16 · Anahtar kelimeler: SERP kazıma değil, Search Console
- SERP API'leri sorgu başına ücretli ve kazıma Google koşullarına aykırı. Search Analytics API ücretsiz, gerçek tıklama/gösterim verir ve zaten aldığımız salt okunur izinle çalışır. Sıra takibi yerine "vurucu mesafe" (4–15. sıra) ve "düşük CTR" içgörüleri.

### K17 · Fırsatlar: önce sahip olduğumuz veriden
- Rakip boşluğu ücretli veri istiyor. Ama kaybolan dofollow linkleri geri kazanmak ve 404 sayfaya giden linkleri 301 ile kurtarmak **bedava ve outreach'ten daha yüksek dönüşümlü**. Lansmanda fırsatlar bu ikisinden geliyor.

### K18 · Ücretsiz araçlar (kayıtsız)
- 0 müşteride trafik kaynağı. Kötüye kullanım riskine karşı: IP başına saatte 10, toplam saatte 500 istek; robots.txt'ye uyum; SSRF koruması; sayfa içeriği asla döndürülmüyor.

### K19 · Haftalık özet e-postası
- İzleme ürünleri "her şey yolundayken" görünmez olur ve iptal edilir. Pazartesi özeti ürünün çalıştığını hatırlatır.

### K20 · Yayına alma: tek VPS + Docker Compose + Caddy + Litestream
- Vercel/Netlify sürekli çalışan worker ve kalıcı dosya desteklemiyor. ~5 €/ay VPS + sürekli S3 yedeği en ucuz ve dayanıklı seçenek. Fly.io alternatif olarak hazır.

### K21 · Uçtan uca testte bulunan hatalar
- Yanıt süresine sunucu başına nezaket beklemesi karışıyordu, her site "yavaş" görünüyordu → sadece ağ süresi ölçülüyor.
- `index.html` açılışta önbelleğe alınıyordu, yeniden derlemede eski dosyalara işaret ediyordu → değişince yeniden okunuyor.
- `timeAgo` sabit bir "şimdi" kullanıyordu → gerçek saat.
- Anahtar kelime önbelleği iki farklı saat kaynağı kullanıyordu → `ctx.now()`.

### K22 · Kendi kodumun güvenlik incelemesi
- **DNS rebinding:** IP kontrolü bağlantıdan önce yapılıyordu, `fetch` ise DNS'i yeniden çözüyordu. Kötü niyetli bir DNS önce genel, sonra özel IP döndürebilirdi (ücretsiz araçlar herkese açık olduğu için ciddi). → Bağlantı anında çalışan, özel IP'leri reddeden bir undici `Agent`. Node'un yerleşik `fetch`'i farklı bir undici sürümü gömdüğü için tarayıcı undici'nin kendi `fetch`'ine geçirildi.
- **Slack biçimlendirme enjeksiyonu:** üçüncü taraf sayfalardan gelen anchor metinleri Slack'te sahte link olabiliyordu → `& < >` kaçışlanıyor.

### K23 · Kurucu paneli: harici analitik yerine kendi veritabanımız
- **Lehte:** Plausible veya PostHog gibi harici araçlar kurulum, maliyet ve çerez/KVKK yükü getiriyor. 0 müşteride ihtiyacım olan tek şey hunide nerede kaybettiğim, ve bu zaten veritabanında var.
- **Aleyhte:** sayfa görüntüleme verisi yok.
- **Karar:** IP ve parmak izi tutmayan küçük bir `events` tablosu, `/app/admin` sayfasında huni, MRR, kurucu koltukları ve günlük kayıtlar. Panel yalnızca `ADMIN_EMAILS`'taki hesaplara görünür; diğer herkes için API 404 döner, yani varlığı bile belli olmaz.

### K24 · Aktivasyon e-postaları
- **Lehte:** SaaS'ta kayıt olanların büyük kısmı ilk gün hiçbir şey yapmadan çıkar. Hatırlatma ücretsizdir.
- **Aleyhte:** spam hissi.
- **Karar:** üç e-postalık bir dizi, her biri hunideki bir sonraki eksik adımı hedefliyor:
  1. 1. gün: site eklenmemişse.
  2. 3. gün: backlink eklenmemişse.
  3. 5. gün: Search Console bağlanmamışsa (yalnızca Google OAuth yapılandırılmışsa).
- **Kurallar:**
  - Her e-posta bir kez gider.
  - İki e-posta arasında en az 48 saat olur.
  - Yalnızca ilk 14 gündeki ücretsiz kullanıcılara gider; böylece özellik yayına girdiğinde eski hesaplar e-posta yağmuruna tutulmaz.
  - E-posta tercihini kapatan kullanıcıya hiçbir şey gitmez.
  - Kayıt, gönderimden *önce* yazılır: çökme olursa e-posta bir kez eksik gider ama asla iki kez gitmez.

### K25 · Satılan her özellik gerçekten var olmalı
- Fiyat tablosunu kodla karşılaştırdım. "API" (Pro), "white-label rapor" (Agency) ve "koltuk" (Pro 3, Agency 10) vaat ediliyordu, ama hiçbiri gerçek değildi. 0 müşterili bir ürünün ilk iadesi bu yüzden gelir.
- **API anahtarları:**
  - `Authorization: Bearer ix_…`.
  - Yalnızca hash saklanıyor; anahtar bir kez gösteriliyor.
  - Anahtar başına dakikada 120 istek.
  - Anahtar hesabı, faturayı, Google bağlantısını ve diğer anahtarları yönetemez. Sızan bir anahtar en kötü ihtimalle izleme verisine dokunur, hesabı ele geçiremez.
  - Plan düşürülünce anahtar 402 döner, silinmez; tekrar yükseltince aynen çalışır.
