# JCS Crackers — Full E-Commerce Website with Admin Panel

A fully functional, modern e-commerce website for a firecrackers shop with a festive Diwali theme and a secure admin panel for product/enquiry management.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Structure | HTML5 | Semantic, SEO-friendly |
| Styling | Vanilla CSS | Full control, no dependencies |
| Logic | Vanilla JavaScript (ES6+) | No build step, instant dev server |
| Persistence | `localStorage` | Demo-ready, no backend needed |
| Dev Server | VS Code Live Server or `npx serve` | Quick local preview |
| Images | AI-generated via `generate_image` | Real visuals, no placeholders |

## Color Palette & Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--deep-green` | `#0A5C36` | Navbar, footer, buttons |
| `--festive-red` | `#D4213D` | Accents, sale banners, CTAs |
| `--golden-yellow` | `#FFD700` | Stars, highlights, borders |
| `--dark-bg` | `#0D1117` | Admin panel, dark sections |
| `--cream` | `#FFF8E7` | Light backgrounds |
| `--white` | `#FFFFFF` | Cards, text on dark |

Typography: **Google Fonts — Poppins** (headings) + **Inter** (body)

---

## Proposed File Structure

```
jcs-crackers/
├── index.html              # Main storefront (SPA-style sections)
├── admin.html              # Admin panel (separate page)
├── css/
│   ├── styles.css          # Main storefront styles
│   └── admin.css           # Admin panel styles
├── js/
│   ├── data.js             # Product data, categories, testimonials
│   ├── app.js              # Storefront logic (carousel, cart, forms)
│   └── admin.js            # Admin CRUD, auth, dashboard
└── images/                 # AI-generated images
    ├── logo.png
    ├── hero-1.png
    ├── hero-2.png
    ├── hero-3.png
    ├── sale-banner.png
    └── categories/         # Category card images
```

---

## Proposed Changes

### 1. Storefront — `index.html`

The main customer-facing page with all sections:

| Section | Details |
|---------|---------|
| **Sticky Top Bar** | "Minimum order ₹2000" · "Dealers at: Supreme Fireworks" · Deep green bg |
| **Navbar** | Logo, nav links (Home, About, Quick Enquiry, Safety Tips, Combo Details, Contact Us), phone numbers with `tel:` links |
| **Hero Carousel** | 3-slide auto-rotating banner with "Happy Diwali" messaging, fade/slide transitions |
| **Product Categories** | CSS Grid of category cards (Ground Chakkars, Flower Pots, Fancy Fountains, Pencils, Sparklers, Atom Bombs, Rockets, etc.) |
| **Promotional Banner** | Full-width "DIWALI BIG SALE" with discount percentages, gradient overlay |
| **Product Catalog** | Filterable product grid with Add to Cart, price display, quantity controls |
| **Services** | Icon cards for Quick Delivery, 24/7 Help, Safe Packaging, Best Prices |
| **Testimonials** | Horizontal slider with customer cards, 5-star ratings, auto-scroll |
| **Footer** | 4-column layout: About, Quick Links, Policies, Contact/Social icons |
| **WhatsApp Widget** | Fixed floating button (bottom-right), opens quick enquiry popup form |

### 2. Admin Panel — `admin.html`

| Feature | Details |
|---------|---------|
| **Login Gate** | Username/password auth (stored in localStorage, default: admin/admin123) |
| **Dashboard** | Stats cards (Total Products, Categories, Enquiries, Revenue) |
| **Product Manager** | Table with Add/Edit/Delete, modal form for product details (name, price, category, image, description) |
| **Category Manager** | Add/Edit/Delete categories |
| **Enquiry Manager** | View submitted enquiries with status (New/Contacted/Resolved) |
| **Sidebar Nav** | Collapsible sidebar with dashboard sections |

### 3. Styles — `css/styles.css`

- CSS custom properties (design tokens)
- Mobile-first responsive design with breakpoints at 768px and 1200px
- Animations: fade-in on scroll, carousel transitions, hover effects
- Glassmorphism on cards, gradient overlays on banners

### 4. Styles — `css/admin.css`

- Dark-themed admin dashboard
- Data tables with zebra striping
- Modal overlays for forms
- Responsive sidebar

### 5. Data Layer — `js/data.js`

- Default product catalog (15+ products across 8 categories)
- Default testimonials (5 customers)
- localStorage read/write helpers
- Data initialization on first load

### 6. App Logic — `js/app.js`

- Hero carousel with auto-play and manual controls
- Product grid rendering with category filtering
- Testimonial slider with touch/swipe support
- Quick Enquiry form submission (saves to localStorage)
- Smooth scroll navigation
- Mobile hamburger menu
- WhatsApp popup form

### 7. Admin Logic — `js/admin.js`

- Login/logout with session management
- CRUD operations for products and categories
- Enquiry status management
- Dashboard statistics calculation
- Modal form handling with validation

---

## AI-Generated Images

I will generate the following images to avoid any placeholders:

1. **Hero banners** (3 slides) — Festive Diwali firecrackers scenes
2. **Sale banner** — "Diwali Big Sale" promotional graphic
3. **Category thumbnails** — Visual cards for each product category
4. **Logo** — JCS Crackers brand logo

---

## Verification Plan

### Manual Verification
- Open `index.html` in browser and verify all sections render correctly
- Test responsive design at mobile/tablet/desktop widths
- Test carousel auto-play and manual navigation
- Test product filtering by category
- Test Quick Enquiry form submission
- Test WhatsApp widget popup
- Navigate to `admin.html`, login, and test CRUD operations
- Verify data persists across page reloads via localStorage

> [!NOTE]
> This is a frontend-only demo using `localStorage` for persistence. For production deployment, a backend API and database would be needed.
