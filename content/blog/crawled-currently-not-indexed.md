---
title: "“Crawled – currently not indexed”: what it means and how to fix it"
description: Google visited your page and chose not to index it. Here's how to tell a technical blocker from a quality decision, and what actually moves pages into the index.
date: 2026-10-02
---

Search Console's Page indexing report has two statuses that confuse almost everyone:

- **Discovered – currently not indexed:** Google knows the URL exists but hasn't crawled it yet.
- **Crawled – currently not indexed:** Google crawled the page and *decided* not to index it — for now.

The second one stings, because it usually isn't a bug. But sometimes it is. The first job is to tell which.

## Step 1: rule out technical blockers

Before assuming Google doesn't like the page, make sure nothing is telling it to stay away. Check the URL for:

| Check | What to look for |
|---|---|
| Status code | Must be `200`. Redirects (`301`/`302`) mean only the target can be indexed. |
| `noindex` | In `<meta name="robots">` *and* the `X-Robots-Tag` response header. |
| Canonical | If `<link rel="canonical">` points to another URL, Google will usually index *that* URL instead. |
| robots.txt | A `Disallow` for Googlebot stops crawling — although such pages usually show as "Blocked by robots.txt", not "Crawled". |
| Rendering | If the main content is added by JavaScript and fails to render, Google sees an almost empty page. |

Our [free indexability checker](/tools/indexability-checker) runs all of these against a URL the way Googlebot would and explains each blocker in plain English. In Search Console, the **URL Inspection** tool shows the user-declared canonical, the Google-selected canonical, and a screenshot of the rendered page.

A very common hidden cause: **Google picked a different canonical.** If two pages are near-duplicates (filters, tags, printer versions, http vs https), Google indexes one and leaves the other as "Crawled – not indexed" or "Duplicate, Google chose different canonical than user".

## Step 2: if nothing is blocking, it's a value judgement

When the page is technically fine, "Crawled – currently not indexed" means Google didn't think the page was worth a place in the index *yet*. Typical reasons:

- **Thin content.** A few sentences, or a page that mostly repeats the template (navigation, footer, sidebar).
- **Near-duplicates.** Many pages that differ only by a city name, a product variant or a date.
- **Low demand.** Nobody searches for what the page covers, so there's little reason to index it.
- **Weak internal linking.** The page is reachable only from a sitemap or a deep pagination page, which signals it isn't important.
- **Site-wide quality.** On a new or low-authority site, Google indexes more selectively.

## Step 3: what actually helps

1. **Make the page substantially useful.** Add what a searcher would need and can't find elsewhere: data, examples, a comparison, a clear answer. Word count isn't the goal, but under ~150 words of unique text is a red flag.
2. **Merge or remove near-duplicates.** Fewer, stronger pages beat many weak ones. Redirect (`301`) or canonicalise the rest.
3. **Link to it from pages that matter.** A link from your homepage or a well-visited hub page tells Google the page is important. Orphan pages rarely get indexed.
4. **Keep it in the XML sitemap** with an accurate `lastmod`, and remove URLs from the sitemap that you don't want indexed.
5. **Request indexing once** with URL Inspection after a real improvement. Requesting it repeatedly without changing the page doesn't help.
6. **Earn a link or two.** External links are one of the strongest signals that a page deserves to be indexed.

## How long to wait

After improving a page, give it **two to four weeks**. Google re-crawls on its own schedule; pages that changed meaningfully and are linked internally tend to move first.

## Don't fight for every URL

Not every page needs to be indexed. Tag archives, internal search results, thin location pages and old campaign pages are often better left out or noindexed on purpose. The goal is that **the pages you want indexed are indexed** — and that you notice quickly when one drops out.

That last part is where monitoring helps. [Indexora](/signup) reads each URL's index status from the Search Console URL Inspection API daily, alongside its own checks for noindex, canonical, robots rules and status codes. When an important page drops out of the index, or a deploy accidentally adds `noindex`, you hear about it the same day — not when traffic has already fallen.
