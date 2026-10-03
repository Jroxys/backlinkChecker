---
title: How to check if a backlink still exists (and why links quietly disappear)
description: Backlinks vanish, turn nofollow or end up on noindexed pages without anyone telling you. Here's how to verify a link properly — by hand and at scale.
date: 2026-10-01
---

You earned a link, paid for a placement or traded a guest post. Six months later, is it still there?

Usually nobody knows. Most backlink tools show you links *they have crawled at some point*, not links that exist *today*. Their index refreshes slowly, so a link removed last week can keep showing up as "live" for a long time.

This guide covers how to verify a backlink properly, the ways links quietly stop counting, and how to check hundreds of them without losing a day.

## What "the link still exists" actually means

A backlink only does its job if **all** of these are true:

1. **The linking page loads.** It answers `200 OK`, not `404`, `410`, a soft-404 or a server error.
2. **The link is in the HTML.** There's an `<a href>` pointing to your domain — ideally to the exact URL you expect.
3. **The link isn't qualified away.** `rel="nofollow"`, `rel="ugc"` or `rel="sponsored"` tell Google not to pass ranking signals (it treats them as hints, but don't count on it).
4. **The linking page can be indexed.** A link on a page with `noindex`, or one blocked by `robots.txt`, carries little weight — Google may never see it.
5. **The anchor is what you agreed.** Anchors get edited during content refreshes, sometimes into "click here".

Checking only the first two — what most people do by opening the page and pressing Ctrl+F — misses the most common failures.

## Checking a single link by hand

1. Open the linking page in a private window (you want what a stranger sees, without your cookies).
2. Right-click → **View page source**, not "Inspect". The source is the HTML the server sent, which is closer to what crawlers read first; "Inspect" shows the page after JavaScript ran.
3. Search the source for your domain. Note the full `href`, the anchor text and the `rel` attribute.
4. Search for `noindex` in the source. Also check the response headers (DevTools → Network → the document → Headers) for `X-Robots-Tag: noindex`.
5. Check `https://the-site.com/robots.txt` for a `Disallow` that covers the page's path.

That's five steps per link. Fine for one link; not for 300.

Or paste the page and your domain into our [free backlink checker](/tools/backlink-checker): it fetches the page, finds the link and reports the anchor, the `rel` value and whether the linking page is indexable.

## Why links disappear

From watching thousands of links, the usual causes are, in rough order:

- **Content refreshes.** An editor rewrites a 2021 article for 2026 and drops the outbound links they didn't add.
- **Site migrations and redesigns.** URLs change without redirects, so your link now sits on a page that returns `404`.
- **Link policies.** A publisher decides all outbound links are `nofollow` from now on — across every past article at once.
- **Sponsored-content cleanups.** After a Google update, sites mass-tag paid links as `sponsored` or remove them.
- **CMS and plugin changes.** A new theme renders links with JavaScript, or a plugin starts adding `rel="nofollow"` to external links.
- **Expired sites.** The domain lapses; the page is replaced by a parking page.

None of these send you an email.

## A false alarm to avoid

A single failed check doesn't mean a link is gone. Pages time out, CDNs rate-limit crawlers, and A/B tests occasionally serve a variant without the link.

A sensible rule: **treat a link as lost only after two consecutive misses**, at least a day apart. Treat a page that errors repeatedly as "broken" rather than "lost", because the fix is different: you ask the site owner to restore the page, not to re-add your link.

## Checking links at scale

If you track more than a handful of links, you need three things:

1. **One list of every link you care about.** Export what you have from Google Search Console (Links → Latest links → Export), plus your outreach spreadsheet and any paid placements.
2. **A scheduled re-check of the linking page itself** — not a lookup in someone's index — that records status code, presence, anchor, `rel` and indexability every time.
3. **A notification when something changes**, with enough detail to act: which page, what changed, and since when.

That's exactly what [Indexora](/signup) does. Import a CSV from Search Console, Ahrefs, Semrush or your own spreadsheet, and every link is re-verified on the linking page daily. You get an alert when a link is removed, turns nofollow, or its page becomes noindexed — and it confirms with a second check before calling a link lost.

## Checklist

- [ ] Verify the page returns `200`
- [ ] Find the exact `<a href>` in the page source
- [ ] Note `rel` (dofollow, nofollow, ugc, sponsored)
- [ ] Check for `noindex` in the HTML and the `X-Robots-Tag` header
- [ ] Check `robots.txt` for the page's path
- [ ] Record the anchor text
- [ ] Re-check on a schedule, and confirm before calling a link lost
