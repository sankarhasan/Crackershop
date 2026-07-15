---
kind: configuration_system
name: localStorage-backed client-side data store with seeded defaults
category: configuration_system
scope:
    - '**'
source_files:
    - js/data.js
    - js/admin.js
    - js/app.js
---

This repository has no traditional configuration system (no .env, YAML, TOML, or server-side config loader). Instead, runtime "configuration" is implemented as a lightweight, in-browser localStorage persistence layer that seeds default datasets on first run and exposes simple getter/setter helpers.

What the system does
- Stores all application state (categories, products, testimonials, enquiries, banners, admin session) in browser localStorage under fixed keys.
- On first load, each key is populated from embedded `DEFAULT_*` constants so the UI is never empty.
- Consumers call thin accessor functions (`getCategories`, `saveProducts`, `getBannersData`, etc.) rather than reading localStorage directly.
- Banners use an inline normalization step to coerce fields to strings and guard against corrupted storage by falling back to defaults.

Key files and packages
- `js/data.js` — central seed data (`DEFAULT_CATEGORIES`, `DEFAULT_PRODUCTS`, `DEFAULT_TESTIMONIALS`, `DEFAULT_ENQUIRIES`) plus `initData()` seeding and per-entity getters/setters. Also provides `generateId()` for ID allocation.
- `js/admin.js` — banner CRUD backed by `bannersData` key; admin session stored under `jcs_admin_session`; category/product/enquiry edits go through the same localStorage keys.
- `js/app.js` — storefront reads `bannersData` via its own inline `getBannersFromStorage()` helper and renders the hero carousel from it.
- `index.html` / `admin.html` — entry points that include the JS modules; no config file references.

Architecture and conventions
- Keys are string literals chosen ad hoc: `jcs_categories`, `jcs_products`, `jcs_testimonials`, `jcs_enquiries`, `bannersData`, `jcs_admin_session`. There is no single registry of keys.
- Seeding pattern: `if (!localStorage.getItem(key)) { localStorage.setItem(key, JSON.stringify(DEFAULT_...)); }` inside a shared initializer (`initData`) or per-module lazy check.
- Normalization-on-read: both `app.js` and `admin.js` parse the raw JSON, validate it is an array, map items to a canonical shape, re-serialize, and return — this keeps old/invalid entries from breaking the UI.
- No environment-based overrides, feature flags, or secret management exist; everything is purely client-side and user-scoped.

Rules developers should follow
- Add new persistent entities by defining a `DEFAULT_*` constant and a matching pair of `get*` / `save*` helpers in `js/data.js`, following the existing naming/key convention.
- Always seed missing keys before reading them (mirror the `initData` pattern) so the app remains usable after a hard clear of localStorage.
- When reading arbitrary persisted arrays, normalize/cast fields to strings and fall back to defaults on parse errors, as done for banners.
- Avoid direct `localStorage` calls outside the provided helpers to keep keys consistent and prevent accidental corruption.