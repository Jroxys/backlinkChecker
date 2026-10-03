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
- **White-label:** Agency planında marka adı, https logo URL'si ve vurgu rengi raporlara uygulanıyor; Indexora adı ve logosu kaldırılıyor.
  - Logo bağlantısını sunucu hiç indirmiyor (SSRF riski yok); yalnızca kullanıcının tarayıcısı `no-referrer` ile yüklüyor.
  - `javascript:` gibi şemalar doğrulamada reddediliyor.

### K26 · Koltuklar: tam "çalışma alanı" modeli değil, "sahibin hesabı = çalışma alanı"
- **Seçenekler:**
  - (a) Koltuğu fiyattan kaldırmak: dürüst ama Agency planını zayıflatır.
  - (b) Çoklu çalışma alanları: her sorguyu değiştirmek gerekir, büyük iş.
  - (c) Üye, sahibin hesabında çalışır.
- **Karar:** (c). İstekte `user` (kim giriş yaptı) ve `account` (kimin hesabında çalışıyor) ayrıldı. Veri rotaları `account`'u kullanıyor; servisler zaten proje sahibinin planını kullanıyordu.
- **Yalnızca sahip yapabilir:** fatura, Google bağlantısı, marka ayarları, ekip yönetimi.
- **Davetler:**
  - Davet bağlantısı 7 gün geçerli.
  - Bekleyen davet de bir koltuk sayılır.
  - Davet yalnızca davet edilen e-posta adresiyle kabul edilebilir.
  - Kendi projesi olan bir hesap üye olamaz; böylece veri karışmaz ve kimsenin verisi sessizce kaybolmaz.
- **Plan düşürülürse:** son katılan üyeler askıya alınır, silinmez. Askıdaki üye hesabını görebilir, ekipten ayrılabilir veya hesabını silebilir. Plan yükseltilince erişim aynen geri gelir.
- **Uyarılar** sahibe e-postayla gider. Tüm ekibe ulaşmak için Slack webhook öneriliyor (bunu arayüzde de söylüyoruz).
- **Güvenlik:** giriş ve kayıt sonrası `next` parametresi artık yalnızca uygulama içi yolları kabul ediyor (açık yönlendirme koruması).
- **Süreç dersi:** derleme hata verdiği halde bir commit gitti, çünkü komutlar ayrı satırlardaydı. Bundan sonra derleme ve commit aynı `&&` zincirinde çalışıyor.

### K27 · Müşteri rapor bağlantısı ve aylık rapor e-postası
- Starter planında "aylık raporlar" vaat ediliyordu; elimizde yalnızca yazdırılabilir bir sayfa vardı. Ajanslar için PDF göndermekten daha değerlisi, müşterinin her zaman güncel bir bağlantıya sahip olması.
- **Bağlantı `/r/:token`:**
  - Tahmin edilemez bir token, giriş gerekmez, salt okunur.
  - Yenilenebilir (eski bağlantı hemen ölür) ve kapatılabilir.
  - Plan rapor özelliğini kaybedince bağlantı 404 döner.
  - `noindex` ve `X-Robots-Tag` ile işaretli; `robots.txt` içinde engelli.
  - IP başına saatte 120 istek.
  - **Önemli:** herkese açık bağlantı hiçbir zaman Google API çağrısı tetiklemez; yalnızca kayıtlı veri okunur. Aksi halde bir bağlantıyı yenileyen biri kullanıcının Search Console kotasını tüketebilirdi.
- **Uygulama içi ve paylaşılan rapor** aynı `ReportDocument` bileşenini ve aynı sunucu yükünü kullanıyor; müşteri tam olarak bizim gördüğümüzü görüyor.
- **Aylık e-posta:**
  - Ayın 1'inde, yalnızca ücretli planlara gider.
  - Her ay en fazla bir kez gider; kapatma seçeneği Uyarılar sayfasında.
  - Paylaşım bağlantısı varsa e-postaya eklenir.

