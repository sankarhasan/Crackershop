---
kind: external_dependency
name: Google Fonts — Poppins + Inter typefaces
slug: google-fonts
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
---

The storefront loads two Google Fonts via preconnect + stylesheet links in `<head>`: **Poppins** (headings, weights 400/600/700/800) and **Inter** (body text, weights 300–700). No other font CDN or self-hosted font files are used; all typography tokens in `css/styles.css` reference these families.