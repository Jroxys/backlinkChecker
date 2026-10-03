---
title: The redirect checklist for a site migration (that most teams skip)
description: Redirect chains, temporary redirects and duplicate hosts quietly cost rankings after a migration. A practical checklist to run before and after you switch.
date: 2026-10-03
---

Migrations fail quietly. The site looks fine in the browser, the launch party happens, and three weeks later organic traffic is down 30% with no obvious cause.

When you dig in, it's almost always redirects: missing ones, slow chains of them, or the wrong type. Here's the checklist we'd run on any migration — a new domain, HTTPS, a URL structure change or a CMS switch.

## Before the switch

**1. Export every URL that matters.** Combine:

- the current XML sitemap(s),
- the top pages by clicks from Search Console (Performance → Pages, last 16 months),
- every URL that has external backlinks (Search Console → Links → Top linked pages, or your backlink tool).

Backlinked URLs are the ones people forget — they may not be in the sitemap any more, but they still carry link equity.

**2. Map old → new, one to one.** Every old URL gets the *most relevant* new URL. Redirecting everything to the homepage is treated like a soft 404 and throws away most of the value.

**3. Decide the one canonical host.** Pick exactly one of `https://example.com` or `https://www.example.com`. Every other variant must redirect to it.

## The four host variants

Every site answers on up to four addresses:

```
http://example.com
http://www.example.com
https://example.com
https://www.example.com
```

All four should end on the same URL, in **one hop**, with a **permanent** redirect. If two of them serve the page directly, Google sees duplicate sites and may split signals between them.

Our [free redirect checker](/tools/redirect-checker) tests all four variants of any URL at once and shows where each one ends.

## Permanent vs temporary

| Code | Meaning | Use it for |
|---|---|---|
| `301` | Moved permanently | Migrations, URL changes, http → https |
| `308` | Permanent, keeps the request method | Same as 301; fine for SEO |
| `302` | Found (temporary) | Short-lived moves, A/B tests |
| `307` | Temporary, keeps the method | Same as 302 |

Google has said it treats long-standing temporary redirects much like permanent ones over time. But a `302` tells it the old URL may come back, so it may keep the old URL indexed for longer. For a migration, use `301` or `308`.

A frequent culprit: **frameworks and hosting panels default to `302`.** Check what yours actually sends.

## Chains and loops

A chain is a redirect to a redirect:

```
http://example.com/old-page
  → 301 https://example.com/old-page
  → 301 https://www.example.com/old-page
  → 301 https://www.example.com/new-page
```

Each hop slows crawling and adds a point of failure. Googlebot follows up to about ten hops, but users on slow connections feel every one. Chains usually come from stacking migrations over the years (http → https, then non-www → www, then a new URL scheme).

**Fix:** point every old URL *directly* at its final destination, and update internal links so they point at final URLs and need no redirect at all.

A loop (A → B → A) makes the page unreachable. These usually appear when two rules fight, for example a CDN forcing https while the origin forces http.

## After the switch: verify, then keep watching

On launch day:

1. Run every URL from your old-URL export through a redirect checker. Every one should end in a `200`, in one hop.
2. Spot-check the four host variants of your top 20 pages.
3. Submit the new XML sitemap in Search Console. If the domain changed, use the Change of Address tool.
4. Update internal links, canonicals and hreflang tags to the new URLs, so nothing relies on redirects.

**Keep the redirects for at least a year** — ideally forever. Removing them early breaks every backlink that still points at the old URLs.

In the weeks after, watch:

- Search Console's Page indexing report for spikes in "Not found (404)" and "Page with redirect".
- Index status of your most important pages.
- Your backlinks: links to old URLs should still resolve through the redirect.

[Indexora](/signup) does the watching for you: it checks every URL in your sitemap daily, alerts you when a page starts redirecting, erroring or turns noindex, and re-verifies backlinks to make sure they still reach a live page. Migrations are exactly when you want a second pair of eyes.

## Checklist

- [ ] Export sitemap URLs, top pages and backlinked URLs
- [ ] Map every old URL to its most relevant new URL
- [ ] Choose one canonical host; redirect the other three variants
- [ ] Use 301/308, not 302/307
- [ ] No chains: every old URL goes straight to its final URL
- [ ] Update internal links, canonicals and the sitemap
- [ ] Verify every old URL after launch
- [ ] Keep redirects for at least a year