### K28 · Landing sayfası metin denetimi
- "Rakiplerin referans alan adı büyümesini aylık karşılaştırma" vaadi kaldırıldı; geçmiş veri ücretli bir kaynak gerektiriyor ve elimizde yok. Yerine gerçekte yaptığımız yazıldı: yetkiye ve rakip sayısına göre sıralanmış link boşluğu.
- "Raporlar zamanında gönderilir" vaadi artık doğru: aylık e-posta ve canlı müşteri bağlantısı. "PDF gönderilir" iddiası ise kaldırıldı; PDF tarayıcıdan alınıyor.
- "Ekibimiz birkaç saat içinde yanıt verir" ifadesi tek kişilik bir kurucu için gerçekçi değil. "Bir iş günü içinde" olarak değiştirildi.
- Otomasyonlar sayfasına gerçekten çalışan ama listede görünmeyen işler eklendi: robots.txt izleyici, haftalık özet ve aylık rapor.

### K29 · SSL ve alan adı süresi izleme
- **Lehte:**
  - Sertifikanın veya alan adının süresinin dolması küçük siteler için en yaygın "site çöktü" sebeplerinden biri.
  - Yapması ucuz: günlük bir TLS bağlantısı ve haftalık bir RDAP isteği.
  - Kullanıcıya her gün "izleniyorsun" hissi verir.
- **Aleyhte:** SEO ürününün ana işi değil. Ama indekslenme ve sıralama, sitenin açık olmasına bağlı.
- **Karar:** yap.
  - Uyarılar 30, 14, 7, 3 ve 1 gün kala gider; her eşik bir kez. Yenilenince eşikler sıfırlanır ve "yenilendi" bildirimi gider.
  - Güvenilmeyen sertifika (yanlış host, kendinden imzalı) tarih uygun olsa bile bir kez kritik uyarı üretir.
  - Kök alan adında HTTPS yoksa `www.` deneniyor.
  - RDAP her TLD'de yayınlanmıyor; o durumda "bu kayıt otoritesi yayınlamıyor" deniyor, hata verilmiyor.
- **Güvenlik:** TLS bağlantısı da tarayıcıyla aynı bağlantı anı DNS korumasını (`guardedLookup`) kullanıyor; ortak kod tek yere taşındı.

### K30 · Bağımsız güvenlik incelemesinin bulguları ve düzeltmeler
Yeni yetki yüzeylerini (API anahtarları, ekipler, herkese açık raporlar) ve faturalandırmayı ayrı bir ajana inceletttim. Bulunan ve düzeltilen sorunlar:
1. **Abonelik iptal edilince plan anında ücretsize düşüyordu.** Müşteri parasını ödediği süreyi kaybediyordu. Artık "cancelled" durumu dönem sonuna kadar ücretli sayılıyor; plan yalnızca süre dolunca veya ödeme alınamayınca düşüyor.
2. **Kurucu rozeti satın alma sayfası adresinden taklit edilebiliyordu** (`custom_data`). Artık yalnızca satın alınan varyanttan (`pro:founding`) belirleniyor.
3. **Eski bir aboneliğe ait geç gelen olaylar** yeni planı bozabiliyordu. `subscription_id` saklanıyor; yalnızca güncel aboneliğin olayları planı değiştirebiliyor.
4. **Ekip üyelerine "henüz site eklemedin" e-postası gidiyordu.** Üyeler artık aktivasyon e-postalarının dışında.
5. **Birden fazla yönlendirici aynı yolu eşleştirdiği için kimlik doğrulama bir istekte 5 kez çalışıyordu.** API anahtarı sınırı fiilen 120 yerine yaklaşık 24'e düşüyordu. Artık istek başına bir kez çalışıyor.
6. **Koltuk sınırındayken aynı kişiyi yeniden davet etmek** önce eski daveti siliyor, sonra 402 döndürüyordu; davet kayboluyordu. Kontrol artık silmeden önce yapılıyor.
7. **Aylık rapor:**
   - Gönderim hatası tüm işi durduruyor ve kullanıcıyı "gönderildi" olarak işaretliyordu.
   - İş yerel saat dilimine bağlı 2 dakikalık tek bir pencerede çalışıyordu.
   - Artık saatlik çalışıyor ve ayın ilk üç günü (UTC) geçerli. Kullanıcı yalnızca başarılı gönderimden sonra işaretleniyor, hatalar kullanıcı bazında yakalanıyor. Özet ve günlük bülten de UTC'ye geçti.
