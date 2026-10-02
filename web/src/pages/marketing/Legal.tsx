import { Container, Footer, Nav } from './Landing'

/**
 * Starting-point legal pages. They describe what the software actually does, but they
 * are NOT legal advice — have them reviewed before taking payments.
 */
export function Legal({ page }: { page: 'privacy' | 'terms' }) {
  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <Container className="max-w-2xl py-16">
        <article className="space-y-5 text-[14.5px] leading-relaxed text-fg-2 [&_h2]:mt-8 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc">
          {page === 'privacy' ? <Privacy /> : <Terms />}
        </article>
      </Container>
      <Footer />
    </div>
  )
}

function Privacy() {
  return (
    <>
      <h1 className="display text-[36px] font-semibold text-fg">Privacy Policy</h1>
      <p className="text-[13px] text-fg-4">Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: your name, email address and a hashed password.</li>
        <li>Monitoring data you give us: domains, URLs, backlink lists and the results of our checks.</li>
        <li>Google Search Console data, if you connect it: read-only access to index status and search performance for the properties you choose. OAuth tokens are encrypted at rest.</li>
        <li>Billing is handled by Lemon Squeezy, our merchant of record. We never see or store your card details.</li>
      </ul>
      <h2>What we do with it</h2>
      <p>We use your data only to provide the service: crawl the pages you asked us to monitor, show you the results and send the alerts you configured. We don’t sell or share your data, and we don’t use it for advertising.</p>
      <h2>Crawling</h2>
      <p>Our crawler identifies itself as IndexoraBot, respects robots.txt on sites you don’t own, and limits itself to one request every two seconds per site.</p>
      <h2>Retention and deletion</h2>
      <p>You can disconnect Google or delete your account at any time from Settings. Deleting your account removes your projects, monitoring history and tokens immediately; backups roll over within 30 days.</p>
      <h2>Contact</h2>
      <p>Questions about your data: privacy@indexora.app</p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1 className="display text-[36px] font-semibold text-fg">Terms of Service</h1>
      <p className="text-[13px] text-fg-4">Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <h2>The service</h2>
      <p>Indexora monitors websites you own or are authorised to monitor: indexability, Google index status (via your Search Console) and backlinks pointing to your site.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Only add websites you own or have permission to monitor.</li>
        <li>Don’t use Indexora or its free tools to overload, scrape or attack other websites.</li>
        <li>Don’t try to bypass plan limits or rate limits.</li>
      </ul>
      <h2>What we don’t promise</h2>
      <p>We report what we observe and what Google reports. We can’t guarantee rankings, indexing or traffic, and we don’t build or sell backlinks.</p>
      <h2>Plans and billing</h2>
      <p>Paid plans renew monthly or yearly until cancelled. Founding prices stay locked while the subscription stays active. If Indexora doesn’t catch a single issue or lost link in your first 30 days on a paid plan, we refund you in full.</p>
      <h2>Liability</h2>
      <p>The service is provided “as is”. Our total liability is limited to the amount you paid us in the 12 months before a claim.</p>
      <h2>Contact</h2>
      <p>hello@indexora.app</p>
    </>
  )
}
