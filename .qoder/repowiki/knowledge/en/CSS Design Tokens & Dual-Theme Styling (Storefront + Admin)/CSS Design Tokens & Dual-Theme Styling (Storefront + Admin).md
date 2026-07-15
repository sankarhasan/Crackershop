---
kind: frontend_style
name: CSS Design Tokens & Dual-Theme Styling (Storefront + Admin)
category: frontend_style
scope:
    - '**'
source_files:
    - css/styles.css
    - css/admin.css
---

The project uses a pure CSS approach with no build toolchain, SCSS, or component library. Visual consistency is achieved through two separate stylesheets that share the same naming conventions and token-driven architecture.

**Design tokens via `:root` custom properties**
- `css/styles.css` defines the storefront palette (`--deep-green`, `--festive-red`, `--golden-yellow`, gradients, shadows, radii) and layout tokens (`--container-width`, `--header-height`).
- `css/admin.css` defines an independent dark-theme token set (`--admin-bg`, `--admin-card`, `--admin-accent`, semantic status colors) for the admin panel.
- Both files centralize spacing, radius, shadow, and transition values so components derive their look from variables rather than hard-coded numbers.

**Two distinct themes, one methodology**
- Storefront (`styles.css`) — light, festive theme using Inter/Poppins fonts, gold/green/red accents, gradient overlays, animated hero carousel, sticky top bar + header, category/product cards with hover transforms, and scroll-triggered `.fade-in-up` animations.
- Admin (`admin.css`) — GitHub-dark-inspired dashboard with a fixed sidebar grid layout, stat cards, data tables, modal forms, toast notifications, and responsive breakpoints at 1100px / 900px / 600px.

**Component class conventions**
- Reusable primitives are defined once and composed: `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-outline` in the storefront; `.btn-admin-*` variants in the admin sheet.
- Shared structural classes like `.badge`, `.section-header`, `.section-title`, `.modal-overlay`, `.toast-container` appear in both sheets with theme-appropriate styling.
- BEM-like single-level class names (no nesting, no CSS modules) keep selectors flat and predictable.

**Responsive strategy**
- No mobile-first framework; responsiveness is handled with `@media` queries inside each stylesheet (e.g., `.mobile-menu-toggle` hidden on desktop, admin sidebar collapsing to horizontal tabs below 900px).
- Grid-based layouts (`display: grid`) replace float-based patterns for categories, stats, and form rows.

**No external dependencies**
- No Tailwind, Bootstrap, Sass, PostCSS, or CSS-in-JS. Fonts are loaded via Google Fonts links in the HTML. Icons are emoji/unicode characters used as inline glyphs.