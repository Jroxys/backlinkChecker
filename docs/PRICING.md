# Fiyatlandırma — 0 müşteriden başlayan biri için

> Rakip fiyatları yaklaşık değerlerdir ve değişir. Lansmandan önce sitelerinden tekrar kontrol et.

## Sonuç

| Plan | Aylık | Yıllık (2 ay bedava) | Kurucu fiyatı* | Proje | URL | Backlink | Kontrol sıklığı | Keşif |
|---|---|---|---|---|---|---|---|---|
| **Free** | $0 | — | — | 1 | 100 | 100 | backlink haftalık, URL günlük | — |
| **Starter** | $12 | $120 | **$9** | 3 | 1.000 | 1.000 | günlük | — |
| **Pro** ⭐ | $29 | $290 | **$19** | 10 | 10.000 | 10.000 | günlük, URL 12 saatte | haftalık |
| **Agency** | $79 | $790 | **$49** | 50 | 50.000 | 50.000 | günlük, URL 6 saatte | haftalık |

\* İlk 100 ücretli müşteri, abonelik devam ettiği sürece bu fiyatı ömür boyu korur. Sadece aylık planlarda geçerli.

Tek gerçek kaynak: `server/src/plans.ts`. Landing sayfasındaki tablo onu yansıtır.

## Neden bu rakamlar? (kendimle tartışma)

### 1. Eski fiyatlar ($39 / $129 / $349) neden yanlıştı
- Ahrefs (~$129+) ve Semrush (~$140+) seviyesinde fiyat koyuyordu. Bu araçlar anahtar kelime, rakip trafiği ve site denetimi içeren devasa paketler.
- Bizim değerimiz daha dar ama daha keskin: **"linkin kaybolduğunda ve sayfan indeksten düştüğünde haberin olur."**
- Kimsenin tanımadığı bir ürün, pazar liderinin fiyatından kart bilgisi alamaz. 0 müşteride en büyük risk "çok ucuz" olmak değil, **hiç kimsenin denememesi**.

### 2. Rakip çapası
- Sadece backlink izleyen araçlar (Linkody, Monitor Backlinks vb.): ~$15–$150/ay.
- İndeks kontrol araçları çoğunlukla URL başı kredi satıyor.
- **Karar:** Starter ($12) bu segmentin altında. Pro ($29) "ciddi kullanıcı" çapası; asıl gelir buradan gelecek.

### 3. Maliyet tabanı — fiyatı ne kadar düşürebiliriz?
- Bir backlink doğrulaması = 1 HTTP isteği + HTML parse. 10.000 link/gün, 5–10 €'luk bir VPS'te (ör. Hetzner CX22) zahmetsiz çalışır.
- Search Console API'leri ücretsiz (kota: mülk başına günde 2.000 inceleme).
- **Pahalı tek kalem keşif:** DataForSEO Backlinks API sorgu başına ücretli ve (son bildiğim kadarıyla) aylık ~$100 minimum taahhüt istiyor. Bu yüzden:
  - Keşif sadece Pro/Agency'de ve **haftalık**. Agency'de "günlük" planlıyordum: 50 proje × 30 gün sorgu, $79'luk planın marjını yiyebilirdi. Haftalığa çektim.
  - **Lansmanda keşfi kapalı tut.** ~5 Pro müşteriye (≈$100+ MRR) ulaşınca `DATAFORSEO_*` değişkenlerini doldur. O zamana kadar Pro müşterilere "keşif yakında" de ve içe aktarmayı öne çıkar.
- Ödeme sağlayıcı komisyonu (Lemon Squeezy ~%5 + $0,50): $12'den net ~$10,9; $9 kurucu fiyatından net ~$8.

### 4. Ücretsiz plan — gerekli mi?
- **Karşı argüman:** destek yükü getirir, ücretsiz kullanıcılar az dönüşür.
- **Lehte argüman:** maliyeti neredeyse sıfır (100 link haftalık = günde ~15 istek). En önemlisi, izleme ürününün değeri **zamanla** ortaya çıkıyor: ilk "linkin kayboldu" e-postası geldiğinde kullanıcı ürünün işe yaradığını görüyor. 14 günlük deneme bu anı çoğu zaman yakalayamaz.
- **Karar:** Ücretsiz plan kalsın ama dar olsun (1 proje). Ücretli planlarda 14 gün kartsız deneme.

### 5. Kurucu müşteri indirimi mi, ömür boyu lisans (LTD) mı?
- **LTD (ör. AppSumo):** hızlı nakit getirir ama sonsuza kadar destek ve sunucu maliyeti doğurur, sonra da ücretli müşteriye dönüşmez. Sıfır gelirli bir ürünün geleceğini satmak demek.
- **Kurucu fiyatı:** düzenli gelir (MRR), erken kullanıcıyı ödüllendirir, "ilk 100" sınırı aciliyet yaratır. Müşteri iptal ederse fiyat hakkı kaybolur, bu da churn'ü azaltır.
- **Karar:** Kurucu fiyatı. Backend'de `users.founding` alanı ve kalan koltuk sayısı (`GET /api/billing/plans`) hazır.

### 6. Para iadesi garantisi
"İlk 30 günde tek bir sorun veya kayıp link yakalamazsak paranı iade ederiz." Böyle bir garanti sıfır müşteri aşamasında güven inşa eder. İzleme aracında bu garantinin tetiklenmesi de nadir, çünkü neredeyse her sitede en az bir canonical veya noindex sorunu çıkıyor.

### 7. Ödeme altyapısı: neden Lemon Squeezy (Stripe değil)
- Stripe, Türkiye merkezli satıcıları desteklemiyor.
- Yurt dışına SaaS satarken AB KDV'si, İngiltere VAT'ı ve ABD eyalet satış vergisi yükümlülükleri doğuyor. **Merchant of Record** (Lemon Squeezy / Paddle) bu vergileri kendi adına toplayıp ödüyor; sana net tutarı gönderiyor.
- Komisyon daha yüksek ama alternatifi yurt dışında şirket kurup vergi danışmanı tutmak.
- Kurulum: Lemon Squeezy'de 4 ürün varyantı (+ 3 kurucu varyantı) oluştur, "buy link"leri `LEMONSQUEEZY_CHECKOUT_URLS`'e, varyant ID → plan eşlemesini `LEMONSQUEEZY_VARIANT_PLANS`'e yaz, webhook'u `POST /api/billing/webhooks/lemonsqueezy` adresine yönlendir.

## Ne zaman fiyatı değiştirmeli?
- **İlk 10 ücretli müşteriden** sonra: kimse "pahalı" demiyorsa Starter'ı $15'e çıkar (kurucular etkilenmez).
- Pro'dan Agency'ye geçen yoksa Agency'yi koltuk/beyaz etiket odaklı yeniden paketle.
- Ücretsiz → ücretli dönüşümü %2'nin altındaysa ücretsiz limitleri daralt; %8'in üstündeyse ücretsiz plan fazla cimri olabilir.