8. **Uyarı ayarları:**
   - Ekip üyeleri ve sızmış bir API anahtarı uyarıların gideceği webhook adresini değiştirip tüm uyarı verisini kendine yönlendirebiliyordu.
   - Artık ayarları yalnızca hesap sahibi değiştirebiliyor; uyarı hedefleri ise yalnızca tarayıcı oturumuyla değişebiliyor.
9. **Hız sınırları** istemcinin yazabildiği ilk `X-Forwarded-For` değerine bakıyordu, giriş denemelerinin sınırı da buna dahildi. Artık vekil sunucunun eklediği son değer kullanılıyor ve sınırlayıcı bellek tablosu temizleniyor.
10. **Bekleyen davetleri olan biri başka bir ekibe katılabiliyordu.** Bu artık engelli.

Kurucu panelinin e-postayla belirlenmesi ve e-posta doğrulamasının olmaması DEPLOY.md'de belgelendi: yönetici hesabını yayından önce kendin aç.

### K31 · İki yeni ücretsiz araç: yönlendirme denetleyici ve SSL denetleyici
- 0 müşteride en önemli darboğaz trafik. Ücretsiz araçlar arama motorlarından gelen ziyaretçinin girişi. Bu iki araç sık aranıyor ve elimizdeki parçalarla (tarayıcı, TLS yoklaması) neredeyse bedavaya yapıldı.
- **Yönlendirme denetleyici:**
  - URL'nin zincirini adım adım gösteriyor.
  - 302/307 geçici yönlendirmeleri ve 2 veya daha fazla adımlı zincirleri işaretliyor.
  - http/https × www/www'siz dört varyantın tek bir adrese çıkıp çıkmadığını kontrol ediyor. Yinelenen ana makine, gerçek ve yaygın bir SEO hatası.
- **SSL denetleyici:** OpenSSL hata kodlarını sade İngilizceye çeviriyor: süresi dolmuş, yanlış ana makine, kendinden imzalı, eksik ara sertifika.
- **Her araç sayfasının sonunda** ilgili izleme özelliğine yönlendiren bir çağrı var. Araç sorunu bir kez gösteriyor, ürün sürekli izliyor.
- **Güvenlik ve sınırlar:** diğer araçlarla aynı IP ve genel sınırlar geçerli; SSRF koruması bağlantı anında yapılıyor.

### K32 · Core Web Vitals: kendi ölçümümüz değil, CrUX saha verisi
- **Seçenekler:**
  - (a) PageSpeed Insights API ile laboratuvar ölçümü: yavaş (sayfa başına ~20 sn) ve Google'ın sıralamada kullandığı veri bu değil.
  - (b) Kendi tarayıcımızla Lighthouse çalıştırmak: sunucuda Chrome demek, pahalı.
  - (c) Chrome UX Report History API: ücretsiz, gerçek kullanıcı verisi ve Google'ın sayfa deneyimi sinyali tam olarak bu. Tek çağrıda 25 haftalık geçmiş geldiği için grafik ilk günden dolu.
- **Karar:** (c). Origin düzeyinde, telefon, p75 değerleri: LCP, INP, CLS (ek olarak FCP ve TTFB saklanıyor).
- **Ayrıntılar:**
  - Haftada bir yenileniyor.
  - Bir metriğin derecesi kötüleşirse (iyi → iyileştirilmeli → kötü) tek bir uyarı gidiyor.
  - Az trafikli siteler CrUX'ta görünmüyor; bu durum hata gibi değil, açıklamasıyla gösteriliyor.
  - `CRUX_API_KEY` yoksa kart tamamen gizleniyor.
- **Test edilebilirlik:** sandbox CrUX'a erişemiyor. İstemci `fetch` enjekte edilebilir şekilde yazıldı ve testler belgelenmiş yanıt biçimiyle çalışıyor.

