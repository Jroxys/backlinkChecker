import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, Link2, ScanSearch, ShieldCheck, Gauge, Bell, FileBarChart2, Unlink, FileWarning, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { HeroPreview } from '@/components/marketing/HeroPreview'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Container, Footer, Nav } from './Landing'

/**
 * Turkish landing page (/tr). Written for Turkish SEO specialists and agencies, not a
 * word-for-word translation. The app itself is in English — we say so up front.
 */
export function LandingTr() {
  usePageTitle('Indexora — Google sitende ne görüyor, tam olarak bil')
  return (
    <div lang="tr" className="min-h-screen bg-bg">
      <Nav lang="tr" />
      <Hero />
      <Problems />
      <Features />
      <Steps />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer lang="tr" />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute top-[-280px] left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.22),transparent)]" />
      <Container className="relative pt-16 pb-20 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="display animate-rise text-[40px] leading-[1.05] font-semibold text-fg sm:text-[60px]">
            Google sitende ne görüyor,{' '}
            <span className="bg-gradient-to-br from-[#818CF8] via-[#6366F1] to-[#4F46E5] bg-clip-text text-transparent">tam olarak bil.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl animate-rise text-[17px] leading-relaxed text-fg-3 [animation-delay:120ms] sm:text-[18px]">
            İndeks durumu, indekslenebilirlik ve her backlink — her gün senin yerine kontrol edilir. Bir şey değiştiğinde aynı gün haber verir.
          </p>
          <div className="mt-9 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
            <Link to="/signup">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight />}>
                14 gün Pro’yu ücretsiz dene
              </Button>
            </Link>
            <Link to="/demo">
              <Button variant="secondary" size="lg">
                Canlı demoyu gez
              </Button>
            </Link>
          </div>
          <div className="mt-5 flex animate-rise flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12.5px] text-fg-4 [animation-delay:220ms]">
            {['Kart gerekmez', 'Search Console’a salt okunur erişim', 'Kurucu fiyatı ömür boyu sabit'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="relative mx-auto mt-16 max-w-[1080px] animate-rise [animation-delay:280ms]">
          <HeroPreview />
        </div>
      </Container>
    </section>
  )
}

function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-3 text-[30px] leading-tight font-semibold text-fg sm:text-[40px]">{title}</h2>
      {text && <p className="mt-4 text-[16px] leading-relaxed text-fg-3">{text}</p>}
    </div>
  )
}

