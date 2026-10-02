# Lansman planı: 0'dan ilk 10 ödeyen müşteriye

Bu planın tek bir amacı var: **ilk 10 ödeyen müşteri.** İlk 10 müşteri gelir için değil, öğrenmek için. Ürünün kime, hangi cümleyle, hangi fiyata satıldığını onlar öğretir.

---

## 0. Önce kendi siten (1. hafta)

- `indexora.app` (veya seçtiğin alan adı) üzerinde ürünü **kendin kullan**. Kendi landing sayfanı, ücretsiz araç sayfalarını ve blogunu Indexora'ya ekle.
- Ekran görüntüleri, demo videosu ve "dogfooding" hikâyesi buradan çıkar ("Kendi sitemizde 3 noindex hatası yakaladık").
- Google OAuth doğrulama başvurusunu **ilk gün** yap (bkz. DEPLOY.md). En uzun süren iş bu.

## 1. Kimi hedefliyoruz? (tek bir kişi seç)

| Aday | Acı | Ödeme isteği | Ulaşılabilirlik | Karar |
|---|---|---|---|---|
| Ajanslar | Müşteri raporu, kaybolan linkler | Yüksek | Orta | 2. aşama |
| **Link satın alan / guest post yapan site sahipleri** | "Para verdiğim link silindi mi?" | **Yüksek, net** | **Yüksek** (forumlar, Twitter/X, Facebook grupları) | **1. hedef** |
| Geliştiriciler / indie hacker'lar | "Sayfam neden indekslenmiyor?" | Düşük–orta | Yüksek | Ücretsiz araçlarla çek |
| Kurumsal SEO ekipleri | Her şey | Yüksek | Çok düşük | Şimdilik hayır |

**Neden link alıcıları?** Para verdikleri linklerin kaybolması doğrudan para kaybı. "Linkin silinirse 24 saat içinde haberin olur" cümlesi bu kişilere kendi kendini satar. Depodaki ilk Python betiği de tam bu derdi çözmek için yazılmıştı.

## 2. Kanallar (öncelik sırasıyla)

1. **Ücretsiz araçlar (`/tools`)**: "free backlink checker", "check if page links to my site", "indexability checker" gibi aramalarda sıralanması aylar sürer. Asıl işleri, paylaşılabilir bir link olmaları. Her forum cevabında ve tweet'te bir değer olarak kullan, reklam olarak değil.
   - *İleriki iş:* araç sayfalarını sunucu tarafında ön-render et (şu an SPA, Google render edebilir ama yavaş).
2. **Topluluklar** (her biri için önce 2 hafta değer ver, sonra bahset):
   - Reddit: r/SEO, r/TechSEO, r/juststart, r/Entrepreneur (self-promo kurallarını oku!)
   - Indie Hackers, Hacker News "Show HN" (teknik hikâye: "SQLite + tek sunucu ile backlink izleyici")
   - Türkiye: SEO Facebook grupları, Webmaster forumları, Twitter/X'teki Türk SEO topluluğu. Türkçe destek bir rekabet avantajı olabilir.
3. **Doğrudan erişim (en etkili, en ölçeklenemeyen)**: Haftada 20 kişiye kişisel mesaj. Örnek:
   > "Merhaba, X sitesindeki guest post'unu gördüm. Bu tür linklerin ~%10'u bir yıl içinde siliniyor. Linklerini ücretsiz izleyen bir araç yaptım; ilk 100 kullanıcıya ömür boyu $9. Bakmak ister misin?"
4. **Product Hunt**: ilk 20–30 kullanıcıdan geri bildirim ve 2–3 olumlu yorum aldıktan **sonra**. Erken lansman tek kurşunu harcamak demek.
5. **Dizinler**: SaaSHub, AlternativeTo (Ahrefs/Linkody alternatifi olarak), BetaList.
6. **AppSumo / ömür boyu lisans: HAYIR** (gerekçe: PRICING.md §5).

## 3. Mesaj

- **Ana cümle:** "Know exactly what Google sees."
- **Link alıcısı için:** "Paid for a link? Know the day it disappears."
- **İndeksleme derdi olan için:** "Find out why Google ignores your pages — before your traffic does."
- **Dürüstlük farkı:** "We don't promise forced indexing or build links. We show you exactly what's wrong." Sektör abartılı vaatlerle dolu, dürüstlük burada fark yaratıyor.

## 4. Fiyatlandırma deneyleri (ilk 90 gün)

- Kurucu fiyatı ilk 100 kişiyle sınırlı ve bu sınır arayüzde görünüyor ("63 founding seats left"). Aciliyeti yapay sayaçlar değil, gerçek sayı yaratmalı.
- 10 ödeyen müşteriden sonra şunu sor: "Fiyat seni düşündürdü mü?" Kimse "pahalı" demiyorsa Starter'ı $15'e çıkar.
- Pro'yu seçenlerin oranı %20'nin altındaysa Pro'nun değer önerisini (keşif + rakip boşluğu) netleştir.

## 5. Ölçülecekler (her pazartesi bak)

| Metrik | Hedef (90. gün) | Neden |
|---|---|---|
| Ziyaret → kayıt | %3+ | Mesaj işliyor mu? |
| Kayıt → proje oluşturma | %70+ | Onboarding çalışıyor mu? |
| Kayıt → backlink içe aktarma | %40+ | Asıl değeri görüyorlar mı? |
| İlk alarmı alan kullanıcı oranı (14 gün) | %50+ | "Aha" anı: ürün bir şey yakaladı |
| Ücretsiz → ücretli | %3–5 | |
| Aylık iptal (churn) | < %5 | Haftalık özet e-postası bunun için var |

"Aha anı" ilk gerçek alarm. Kullanıcı "Indexora benim yerime bir şey yakaladı" dediği an ürünü anlar. Onboarding'deki her adımın amacı bu ana olabildiğince hızlı ulaştırmak.

## 6. İlk 30 günlük takvim

| Hafta | İş |
|---|---|
| 1 | Sunucu + alan adı + OAuth başvurusu + Lemon Squeezy onayı. Kendi siteni ekle. |
| 2 | 5 tanıdık SEO'cuya ücretsiz kullandır. Onboarding'de takıldıkları her yeri düzelt. |
| 3 | Topluluklarda değer ver (cevaplar, mini rehberler). Haftada 20 kişisel mesaj başlat. |
| 4 | İlk 3 ödeyen müşteriyle 20'şer dakika görüş: neden aldılar, neyi eksik buldular? |

## 7. Bilerek ertelenenler (şimdi yapma)

- Ekip/koltuk yönetimi: tek kullanıcı yeterli, ajans müşterisi gelince yap.
- Beyaz etiket alan adı, API anahtarları: ilk Agency müşterisi isteyince.
- SERP sıralama takibi: Search Console verisi yeterli, pahalı ve riskli.
- Mobil uygulama.

Kural: **bir özelliği ancak iki ödeyen müşteri isterse yap.**