### K33 · Blog: depodaki Markdown, sunucu tarafında önceden işleme
- **Neden:** LANSMAN.md'ye göre 0 müşteride ana kanal içerik ve SEO, ama yayın yapacak bir yer yoktu.
- **Seçenekler:**
  - (a) Ayrı bir CMS veya Ghost: ayrı alan adı ve ayrı bakım; ayrıca alt alan adı ana alan adının otoritesini paylaşmaz.
  - (b) Depoda Markdown: yazmak bir dosya eklemek kadar kolay, sürüm kontrolü bedava, tek dağıtım.
- **Karar:** (b).
  - Sunucu `content/blog/*.md` dosyalarını `marked` ile işliyor.
  - Makale sayfaları tarayıcılar için önceden işlenmiş HTML olarak sunuluyor: başlık, açıklama, `og:type=article`, Article JSON-LD ve `#root` içinde makalenin kendisi. React yüklenince bu içeriği yeniden çiziyor.
  - Gelecek tarihli yazılar o güne kadar gizli kalıyor (zamanlanmış yayın), `draft: true` olanlar hiç yayınlanmıyor.
  - Site haritasında yazılar `lastmod` ile yer alıyor.
- **İlk üç yazı** ücretsiz araçların çözdüğü uzun kuyruk sorunları hedefliyor:
  1. Backlink hâlâ duruyor mu nasıl kontrol edilir?
  2. "Crawled – currently not indexed" ne demek?
  3. Taşıma sonrası yönlendirme kontrol listesi
  Her yazı ilgili ücretsiz araca ve ürüne bağlanıyor. Kural: önce gerçekten faydalı bir rehber, en sonda tek bir yumuşak çağrı.
- **Yan bulgu:** `Container` bileşeninde `max-w-*` sınıfları çakışıyordu; araç ve yasal sayfalar da bu yüzden olması gerekenden geniş görünüyordu. Düzeltildi.

### K34 · Ters deneme (reverse trial) ve plan düşünce sınır uygulaması
- **Bulgu:** fiyat sayfası "14 günlük deneme, kart gerekmez" diyordu ama deneme diye bir şey yoktu; `?plan=pro` ile kaydolan kullanıcı Free'de başlıyordu. Bir ikinci bulgu daha: plan düşünce (iptal veya süre dolması) hiçbir sınır uygulanmıyordu. Agency'den Free'ye düşen bir hesap 50.000 URL'yi bedavaya taramaya devam ederdi.
- **Seçenekler:**
  - (a) Metni "ücretsiz başla" olarak değiştirmek.
  - (b) Klasik deneme: plan seçen, kartını girer.
  - (c) Ters deneme: herkes 14 gün Pro'yla başlar, kart istenmez, sonra Free'ye düşer.
- **Karar:** (c).
  - 0 müşteride en büyük risk, kullanıcının ürünün değerini hiç görmemesi. Pro'da günlük kontroller, keşif ve rakip boşluğu ilk hafta "aha" anını getirir.
  - Kart istememek kayıt sürtünmesini sıfırlar.
  - Bilinen bir PLG (ürün odaklı büyüme) taktiği.
- **Uygulama:**
  - Kayıtta `plan = pro` ve `trial_ends_at = +14 gün`.
  - Saatlik iş, bitişe 3 gün kala tek bir hatırlatma gönderiyor; süre dolunca Free'ye düşürüp "deneme bitti" e-postası gönderiyor.
  - Deneme sırasında abonelik başlarsa denemeyi kapatıyor, düşürmüyor.
- **Sınırlar:**
  - Her plan değişikliğinden sonra (deneme bitişi, webhook) `enforceLimits` çalışıyor.
  - En eski kayıtlar yerini koruyor; fazlası **silinmiyor**, duraklatılıyor (`paused`, `next_check_at = NULL`), dolayısıyla tarayıcı onlara dokunmuyor.
  - Yükseltilince otomatik devam ediyor. Arayüzde neyin neden duraklatıldığı açıkça yazıyor.
- **Ölçümler:**
  - Kurucu panelinde denemedeki hesaplar ödeyen sayılmıyor ve MRR'a girmiyor.
  - Aktivasyon e-postaları deneme kullanıcılarına da gidiyor.
  - Aylık rapor yalnızca gerçek ödeyenlere gidiyor.
- **Ayar:** `TRIAL_DAYS=0` ile deneme kapatılabilir.