function Problems() {
  const items = [
    { icon: Unlink, title: 'Backlinkler sessizce kaybolur', text: 'İçerik güncellenir, site taşınır, linkler nofollow’a döner. Parasını ödediğin link aylar önce gitmiş olabilir; kimse sana haber vermez.' },
    { icon: FileWarning, title: 'Bir deploy her şeyi noindex yapar', text: 'Yanlış bir robots.txt satırı ya da unutulan bir noindex etiketi, en önemli sayfalarını birkaç gün içinde Google’dan düşürür.' },
    { icon: Lock, title: 'SSL veya alan adının süresi dolar', text: 'Otomatik yenileme sessizce bozulur. İlk fark eden müşterin olur — o sırada da trafik çoktan düşmüştür.' },
  ]
  return (
    <section className="border-y border-line bg-surface-2/50 py-20">
      <Container>
        <Heading eyebrow="Sorun" title="SEO’da en pahalı hatalar sessiz olanlar." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.title} className="rounded-2xl border border-line bg-surface p-6">
              <it.icon className="size-5 text-error" />
              <h3 className="heading mt-4 text-[16px] font-semibold text-fg">{it.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-3">{it.text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function Features() {
  const items = [
    { icon: ScanSearch, title: 'İndeks izleme', text: 'Search Console URL Inspection ile Google’ın kararı, artı kendi kontrollerimiz: durum kodu, noindex, canonical ve Googlebot için robots.txt kuralları.' },
    { icon: Link2, title: 'Backlink doğrulama', text: 'Her link, linki veren sayfanın kendisinde her gün kontrol edilir: link duruyor mu, anchor ne, dofollow mu, sayfa indekslenebilir mi?' },
    { icon: ShieldCheck, title: 'Teknik SEO denetimi', text: 'İzlenen her URL için öncelik sıralı bulgular ve düzeltmenin ne olduğu — etkilenen sayfaların tam listesiyle.' },
    { icon: Gauge, title: 'Site sağlığı', text: 'Site çöktü mü, kritik sayfalar ve robots.txt 5 dakikada bir kontrol edilir. SSL ve alan adı süresi, Core Web Vitals verisi de burada.' },
    { icon: Bell, title: 'Akıllı uyarılar', text: 'E-posta, Slack veya webhook. Sadece bir şey değiştiğinde. Haftalık özet ve isteğe bağlı günlük bülten.' },
    { icon: FileBarChart2, title: 'Müşteri raporları', text: 'Tek sayfalık, anlaşılır raporlar: PDF olarak indir ya da müşterine her zaman güncel bir bağlantı gönder. Agency planında kendi markanla.' },
  ]
  return (
    <section id="ozellikler" className="scroll-mt-20 py-24">
      <Container>
        <Heading eyebrow="Özellikler" title="Sıralamanı belirleyen her şey, tek bir yerde." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.title} className="rounded-2xl border border-line bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card">
              <span className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary-soft text-primary">
                <it.icon className="size-4" />
              </span>
              <h3 className="heading mt-4 text-[16px] font-semibold text-fg">{it.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-3">{it.text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function Steps() {
  const steps = [
    ['Siteni ekle', 'Alan adını yaz; sitemap’ini okuyup her sayfayı kontrol etmeye başlarız. İki dakika sürer.'],
    ['Search Console’u bağla', 'Salt okunur izinle. Google’ın her sayfa için verdiği indeks kararını her gün okuruz.'],
    ['Backlinklerini içe aktar', 'Search Console, Ahrefs veya Semrush CSV’si ya da düz bir URL listesi. Her linki her gün doğrularız.'],
  ]
  return (
    <section className="border-y border-line bg-surface-2/50 py-20">
      <Container>
        <Heading eyebrow="Nasıl çalışır" title="Beş dakikada kurulur, sonra kendi kendine çalışır." />
        <ol className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-line bg-surface p-6">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">{i + 1}</span>
              <h3 className="mt-4 text-[15.5px] font-semibold text-fg">{t}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-3">{d}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}

const plansTr = [
  { name: 'Free', price: 0, founding: null as number | null, desc: 'Tek bir siteyi izle, Indexora’nın işine yarayıp yaramadığını gör.', features: ['1 proje', '100 URL', '100 backlink', 'Haftalık backlink kontrolü', 'Günlük indeks kontrolü', 'E-posta uyarıları'] },
  { name: 'Starter', price: 12, founding: 9, desc: 'Tek bir işletme sitesi veya yan proje için.', features: ['3 proje', '1.000 URL', '1.000 backlink', 'Günlük backlink doğrulama', 'Search Console indeks durumu', 'Slack, aylık rapor, müşteri bağlantısı'] },
  { name: 'Pro', price: 29, founding: 19, featured: true, desc: 'Danışmanlar ve link çalışması yapan siteler için.', features: ['10 proje', '10.000 URL', '10.000 backlink', 'Haftalık yeni backlink keşfi', 'Rakip link boşluğu', 'Webhook, API, 3 kullanıcı'] },
  { name: 'Agency', price: 79, founding: 49, desc: 'Çok sayıda müşteriye rapor veren ajanslar için.', features: ['50 proje', '50.000 URL', '50.000 backlink', '6 saatte bir URL kontrolü', 'Kendi markanla raporlar', '10 kullanıcı'] },
]

function Pricing() {
  return (
    <section id="fiyatlar" className="scroll-mt-20 py-24">
      <Container>
        <Heading eyebrow="Fiyatlar" title="Dürüst izleme için dürüst fiyat." text="İlk 100 müşteriye kurucu fiyatı: abonelik sürdükçe ömür boyu aynı fiyat. Her hesap 14 gün Pro ile başlar, kart gerekmez." />
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plansTr.map((p) => (
            <div key={p.name} className={cn('flex flex-col rounded-2xl border bg-surface p-6', p.featured ? 'border-primary shadow-card ring-3 ring-[var(--ring)]' : 'border-line')}>
              <h3 className="text-[16px] font-semibold text-fg">{p.name}</h3>
              <p className="mt-1 min-h-[40px] text-[13px] text-fg-3">{p.desc}</p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="tnum text-[34px] font-semibold text-fg">${p.founding ?? p.price}</span>
                <span className="text-[13px] text-fg-4">/ ay</span>
                {p.founding !== null && <span className="tnum text-[13px] text-fg-4 line-through">${p.price}</span>}
              </div>
              <p className="tnum mt-1 h-4 text-[12px] text-fg-4">{p.founding !== null ? 'Kurucu fiyatı · ömür boyu' : 'Sonsuza kadar ücretsiz'}</p>
              <Link to={p.price === 0 ? '/signup' : `/signup?plan=${p.name.toLowerCase()}`} className="mt-6">
                <Button variant={p.featured ? 'primary' : 'secondary'} className="w-full">
                  {p.price === 0 ? 'Ücretsiz başla' : '14 gün ücretsiz dene'}
                </Button>
              </Link>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-fg-2">
                    <Check className={cn('mt-0.5 size-4 shrink-0', p.featured ? 'text-primary' : 'text-fg-3')} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-fg-3">
          Fiyatlar USD. Ödeme kredi kartıyla, Lemon Squeezy üzerinden alınır; KDV gerekiyorsa ödeme sırasında eklenir ve faturan otomatik kesilir. Ücretli planın ilk 30 gününde tek bir sorun ya da kayıp link yakalamazsak, e-posta at, paranın tamamını iade edelim.
        </p>
      </Container>
    </section>
  )
}

const faqs: [string, string][] = [
  ['Arayüz Türkçe mi?', 'Şimdilik uygulamanın arayüzü İngilizce; bu sayfa ve destek Türkçe. Ekranlar sade tutuldu, Search Console kullanan biri rahatça kullanır. Türkçe arayüz, talep oldukça önceliklendirilecek.'],
  ['Google’a “indeksle” isteği gönderiyor musunuz?', 'Hayır — ve bunu yaptığını söyleyen araçlara karşı dikkatli ol. Google, normal sayfalar için herkese açık bir indeksleme API’si sunmuyor. Biz bir sayfanın neden indekslenmediğini ve neyin düzeltilmesi gerektiğini gösteriyoruz; resmî yol Search Console’daki “İndeksleme iste” düğmesi.'],
  ['Backlinklerimi nereden buluyorsunuz?', 'Var olan linklerini sen içe aktarırsın: Search Console’un ücretsiz “Son bağlantılar” dışa aktarımı, Ahrefs, Semrush ya da kendi tablon. Pro ve Agency planlarında ayrıca haftalık yeni link keşfi var. Bulunan her link, gösterilmeden önce bizim tarafımızdan doğrulanır.'],
  ['Search Console verilerim güvende mi?', 'Yalnızca salt okunur izin istiyoruz; hiçbir ayarını değiştiremeyiz. Erişim anahtarları şifrelenmiş olarak saklanır ve bağlantıyı istediğin an kesebilirsin.'],
  ['Deneme bitince ne olur?', '14 günün sonunda plan seçmezsen hesabın Free plana geçer. Hiçbir veri silinmez; Free sınırını aşan URL ve backlinkler duraklatılır, plan yükseltirsen kaldıkları yerden devam eder.'],
  ['İstediğim zaman iptal edebilir miyim?', 'Evet, tek tıkla. Ödediğin dönemin sonuna kadar planın açık kalır, sonra Free plana geçer.'],
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="sss" className="scroll-mt-20 border-t border-line py-24">
      <Container className="max-w-3xl">
        <Heading eyebrow="SSS" title="Sık sorulan sorular" text="Burada olmayan bir sorun varsa e-posta at; bir iş günü içinde Türkçe yanıt veririz." />
        <div className="mt-10 divide-y divide-line border-y border-line">
          {faqs.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left" aria-expanded={open === i}>
                <span className="text-[15.5px] font-medium text-fg">{q}</span>
                <ChevronDown className={cn('size-4 shrink-0 text-fg-4 transition-transform', open === i && 'rotate-180')} />
              </button>
              {open === i && <p className="pb-5 text-[14px] leading-relaxed text-fg-3">{a}</p>}
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-[#0B0F19] px-6 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.35),transparent)]" />
          <h2 className="display relative text-[30px] font-semibold text-white sm:text-[42px]">Sorunları trafiğin düşmeden önce yakala.</h2>
          <p className="relative mx-auto mt-4 max-w-md text-[16px] text-white/70">Siteni ekle, ilk raporunu birkaç dakika içinde gör.</p>
          <Link to="/signup" className="relative mt-8 inline-flex">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight />}>
              14 gün Pro’yu ücretsiz dene
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  )
}
