# ScrollCadence website

Independent Git repository for the homepage, guide and privacy policy. No framework, external fonts, analytics, cookies or build dependencies.

```sh
npm run build
npm run verify
npm run dev
# http://127.0.0.1:4173
```

The static output is `dist/`. The root uses a server 301 redirect to `/en-US/` on Cloudflare Pages (with an HTML fallback for simple static servers). Each of the eight languages has a homepage, `/help/` and `/privacy/`: `en-US`, `zh-Hans`, `zh-Hant`, `es`, `ja`, `ko`, `fr`, `de`. Language switching preserves the page type. Pages use static translated HTML and language alternate links; the interactive demo operates only on its own reading area.

`assets/design-tokens.css` is a standalone runtime snapshot of the App’s shared light/dark design system. Regenerate it from the App checkout with `python3 scripts/sync-design.py`; website builds never require that parent checkout.

`locales.json` and `catalog.json` are independently usable snapshots of the App's canonical localization source. In the parent App checkout, run `python3 scripts/localize.py` to sync these and `assets/engine.js`, then build this site. This repository never imports files from its parent at build time. Standalone editorial changes should be reconciled into the App's source catalog before the next sync.

Production origin: `https://scroll-cadence.luopeike.com`. `release.json` controls the macOS DMG link and iOS preparation status. Add only a signed, notarized DMG to the ignored `downloads/` directory before building; it is copied into `dist/downloads/`. Canonical URLs and the sitemap use the configured origin. iOS is free for the first release; no App Store download badge appears until it is publicly available.

Deploy the contents of `dist/` using Cloudflare Pages Direct Upload. The Git repository is independent and does not require a parent repository push. Release binaries are deliberately excluded from Git.

The Cloudflare Pages custom domain is `scroll-cadence.luopeike.com` (CNAME to `scroll-cadence.pages.dev`, SSL enabled). The existing account-level Bulk Redirect rule `pages_dev_2_luopeike_com` references the shared `tacti_beat` list. Its ScrollCadence entry redirects `scroll-cadence.pages.dev/` to `https://scroll-cadence.luopeike.com/` with HTTP 301 and enables Preserve query string, Include subdomains, Subpath matching, and Preserve path suffix. This redirect lives in Cloudflare, not in the generated static assets.

SEO metadata is generated for every route: self canonical, absolute reciprocal language alternates, a distinct localized description, Open Graph/Twitter previews, and WebSite/WebPage JSON-LD. Homepages also describe the public macOS download as a SoftwareApplication and include six visible localized FAQ answers. No reviews, ratings or release availability are fabricated. CSS and JavaScript URLs include content hashes.

`public/` contains persistent site verification assets and is copied verbatim to the output root. Keep these files when deploying so Search Console ownership remains valid. `sitemap.xml` lists the 24 canonical pages; `robots.txt` advertises it. Cloudflare may prepend its own managed robots directives; check the live response after deployment.

`llms.txt` is an optional concise index of the official multilingual content and product limitations. It is not required for Google Search or its AI features and is not a ranking signal. The visible pages remain authoritative. See [Google's official guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

`npm run verify` checks metadata, language links, structured data, asset links, all sitemap URLs, the verification assets, the optional reading index, and the downloadable DMG checksum. It verifies file consistency; it does not replace Apple signature/notarization checks before updating `downloads/` and `release.json`.