### K35 · Türkçe tanıtım sayfası (/tr), uygulama İngilizce kalıyor
- **Lehte:**
  - Kurucunun en ucuz dağıtım kanalı kendi yerel ağı: Türk SEO'cuları ve ajansları.
  - Türkçe aramalarda rekabet daha az.
- **Aleyhte:** tam bir i18n altyapısı tüm ekranlarda metin bakımını ikiye katlar.
- **Karar:** yalnızca pazarlama sayfası Türkçe. Çeviri değil, Türkçe olarak yazıldı.
  - Uygulamanın İngilizce olduğu SSS'de açıkça söyleniyor.
  - Menü ve altbilgi dile duyarlı; sayfalar arasında karşılıklı dil bağlantısı var.
  - Sunucu `/tr` için `<html lang="tr">`, Türkçe meta ve `hreflang` (en/tr/x-default) üretiyor.
- **Ayrıca:** İngilizce ana sayfadaki iki abartılı ifade düzeltildi. "Gerçek zamanlı URL Inspection" ifadesi yanlıştı, kontroller günlük. "Free plan, no card" ise artık "14 gün Pro, kart yok".

### K36 · "İlk tarama bitti" e-postası
- **Aktivasyon hunisindeki en zayıf nokta:** kullanıcı siteyi ekliyor, tarama birkaç dakika sürüyor, kullanıcı o arada sekmeyi kapatıyor ve bir daha dönmüyor. Ürünün neyi yakaladığını hiç görmüyor.
- **Karar:** her proje için tek bir özet e-postası.
  - Ne zaman: tüm URL'ler ilk kez kontrol edilince ya da en geç 6 saat sonra.
  - İçerik: kaç URL kontrol edildi, denetim puanı, noindex / hata / robots engeli / başka sayfaya canonical / yönlendirme sayıları ve backlink durumu.
  - Backlink yoksa bir sonraki adım olarak içe aktarmayı öneriyor.
  - Konu satırında bulgu sayısı yazıyor; açılma oranını en çok bu artırır.
- **Kurallar:**
  - Önce "gönderildi" işaretleniyor, sonra gönderiliyor: hiçbir zaman iki kez gitmez.
  - E-postayı kapatan kullanıcıya gitmiyor.
  - Yalnızca son 72 saatte açılan projelere gidiyor; böylece özellik yayına girdiğinde eski projelere e-posta yağmaz.

### K37 · İkinci bağımsız inceleme: deneme ve sınırlar etrafındaki hatalar
Yeni kodu (deneme, sınırlar, blog, dışa aktarma, CWV, araçlar) yine ayrı bir ajana inceletttim. Bulunan ve düzeltilen sorunlar:
1. **Duraklatılan kayıtlar sonsuza kadar taranabiliyordu.** "Şimdi tara", tek tek yeniden kontrol, robots değişikliği ya da bir yarış durumu duraklatılmış bir satıra yeniden tarih yazınca, satır her turda taranıyordu. Artık:
   - taramalar `paused = 0` filtreliyor,
   - kontrol sonucu duraklatılmış bir satıra asla yeni tarih yazmıyor,
   - yeniden kontrol 402 döndürüyor.
2. **SSL aracında SSRF vardı.** `tls.connect`, IP adresi verilince DNS adımını (ve dolayısıyla korumamızı) atlıyor; `127.0.0.1` veya `169.254.169.254` taranabiliyordu. Artık IP adresleri reddediliyor; sertifika yoklaması da özel IP'leri kendisi kontrol ediyor.
3. **Yer açılınca duraklatılanlar devam etmiyordu.** Silme işlemlerinden sonra `enforceLimits` çalışıyor.
4. **Proje sınırı uygulanmıyordu.** Free'ye düşen bir hesap 10 projenin hepsini taratmaya devam ediyordu. Artık fazla projeler de duraklatılıyor; robots, sitemap, sağlık, CWV ve keşif işleri bu projeleri atlıyor.
5. **Plan düşünce Slack ve webhook uyarıları çalışmaya devam ediyordu.** Kanallar artık gönderim anındaki plana göre açılıp kapanıyor.
6. **Ücretli keşif API'sinde maliyet riski vardı.** Her kayıt Pro olduğu için deneme hesapları da her proje için DataForSEO çağırıyordu. Sonuç dönmeyen projeler ise her saat yeniden sorgulanıyordu. Artık:
   - keşif yalnızca ödeyen hesaplarda çalışıyor,
   - proje başına "son sorgu" zamanı tutuluyor.

**Daha düşük öncelikli olanlar:**
- Başarısız bir ödeme denemesi denemeyi erken bitirmiyor.
- Ekibe katılanın kendi denemesi kapanıyor, ona deneme e-postası gitmiyor.
- HTML enjeksiyonunda `$&` kalıplarına karşı fonksiyon tabanlı değiştirme kullanılıyor.
- Var olmayan blog yolları artık 404 dönüyor.
- Blog dosyası okunurken silinirse 500 yerine önbellek sunuluyor.
- Yönlendirme aracı (5 istek yapıyor) saatlik hakkın 3'ünü tüketiyor.

### K38 · Neden burada durdum?
- Fiyat sayfasında vaat edilip eksik kalan her şey tamamlandı: deneme, API, koltuklar, white-label, aylık rapor ve müşteri bağlantısı.
- İki bağımsız güvenlik incelemesinin tüm bulguları düzeltildi ve her biri için regresyon testi yazıldı. Toplam 100 test geçiyor.
- Müşteri edinmenin ilk adımları da hazır:
  - 4 ücretsiz araç, blog ve 3 rehber, Türkçe tanıtım sayfası
  - ters deneme, aktivasyon e-postaları, ilk tarama e-postası, kurulum listesi
- Bundan sonrası müşteri olmadan yapılırsa tahmine dayanır. LANSMAN.md'deki kural geçerli: **bir özelliği ancak iki ödeyen müşteri isterse yap.**
- Sıradaki iş kod değil, dağıtım:
  1. Yayına al (DEPLOY.md).
  2. Google OAuth doğrulamasını başlat.
  3. Kendi siteni ekle.
  4. 5 tanıdık SEO'cuya kullandır.
  5. Haftada bir blog yazısı yayınla.

### K39 · "Gerçek zamanlıya yakın" izleme
- **Neden:** rakip raporundaki zayıflık "kontroller günlük, gerçek zamanlı değil" idi. Her sayfayı her dakika taramak pahalı ve gereksiz; pahalı hatalar az sayıda yerde olur: site çöker, bir deploy ana sayfalara noindex ekler ya da robots.txt Google'ı engeller.
- **Karar:**
  - **İzleme aralığı plana göre:** Free 60 dk, Starter 15 dk, Pro ve Agency 5 dk.
  - **Öncelikli sayfalar:** önce ana sayfa, sonra Search Console'da en çok tıklanan sayfalar, sonra sitemap'teki kısa yollu sayfalar. Kullanıcı ayrıca kendisi seçebilir. Plan başına sayfa sayısı: 1, 5, 20, 50. Bu sayfalar günlük yerine izleme aralığında kontrol ediliyor.
  - **Uptime:** ilk hatada bir dakika sonra tekrar bakılıyor. Uyarı ancak iki hata üst üste gelince gidiyor; tek bir anlık kesinti alarm üretmiyor. Site geri gelince "geri döndü" bildirimi kesintinin süresiyle birlikte gidiyor ve kesintiler kayıt altına alınıyor.
  - **robots.txt:** saatlik yerine izleme aralığında kontrol ediliyor.
  - **Deploy hook:** kullanıcının yayın sistemi `POST /api/hooks/deploy/<token>` çağırır ve öncelikli sayfalar, robots.txt ve uptime bir dakika içinde kontrol edilir. Hatalar çoğunlukla deploy anında doğduğu için bu, sürekli taramadan daha isabetli. Dakikada en fazla 6 istek kabul ediliyor; token yenilenebiliyor.
  - **Uyarı teslimi:** 5 dakikadan 1 dakikaya indi.
- **Dürüstlük:** bunu "gerçek zamanlı" diye değil, "kritik sayfalar 5 dakikada bir" diye satıyoruz.
